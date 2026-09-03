import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/core/config/app_config.dart';
import 'package:laci_mobile/core/errors/app_exception.dart';
import 'package:laci_mobile/core/storage/secure_store.dart';
import 'package:laci_mobile/features/auth/data/auth_repository.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/test_doubles.dart';

void main() {
  const AppConfig config = AppConfig(
    apiBaseUrl: 'https://api.example.test',
    frontendBaseUrl: 'https://web.example.test',
    mobileRedirectUri: 'lacidigital://oauth/callback',
    ssoProfileUrl: 'https://sso.example.test/profile',
    environment: 'test',
  );
  late MemorySecureStore store;
  late MockApiClient apiClient;
  late AuthRepository repository;

  Map<String, dynamic> userJson({
    String role = 'SEKRETARIS_PAC',
    bool active = true,
    bool verified = true,
  }) =>
      <String, dynamic>{
        'id': 'user-1',
        'name': 'Sekretaris PAC',
        'email': 'pac@example.test',
        'role': role,
        'isActive': active,
        'emailVerified': verified,
      };

  setUp(() {
    store = MemorySecureStore();
    apiClient = MockApiClient();
    repository = AuthRepository(
      config: config,
      secureStore: store,
      apiClient: apiClient,
    );
  });

  test('restore tanpa token langsung menghasilkan sesi kosong', () async {
    expect(await repository.restoreSession(), isNull);
    verifyNever(() => apiClient.get(any<String>()));
  });

  test('restore membersihkan token yang mendekati kedaluwarsa', () async {
    store.tokens = TokenBundle(
      accessToken: 'expired',
      expiresAt: DateTime.now().add(const Duration(seconds: 20)),
    );
    store.viewPeriod = 'period-old';
    store.location = '-7.65, 111.36';

    expect(await repository.restoreSession(), isNull);
    expect(store.clearTokensCalls, 1);
    expect(store.viewPeriod, isNull);
    expect(store.location, isNull);
    verifyNever(() => apiClient.get(any<String>()));
  });

  test('restore memuat user aktif lengkap beserta role dan verifikasi',
      () async {
    store.tokens = TokenBundle(
      accessToken: 'valid',
      expiresAt: DateTime.now().add(const Duration(hours: 2)),
    );
    when(() => apiClient.get('/me')).thenAnswer(
      (_) async => <String, dynamic>{
        'data': userJson(role: 'SEKRETARIS_CABANG', verified: false),
      },
    );

    final AppUser? user = await repository.restoreSession();

    expect(user?.role, UserRole.cabang);
    expect(user?.emailVerified, isFalse);
    expect(store.clearTokensCalls, 0);
  });

  test('401 saat restore menjadi logout lokal, bukan crash aplikasi', () async {
    store.tokens = TokenBundle(
      accessToken: 'rejected',
      expiresAt: DateTime.now().add(const Duration(hours: 2)),
    );
    store.viewPeriod = 'period-rejected';
    store.location = 'stale-location';
    when(() => apiClient.get('/me')).thenThrow(
      const AppException(
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Sesi invalid',
      ),
    );

    expect(await repository.restoreSession(), isNull);
    expect(store.clearTokensCalls, 1);
    expect(store.viewPeriod, isNull);
    expect(store.location, isNull);
  });

  test('menolak user nonaktif sesuai aturan backend', () async {
    when(() => apiClient.get('/me')).thenAnswer(
      (_) async => <String, dynamic>{'data': userJson(active: false)},
    );

    await expectLater(
      repository.currentUser(),
      throwsA(
        isA<AppException>().having(
          (AppException error) => error.code,
          'code',
          'ACCOUNT_INACTIVE',
        ),
      ),
    );
  });

  test('sinkronisasi profil membaca foto terbaru dari SSO', () async {
    when(() => apiClient.post('/me/sync')).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          ...userJson(),
          'image': 'https://cdn.example.test/avatar/user-1.jpg',
        },
      },
    );

    final AppUser user = await repository.syncSsoProfile();

    expect(user.image, 'https://cdn.example.test/avatar/user-1.jpg');
    verify(() => apiClient.post('/me/sync')).called(1);
  });

  test('logout selalu membersihkan token walau server tidak terjangkau',
      () async {
    store.tokens = const TokenBundle(accessToken: 'local-token');
    store.viewPeriod = 'period-current';
    store.location = '-7.65, 111.36';
    when(() => apiClient.post('/auth/mobile/logout')).thenThrow(
      const AppException(message: 'offline'),
    );

    await repository.logout();

    expect(store.tokens, isNull);
    expect(store.clearTokensCalls, 1);
    expect(store.viewPeriod, isNull);
    expect(store.location, isNull);
    verify(() => apiClient.post('/auth/mobile/logout')).called(1);
  });
}
