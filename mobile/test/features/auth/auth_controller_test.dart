import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/core/errors/app_exception.dart';
import 'package:laci_mobile/core/network/session_events.dart';
import 'package:laci_mobile/features/auth/application/auth_controller.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/test_doubles.dart';

void main() {
  const AppUser pacUser = AppUser(
    id: 'pac-1',
    name: 'Sekretaris PAC Barat',
    email: 'pac@example.test',
    role: UserRole.pac,
    isActive: true,
    emailVerified: true,
  );
  const AppUser unverifiedCabang = AppUser(
    id: 'cabang-1',
    name: 'Sekretaris Cabang',
    email: 'cabang@example.test',
    role: UserRole.cabang,
    isActive: true,
    emailVerified: false,
  );

  late MockAuthRepository repository;
  late MockLocationService locationService;
  late SessionEvents sessionEvents;
  late AuthController controller;
  late int sessionCleanupCalls;

  setUp(() async {
    repository = MockAuthRepository();
    locationService = MockLocationService();
    sessionEvents = SessionEvents();
    sessionCleanupCalls = 0;
    when(() => repository.restoreSession()).thenAnswer((_) async => null);
    when(() => repository.logout()).thenAnswer((_) async {});
    when(() => repository.clearLocalSession()).thenAnswer((_) async {});
    when(() => locationService.openSettings()).thenAnswer((_) async => true);
    controller = AuthController(
      repository: repository,
      locationService: locationService,
      sessionEvents: sessionEvents,
      onSessionCleared: () async => sessionCleanupCalls++,
    );
    await pumpEventQueue();
    sessionCleanupCalls = 0;
  });

  tearDown(() async {
    controller.dispose();
    await sessionEvents.dispose();
  });

  test('inisialisasi tanpa sesi langsung menuju login', () {
    expect(controller.state.status, AuthStatus.unauthenticated);
    expect(controller.state.isAuthenticated, isFalse);
  });

  test('restore mempertahankan role dan verifikasi email user', () async {
    when(() => repository.restoreSession())
        .thenAnswer((_) async => unverifiedCabang);

    await controller.initialize();

    expect(controller.state.status, AuthStatus.authenticated);
    expect(controller.state.user?.role, UserRole.cabang);
    expect(controller.state.user?.emailVerified, isFalse);
    expect(controller.state.isAuthenticated, isTrue);
  });

  test('login menangkap lokasi sebelum membuka autentikasi SSO', () async {
    when(() => locationService.captureForLogin())
        .thenAnswer((_) async => '-7.65, 111.36');
    when(() => repository.login()).thenAnswer((_) async => pacUser);

    await controller.login();

    expect(controller.state.status, AuthStatus.authenticated);
    expect(controller.state.user, same(pacUser));
    verifyInOrder(<dynamic Function()>[
      () => locationService.captureForLogin(),
      () => repository.login(),
    ]);
  });

  test('izin lokasi permanen menghasilkan state yang dapat ditindaklanjuti',
      () async {
    when(() => locationService.captureForLogin()).thenThrow(
      const AppException(
        code: 'LOCATION_DENIED_FOREVER',
        message: 'Izinkan lokasi melalui pengaturan aplikasi untuk masuk.',
      ),
    );

    await controller.login();

    expect(controller.state.status, AuthStatus.failure);
    expect(controller.state.errorCode, 'LOCATION_DENIED_FOREVER');
    expect(
      controller.state.message,
      'Izinkan lokasi melalui pengaturan aplikasi untuk masuk.',
    );
    verifyNever(() => repository.login());
    verify(() => repository.clearLocalSession()).called(1);
  });

  test('login tidak membuka SSO bila lokasi tidak tersedia', () async {
    when(() => locationService.captureForLogin()).thenAnswer((_) async => null);

    await controller.login();

    expect(controller.state.status, AuthStatus.failure);
    expect(controller.state.errorCode, 'LOCATION_REQUIRED');
    verifyNever(() => repository.login());
    verify(() => repository.clearLocalSession()).called(1);
  });

  test('SSO yang dibatalkan membersihkan lokasi hasil capture', () async {
    when(() => locationService.captureForLogin())
        .thenAnswer((_) async => '-7.65, 111.36');
    when(() => repository.login()).thenThrow(
      const AppException(
        code: 'LOGIN_CANCELLED',
        message: 'Login dibatalkan.',
      ),
    );

    await controller.login();

    expect(controller.state.status, AuthStatus.failure);
    expect(controller.state.errorCode, 'LOGIN_CANCELLED');
    verify(() => repository.clearLocalSession()).called(1);
  });

  test('hasil login lama dibuang bila logout terjadi saat SSO terbuka',
      () async {
    final Completer<AppUser> pendingLogin = Completer<AppUser>();
    when(() => locationService.captureForLogin())
        .thenAnswer((_) async => '-7.65, 111.36');
    when(() => repository.login()).thenAnswer((_) => pendingLogin.future);

    final Future<void> login = controller.login();
    await pumpEventQueue();
    await controller.logout();
    pendingLogin.complete(pacUser);
    await login;

    expect(controller.state.status, AuthStatus.unauthenticated);
    expect(controller.state.user, isNull);
    verify(() => repository.clearLocalSession()).called(1);
  });

  test('event sesi kedaluwarsa logout dan mengarahkan kembali ke login',
      () async {
    controller.updateUser(pacUser);

    sessionEvents.expire();
    await pumpEventQueue();

    expect(controller.state.status, AuthStatus.failure);
    expect(controller.state.errorCode, 'SESSION_EXPIRED');
    expect(controller.state.user, isNull);
    verify(() => repository.logout()).called(1);
    expect(sessionCleanupCalls, 1);
  });

  test('event akun nonaktif mempertahankan alasan dan menghapus sesi',
      () async {
    controller.updateUser(pacUser);

    sessionEvents.expire(
      const AppException(
        statusCode: 401,
        code: 'ACCOUNT_INACTIVE',
        message: 'Akun dinonaktifkan oleh Sekretaris Cabang.',
      ),
    );
    await pumpEventQueue();

    expect(controller.state.status, AuthStatus.failure);
    expect(controller.state.errorCode, 'ACCOUNT_INACTIVE');
    expect(
      controller.state.message,
      'Akun dinonaktifkan oleh Sekretaris Cabang.',
    );
    expect(controller.state.user, isNull);
    verify(() => repository.logout()).called(1);
    expect(sessionCleanupCalls, 1);
  });

  test('updateUser memperbarui profil tanpa mengubah status autentikasi', () {
    controller.updateUser(unverifiedCabang);

    expect(controller.state.isAuthenticated, isTrue);
    expect(controller.state.user?.role.shortLabel, 'CABANG');
    expect(controller.state.user?.emailVerified, isFalse);
  });

  test('resume merevalidasi sesi dan memperbarui data user', () async {
    controller.updateUser(pacUser);
    when(() => repository.syncSsoProfile())
        .thenAnswer((_) async => unverifiedCabang);

    await controller.revalidateSession();

    expect(controller.state.status, AuthStatus.authenticated);
    expect(controller.state.user, unverifiedCabang);
  });

  test('resume dengan sesi kedaluwarsa kembali ke login', () async {
    controller.updateUser(pacUser);
    when(() => repository.syncSsoProfile()).thenThrow(
      const AppException(
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Sesi invalid',
      ),
    );

    await controller.revalidateSession();

    expect(controller.state.status, AuthStatus.failure);
    expect(controller.state.errorCode, 'SESSION_EXPIRED');
    expect(controller.state.user, isNull);
  });

  test('hasil revalidasi lama tidak menghidupkan sesi setelah logout',
      () async {
    final Completer<AppUser> pendingRestore = Completer<AppUser>();
    controller.updateUser(pacUser);
    when(() => repository.syncSsoProfile())
        .thenAnswer((_) => pendingRestore.future);

    final Future<void> revalidation = controller.revalidateSession();
    await controller.logout();
    pendingRestore.complete(pacUser);
    await revalidation;

    expect(controller.state.status, AuthStatus.unauthenticated);
    expect(controller.state.user, isNull);
  });

  test('logout server berakhir sebagai state unauthenticated', () async {
    controller.updateUser(pacUser);

    await controller.logout();

    expect(controller.state.status, AuthStatus.unauthenticated);
    expect(controller.state.user, isNull);
    verify(() => repository.logout()).called(1);
    expect(sessionCleanupCalls, 1);
  });
}
