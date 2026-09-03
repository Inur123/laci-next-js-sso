import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/app/providers.dart';
import 'package:laci_mobile/core/config/app_config.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:laci_mobile/features/profile/presentation/profile_page.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/test_doubles.dart';

void main() {
  testWidgets('profil mobile read-only dan perubahan diarahkan ke SSO',
      (WidgetTester tester) async {
    final MockApiClient apiClient = MockApiClient();
    final MemorySecureStore secureStore = MemorySecureStore();
    when(
      () => apiClient.get(
        '/periods',
        query: any<Map<String, dynamic>>(named: 'query'),
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'period-1',
            'nama': '2026–2028',
            'isActive': true,
          },
        ],
      },
    );
    const AppUser user = AppUser(
      id: 'pac-1',
      name: 'Sekretaris PAC Barat',
      email: 'pac@example.test',
      role: UserRole.pac,
      isActive: true,
      emailVerified: true,
      activePeriodId: 'period-1',
    );
    Uri? launchedUri;

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          apiClientProvider.overrideWithValue(apiClient),
          secureStoreProvider.overrideWithValue(secureStore),
          appConfigProvider.overrideWithValue(
            const AppConfig(
              apiBaseUrl: 'https://api.example.test',
              frontendBaseUrl: 'https://app.example.test',
              mobileRedirectUri: 'lacidigital://oauth/callback',
              ssoProfileUrl: 'https://pelajarnumagetan.id/dashboard/profil',
              environment: 'test',
            ),
          ),
        ],
        child: MaterialApp(
          home: ProfilePage(
            user: user,
            profileLauncher: (Uri uri) async {
              launchedUri = uri;
              return true;
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
        find.text(
            'Data identitas berasal dari SSO dan tidak dapat diubah melalui aplikasi ini.'),
        findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    expect(find.text('Kelola profil di SSO'), findsOneWidget);
    expect(find.byType(TextFormField), findsNothing);
    expect(find.text('Simpan perubahan'), findsNothing);
    expect(find.byIcon(Icons.camera_alt_outlined), findsNothing);

    await tester.tap(find.text('Kelola profil di SSO'));
    await tester.pumpAndSettle();
    expect(launchedUri?.host, 'pelajarnumagetan.id');
    expect(launchedUri?.path, '/dashboard/profil');
  });
}
