import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:laci_mobile/app/providers.dart';
import 'package:laci_mobile/core/errors/app_exception.dart';
import 'package:laci_mobile/features/admin/presentation/activity_logs_page.dart';
import 'package:laci_mobile/features/admin/presentation/email_logs_page.dart';
import 'package:laci_mobile/features/admin/presentation/users_page.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/test_doubles.dart';

const AppUser _cabangUser = AppUser(
  id: 'cabang-1',
  name: 'Sekretaris Cabang',
  email: 'cabang@example.test',
  role: UserRole.cabang,
  isActive: true,
  emailVerified: true,
);

const AppUser _pacUser = AppUser(
  id: 'pac-1',
  name: 'Sekretaris PAC',
  email: 'pac@example.test',
  role: UserRole.pac,
  isActive: true,
  emailVerified: true,
);

void main() {
  late MockApiClient apiClient;
  late StreamController<Uint8List> realtimeStream;

  setUpAll(() => initializeDateFormatting('id_ID'));

  setUp(() {
    apiClient = MockApiClient();
    realtimeStream = StreamController<Uint8List>();
    when(() => apiClient.openEventStream('/realtime')).thenAnswer(
      (_) async => ResponseBody(realtimeStream.stream, 200),
    );
  });

  tearDown(() async {
    if (!realtimeStream.isClosed) await realtimeStream.close();
  });

  testWidgets('statistik Users menampilkan akun yang belum verifikasi',
      (WidgetTester tester) async {
    when(() => apiClient.get('/users', query: any(named: 'query'))).thenAnswer(
      (_) async => _pageResponse(const <Map<String, dynamic>>[]),
    );
    when(() => apiClient.get('/users/stats')).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          'total': 8,
          'aktif': 7,
          'nonaktif': 1,
          'terverifikasi': 5,
          'belumVerifikasi': 3,
        },
      },
    );

    await tester.pumpWidget(_testApp(apiClient, const UsersPage()));
    await tester.pumpAndSettle();

    expect(find.text('Belum verifikasi'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('statistik Activity Cabang menampilkan seluruh modul FE',
      (WidgetTester tester) async {
    _stubActivityList(apiClient, items: const <Map<String, dynamic>>[]);
    when(() => apiClient.get('/directory/users', query: any(named: 'query')))
        .thenAnswer(
      (_) async => <String, dynamic>{'data': <Map<String, dynamic>>[]},
    );
    when(() =>
            apiClient.get('/activity-logs/stats', query: any(named: 'query')))
        .thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          'TOTAL': 11,
          'ARSIP_SURAT': 1,
          'ANGGOTA': 2,
          'BERKAS_PIMPINAN': 3,
          'BERKAS_SP': 4,
          'AGENDA_KEGIATAN': 5,
          'PENGAJUAN_BERKAS': 6,
          'PERIODE': 7,
          'USER': 8,
          'AUTH': 8,
          'WILAYAH': 9,
          'PRESENSI': 10,
        },
      },
    );

    await tester.pumpWidget(
      _testApp(apiClient, const ActivityLogsPage(user: _cabangUser)),
    );
    await tester.pumpAndSettle();

    for (final String label in <String>[
      'Semua aktivitas',
      'Arsip surat',
      'Anggota',
      'Berkas pimpinan',
      'Berkas SP',
      'Kegiatan',
      'Pengajuan PAC',
      'Periode',
      'Pengguna & profil',
      'Autentikasi',
      'Wilayah',
      'Presensi',
    ]) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
  });

  testWidgets('tab Semua PAC memakai cakupan dan pemilih PAC yang rapi',
      (WidgetTester tester) async {
    _useTallView(tester);
    _stubActivityList(apiClient, items: const <Map<String, dynamic>>[]);
    when(() => apiClient.get('/directory/users', query: any(named: 'query')))
        .thenAnswer(
      (_) async => <String, dynamic>{
        'data': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'pac-karangrejo',
            'name': 'PAC Karangrejo',
            'email': 'karangrejo@example.test',
          },
        ],
      },
    );
    when(() =>
            apiClient.get('/activity-logs/stats', query: any(named: 'query')))
        .thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{'TOTAL': 0},
      },
    );
    when(() => apiClient.get('/activity-logs/monitoring',
        query: any(named: 'query'))).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          'distribution': <Map<String, dynamic>>[
            <String, dynamic>{'name': 'AUTH', 'value': 25},
            <String, dynamic>{'name': 'ANGGOTA', 'value': 9},
            <String, dynamic>{'name': 'ARSIP_SURAT', 'value': 3},
            <String, dynamic>{'name': 'BERKAS_SP', 'value': 1},
            <String, dynamic>{'name': 'PRESENSI', 'value': 1},
          ],
          'timeline': <Map<String, dynamic>>[
            <String, dynamic>{'date': '2026-08-27', 'count': 5},
          ],
          'leaderboard': <Map<String, dynamic>>[
            <String, dynamic>{'name': 'PAC Karangrejo', 'count': 7},
          ],
        },
      },
    );

    await tester.pumpWidget(
      _testApp(apiClient, const ActivityLogsPage(user: _cabangUser)),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Semua PAC'));
    await tester.pumpAndSettle();

    expect(find.text('Cakupan aktivitas'), findsOneWidget);
    expect(
      find.text('Pantau seluruh PAC atau pilih satu akun.'),
      findsOneWidget,
    );
    expect(find.text('PAC yang dipantau'), findsOneWidget);
    expect(find.text('Semua pengguna PAC'), findsOneWidget);
    expect(find.text('Aktivitas 7 hari terakhir'), findsOneWidget);
    final double firstMetricWidth = tester
        .getSize(find.byKey(const ValueKey<String>('monitoring-metric-AUTH')))
        .width;
    final double lastMetricWidth = tester
        .getSize(
          find.byKey(const ValueKey<String>('monitoring-metric-PRESENSI')),
        )
        .width;
    expect(lastMetricWidth, greaterThan(firstMetricWidth * 1.8));
    expect(tester.takeException(), isNull);
  });

  testWidgets('detail Activity merender identitas entitas dan klien lengkap',
      (WidgetTester tester) async {
    _useTallView(tester);
    _stubActivityList(
      apiClient,
      items: <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'log-1',
          'action': 'CREATE',
          'module': 'ARSIP_SURAT',
          'description': 'Membuat arsip surat',
          'createdAt': '2026-08-24T08:00:00Z',
          'user': <String, dynamic>{'name': 'Sekretaris PAC'},
        },
      ],
    );
    when(() =>
            apiClient.get('/activity-logs/stats', query: any(named: 'query')))
        .thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{'TOTAL': 1, 'ARSIP_SURAT': 1},
      },
    );
    when(() => apiClient.get('/activity-logs/log-1')).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          'id': 'log-1',
          'action': 'CREATE',
          'module': 'ARSIP_SURAT',
          'description': 'Membuat arsip surat',
          'entityId': 'arsip-42',
          'createdAt': '2026-08-24T08:00:00Z',
          'device': 'Android',
          'browser': 'Laci Mobile',
          'ipAddress': '127.0.0.1',
          'location': '-7.1,110.4',
          'userAgent': 'Laci Mobile/1.0 (Android)',
          'periode': <String, dynamic>{'nama': '2025–2027'},
          'user': <String, dynamic>{
            'name': 'Sekretaris PAC',
            'email': 'pac@example.test',
            'role': 'SEKRETARIS_PAC',
          },
        },
      },
    );

    await tester.pumpWidget(
      _testApp(apiClient, const ActivityLogsPage(user: _pacUser)),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Membuat arsip surat'));
    await tester.pumpAndSettle();

    expect(find.text('Entity ID'), findsOneWidget);
    expect(find.text('arsip-42'), findsOneWidget);
    expect(find.text('2025–2027'), findsOneWidget);
    expect(find.text('SEKRETARIS PAC'), findsOneWidget);
    expect(find.text('Laci Mobile/1.0 (Android)'), findsOneWidget);
  });

  testWidgets('retry Email gagal tetap memuat ulang retryCount dan error',
      (WidgetTester tester) async {
    _useTallView(tester);
    int listCalls = 0;
    when(() => apiClient.get('/email-logs', query: any(named: 'query')))
        .thenAnswer((_) async {
      listCalls++;
      final bool retried = listCalls > 1;
      return _pageResponse(<Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'email-1',
          'to': 'pac@example.test',
          'subject': 'Percobaan gagal',
          'type': 'VERIFICATION',
          'status': 'FAILED',
          'retryCount': retried ? 1 : 0,
          'errorMessage': retried ? 'SMTP masih tidak tersedia' : 'SMTP mati',
          'createdAt': '2026-08-24T08:00:00Z',
          'updatedAt': '2026-08-24T08:01:00Z',
        },
      ]);
    });
    when(() => apiClient.get('/email-logs/stats')).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          'totalAll': 1,
          'totalToday': 1,
          'totalSent': 0,
          'totalFailed': 1,
        },
      },
    );
    when(() => apiClient.post('/email-logs/email-1/retry')).thenThrow(
      const AppException(
        statusCode: 409,
        code: 'EMAIL_RETRY_FAILED',
        message: 'SMTP masih tidak tersedia',
      ),
    );

    await tester.pumpWidget(_testApp(apiClient, const EmailLogsPage()));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Kirim ulang'));
    await tester.pumpAndSettle();

    expect(listCalls, 2);

    await tester.tap(find.text('Percobaan gagal'));
    await tester.pumpAndSettle();
    final Finder detailSheet = find.byType(BottomSheet);
    expect(
      find.descendant(of: detailSheet, matching: find.text('1')),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: detailSheet,
        matching: find.text('SMTP masih tidak tersedia'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('rincian jenis Email memakai grid rapi tanpa slot kosong',
      (WidgetTester tester) async {
    _useTallView(tester);
    when(() => apiClient.get('/email-logs', query: any(named: 'query')))
        .thenAnswer((_) async => _pageResponse(const <Map<String, dynamic>>[]));
    when(() => apiClient.get('/email-logs/stats')).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          'totalAll': 255,
          'totalToday': 0,
          'totalSent': 252,
          'totalFailed': 3,
          'byType': <String, dynamic>{
            'PENGAJUAN_ADMIN': 49,
            'PENGAJUAN_STATUS': 37,
            'PENGAJUAN_USER': 49,
            'VERIFICATION': 96,
            'VERIFIED_SUCCESS': 24,
          },
        },
      },
    );

    await tester.pumpWidget(_testApp(apiClient, const EmailLogsPage()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Rincian jenis email'));
    await tester.pumpAndSettle();

    final double firstMetricWidth = tester
        .getSize(
          find.byKey(const ValueKey<String>('email-type-PENGAJUAN_ADMIN')),
        )
        .width;
    final double lastMetricWidth = tester
        .getSize(
          find.byKey(const ValueKey<String>('email-type-VERIFIED_SUCCESS')),
        )
        .width;
    expect(lastMetricWidth, greaterThan(firstMetricWidth * 1.8));
    expect(find.text('Verifikasi sukses'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Widget _testApp(MockApiClient apiClient, Widget page) => ProviderScope(
      overrides: <Override>[
        apiClientProvider.overrideWithValue(apiClient),
      ],
      child: MaterialApp(home: page),
    );

Map<String, dynamic> _pageResponse(List<Map<String, dynamic>> items) =>
    <String, dynamic>{
      'data': items,
      'pagination': <String, dynamic>{
        'page': 1,
        'totalPages': 1,
        'total': items.length,
      },
    };

void _stubActivityList(
  MockApiClient apiClient, {
  required List<Map<String, dynamic>> items,
}) {
  when(() => apiClient.get('/activity-logs', query: any(named: 'query')))
      .thenAnswer((_) async => _pageResponse(items));
}

void _useTallView(WidgetTester tester) {
  tester.view
    ..physicalSize = const Size(1080, 3000)
    ..devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}
