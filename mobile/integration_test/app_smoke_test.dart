import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:laci_mobile/app/app.dart';
import 'package:laci_mobile/app/providers.dart';
import 'package:laci_mobile/core/network/session_events.dart';
import 'package:laci_mobile/features/auth/application/auth_controller.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:mocktail/mocktail.dart';

import '../test/support/test_doubles.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('cold start berpindah langsung dari splash ke login',
      (WidgetTester tester) async {
    final MockAuthRepository repository = MockAuthRepository();
    final MockLocationService location = MockLocationService();
    final SessionEvents events = SessionEvents();
    final Completer<AppUser?> restore = Completer<AppUser?>();
    when(() => repository.restoreSession()).thenAnswer((_) => restore.future);
    when(() => repository.logout()).thenAnswer((_) async {});
    when(() => location.openSettings()).thenAnswer((_) async => true);
    final AuthController controller = AuthController(
      repository: repository,
      locationService: location,
      sessionEvents: events,
    );
    final ProviderContainer container = ProviderContainer(
      overrides: <Override>[
        authControllerProvider.overrideWith((Ref ref) => controller),
      ],
    );
    addTearDown(() {
      container.dispose();
      events.dispose();
    });

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const LaciApp(),
      ),
    );

    expect(find.byKey(const ValueKey<String>('splash')), findsOneWidget);
    expect(
      find.image(const AssetImage('assets/images/logo_laci.webp')),
      findsOneWidget,
    );

    restore.complete(null);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byKey(const ValueKey<String>('login')), findsOneWidget);
    expect(find.text('Masuk dengan SSO'), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('home')), findsNothing);
  });
}
