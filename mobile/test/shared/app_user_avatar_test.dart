import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/app/providers.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:laci_mobile/shared/widgets/app_user_avatar.dart';
import 'package:mocktail/mocktail.dart';

import '../support/test_doubles.dart';

void main() {
  testWidgets('avatar memuat foto privat melalui API sesi mobile',
      (WidgetTester tester) async {
    final MockApiClient apiClient = MockApiClient();
    final Uint8List pixel = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC'
      'AAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    );
    when(() => apiClient.download('/images/users/user-1'))
        .thenAnswer((_) async => pixel);
    const AppUser user = AppUser(
      id: 'user-1',
      name: 'QA DEV',
      email: 'qa@example.test',
      role: UserRole.pac,
      isActive: true,
      emailVerified: true,
      image: 'profile/avatar.enc',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          apiClientProvider.overrideWithValue(apiClient),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: AppUserAvatar(
              user: user,
              radius: 24,
              backgroundColor: Colors.white,
              foregroundColor: Colors.green,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    verify(() => apiClient.download('/images/users/user-1')).called(1);
    final CircleAvatar avatar = tester.widget<CircleAvatar>(
      find.byType(CircleAvatar),
    );
    expect(avatar.foregroundImage, isA<MemoryImage>());
    expect(find.text('QD'), findsOneWidget);
  });

  testWidgets('avatar tanpa foto tetap memakai inisial',
      (WidgetTester tester) async {
    const AppUser user = AppUser(
      id: 'user-2',
      name: 'Sekretaris Cabang',
      email: 'cabang@example.test',
      role: UserRole.cabang,
      isActive: true,
      emailVerified: true,
    );
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: AppUserAvatar(
              user: user,
              radius: 24,
              backgroundColor: Colors.white,
              foregroundColor: Colors.green,
            ),
          ),
        ),
      ),
    );

    expect(find.text('SC'), findsOneWidget);
  });

  testWidgets('avatar SSO berupa URL dimuat langsung tanpa endpoint privat',
      (WidgetTester tester) async {
    final MockApiClient apiClient = MockApiClient();
    const AppUser user = AppUser(
      id: 'user-3',
      name: 'QA DEV',
      email: 'qa@example.test',
      role: UserRole.pac,
      isActive: true,
      emailVerified: true,
      image: 'https://cdn.example.test/avatar/qa.jpg',
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          apiClientProvider.overrideWithValue(apiClient),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: AppUserAvatar(
              user: user,
              radius: 24,
              backgroundColor: Colors.white,
              foregroundColor: Colors.green,
            ),
          ),
        ),
      ),
    );

    final CircleAvatar avatar = tester.widget<CircleAvatar>(
      find.byType(CircleAvatar),
    );
    expect(avatar.foregroundImage, isA<NetworkImage>());
    verifyNever(() => apiClient.download(any<String>()));
  });
}
