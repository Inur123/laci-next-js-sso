import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/app/providers.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:laci_mobile/features/dashboard/presentation/dashboard_page.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/test_doubles.dart';

void main() {
  testWidgets('dashboard Cabang menampilkan jumlah PAC aktif',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final MockApiClient apiClient = MockApiClient();
    when(() => apiClient.get('/dashboard')).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          'personal': <String, dynamic>{
            'anggota': 10,
            'surat': 3,
            'pengajuan': 2,
            'berkasPimpinan': 1,
            'presensi': 4,
            'periode': 2,
            'userCount': 7,
            'berkasSP': 5,
            'kegiatan': 6,
          },
        },
      },
    );
    const AppUser user = AppUser(
      id: 'cabang-1',
      name: 'Sekretaris Cabang',
      email: 'cabang@example.test',
      role: UserRole.cabang,
      isActive: true,
      emailVerified: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          apiClientProvider.overrideWithValue(apiClient),
        ],
        child: MaterialApp(
          home: DashboardPage(user: user, onOpen: (_) {}),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('PAC aktif'), findsOneWidget);
    expect(
      find.descendant(
        of: find.ancestor(
          of: find.text('PAC aktif'),
          matching: find.byType(Card),
        ),
        matching: find.text('7'),
      ),
      findsOneWidget,
    );
    final Size firstCard = tester.getSize(
      find.ancestor(
        of: find.text('Anggota'),
        matching: find.byType(Card),
      ),
    );
    final Size lastCard = tester.getSize(
      find.ancestor(
        of: find.text('Periode'),
        matching: find.byType(Card),
      ),
    );
    expect(lastCard.width, greaterThan(firstCard.width * 1.8));
    expect(lastCard.height, firstCard.height);
    expect(tester.takeException(), isNull);
  });
}
