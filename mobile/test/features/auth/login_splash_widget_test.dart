import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/app/app.dart';
import 'package:laci_mobile/app/providers.dart';
import 'package:laci_mobile/app/theme/app_theme.dart';
import 'package:laci_mobile/core/errors/app_exception.dart';
import 'package:laci_mobile/core/network/session_events.dart';
import 'package:laci_mobile/features/auth/application/auth_controller.dart';
import 'package:laci_mobile/features/auth/presentation/login_page.dart';
import 'package:laci_mobile/features/splash/presentation/splash_page.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/test_doubles.dart';

class _AuthFixture {
  _AuthFixture()
      : repository = MockAuthRepository(),
        location = MockLocationService(),
        events = SessionEvents();

  final MockAuthRepository repository;
  final MockLocationService location;
  final SessionEvents events;
  late final AuthController controller;
  late final ProviderContainer container;

  void initialize() {
    when(() => repository.restoreSession()).thenAnswer((_) async => null);
    when(() => repository.logout()).thenAnswer((_) async {});
    when(() => repository.clearLocalSession()).thenAnswer((_) async {});
    when(() => location.openSettings()).thenAnswer((_) async => true);
    controller = AuthController(
      repository: repository,
      locationService: location,
      sessionEvents: events,
    );
    container = ProviderContainer(
      overrides: <Override>[
        authControllerProvider.overrideWith((Ref ref) => controller),
      ],
    );
  }

  void dispose() {
    container.dispose();
    events.dispose();
  }
}

List<String> _assetNames(WidgetTester tester) => tester
    .widgetList<Image>(find.byType(Image))
    .map<ImageProvider<Object>>((Image image) => image.image)
    .whereType<AssetImage>()
    .map<String>((AssetImage image) => image.assetName)
    .toList(growable: false);

Widget _loginHost(_AuthFixture fixture) => UncontrolledProviderScope(
      container: fixture.container,
      child: MaterialApp(
        theme: AppTheme.light(null),
        home: const LoginPage(),
      ),
    );

void main() {
  testWidgets('splash hanya menampilkan logo Laci',
      (WidgetTester tester) async {
    final SemanticsHandle semantics = tester.ensureSemantics();
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(null),
        home: const SplashPage(),
      ),
    );
    await tester.pump(const Duration(milliseconds: 700));

    expect(find.bySemanticsLabel('Logo Laci Digital'), findsOneWidget);
    expect(_assetNames(tester), <String>['assets/images/logo_laci.webp']);
    expect(find.text('Masuk dengan SSO'), findsNothing);
    semantics.dispose();
  });

  testWidgets('login hanya memakai logo SSO di tombol autentikasi',
      (WidgetTester tester) async {
    final _AuthFixture fixture = _AuthFixture();
    fixture.initialize();
    addTearDown(fixture.dispose);

    await tester.pumpWidget(_loginHost(fixture));
    await tester.pump();

    expect(find.text('Masuk ke\nLaci Digital'), findsOneWidget);
    expect(find.text('Masuk dengan SSO'), findsOneWidget);
    expect(_assetNames(tester), <String>['assets/images/logo_sso.webp']);
  });

  testWidgets('error izin permanen ditampilkan sebagai notice login',
      (WidgetTester tester) async {
    final _AuthFixture fixture = _AuthFixture();
    fixture.initialize();
    addTearDown(fixture.dispose);
    await tester.pumpWidget(_loginHost(fixture));
    await tester.pump();

    expect(find.text('Terhubung aman ke SSO IPNU IPPNU'), findsOneWidget);

    when(() => fixture.location.captureForLogin()).thenThrow(
      const AppException(
        code: 'LOCATION_DENIED_FOREVER',
        message: 'Izinkan lokasi melalui pengaturan aplikasi untuk masuk.',
      ),
    );
    await fixture.controller.login();
    await tester.pump();

    expect(
      find.text('Izinkan lokasi melalui pengaturan aplikasi untuk masuk.'),
      findsOneWidget,
    );
    expect(fixture.controller.state.errorCode, 'LOCATION_DENIED_FOREVER');
    expect(find.text('Buka pengaturan'), findsOneWidget);
  });

  testWidgets('perubahan scope autentikasi mereset seluruh navigation stack',
      (WidgetTester tester) async {
    final _AuthFixture fixture = _AuthFixture();
    fixture.initialize();
    addTearDown(fixture.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: fixture.container,
        child: const LaciApp(),
      ),
    );
    await tester.pumpAndSettle();

    Navigator.of(tester.element(find.byType(LoginPage))).push(
      MaterialPageRoute<void>(
        builder: (BuildContext context) => const Scaffold(
          body: Center(child: Text('Route privat simulasi')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Route privat simulasi'), findsOneWidget);

    when(() => fixture.location.captureForLogin()).thenThrow(
      const AppException(
        code: 'AUTH_SCOPE_CHANGED',
        message: 'Scope autentikasi berubah.',
      ),
    );
    await fixture.controller.login();
    await tester.pumpAndSettle();

    expect(find.text('Route privat simulasi'), findsNothing);
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.text('Scope autentikasi berubah.'), findsOneWidget);
  });
}
