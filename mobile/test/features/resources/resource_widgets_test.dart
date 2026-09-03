import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:laci_mobile/core/storage/secure_store.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:laci_mobile/features/periods/application/period_controller.dart';
import 'package:laci_mobile/features/periods/data/period_repository.dart';
import 'package:laci_mobile/features/periods/domain/app_period.dart';
import 'package:laci_mobile/features/resources/application/resource_controller.dart';
import 'package:laci_mobile/features/resources/data/resource_repository.dart';
import 'package:laci_mobile/features/resources/domain/resource_definition.dart';
import 'package:laci_mobile/features/resources/domain/resource_definitions.dart';
import 'package:laci_mobile/features/resources/domain/resource_models.dart';
import 'package:laci_mobile/features/resources/presentation/resource_detail_page.dart';
import 'package:laci_mobile/features/resources/presentation/resource_form_page.dart';
import 'package:laci_mobile/features/resources/presentation/resource_list_page.dart';
import 'package:laci_mobile/features/resources/presentation/widgets/presensi_qr_card.dart';
import 'package:laci_mobile/features/resources/presentation/widgets/resource_widgets.dart';
import 'package:mocktail/mocktail.dart';
import 'package:qr_flutter/qr_flutter.dart';

class _MockResourceDataSource extends Mock implements ResourceDataSource {}

class _MockPeriodRepository extends Mock implements PeriodRepository {}

class _MockSecureStore extends Mock implements AppSecureStore {}

void main() {
  const AppUser pac = AppUser(
    id: 'pac-1',
    name: 'PAC Barat',
    email: 'pac@example.test',
    role: UserRole.pac,
    isActive: true,
    emailVerified: true,
  );
  const AppUser cabang = AppUser(
    id: 'cabang-1',
    name: 'Sekretaris Cabang',
    email: 'cabang@example.test',
    role: UserRole.cabang,
    isActive: true,
    emailVerified: true,
  );
  const AppPeriod activePeriod = AppPeriod(
    id: 'period-1',
    name: 'Masa Khidmat 2026–2028',
    isActive: true,
  );
  const AppPeriod historicalPeriod = AppPeriod(
    id: 'period-history',
    name: 'Masa Khidmat 2024–2026',
    isActive: false,
  );

  setUpAll(() async {
    await initializeDateFormatting('id_ID');
    registerFallbackValue(const ResourceQuery());
    registerFallbackValue(
      const ResourceDraft(values: <String, dynamic>{}),
    );
  });

  testWidgets('dynamic form reports required fields before submitting',
      (WidgetTester tester) async {
    final _MockResourceDataSource repository = _MockResourceDataSource();
    when(
      () => repository.list(wilayahResource, any<ResourceQuery>()),
    ).thenAnswer(
      (_) async => const ResourcePageData(
        items: <ResourceItem>[],
        pagination: ResourcePagination(
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        ),
      ),
    );
    when(
      () => repository.stats(wilayahResource, any<ResourceQuery>()),
    ).thenAnswer(
      (_) async => ResourceStats(<String, dynamic>{'total': 0}),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          resourceRepositoryProvider.overrideWithValue(repository),
        ],
        child: const MaterialApp(
          home: ResourceFormPage(
            definition: wilayahResource,
            user: pac,
            controllerArgs: ResourceControllerArgs(resourceKey: 'wilayah'),
            activePeriod: activePeriod,
          ),
        ),
      ),
    );
    await tester.pump();

    final Scaffold formScaffold = tester.widget<Scaffold>(
      find.byType(Scaffold),
    );
    expect(formScaffold.bottomNavigationBar, isNull);

    await tester.scrollUntilVisible(
      find.text('Simpan'),
      240,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Simpan'));
    await tester.pump();

    expect(find.text('Jenis wilayah wajib dipilih.'), findsOneWidget);
    expect(find.text('Nama wilayah wajib diisi.'), findsOneWidget);
    expect(find.text('Masa Khidmat 2026–2028'), findsNothing);
    verifyNever(
      () => repository.create(
        wilayahResource,
        any<ResourceDraft>(),
      ),
    );
  });

  testWidgets('tiga statistik memenuhi lebar dan menu template tidak tampil',
      (WidgetTester tester) async {
    tester.view
      ..physicalSize = const Size(390, 844)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final _MockResourceDataSource repository = _MockResourceDataSource();
    final _MockPeriodRepository periodRepository = _MockPeriodRepository();
    final _MockSecureStore secureStore = _MockSecureStore();
    when(periodRepository.list)
        .thenAnswer((_) async => const <AppPeriod>[activePeriod]);
    when(secureStore.readViewPeriod).thenAnswer((_) async => null);
    when(
      () => repository.list(berkasSpResource, any<ResourceQuery>()),
    ).thenAnswer(
      (_) async => const ResourcePageData(
        items: <ResourceItem>[],
        pagination: ResourcePagination(
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        ),
      ),
    );
    when(
      () => repository.stats(berkasSpResource, any<ResourceQuery>()),
    ).thenAnswer(
      (_) async => ResourceStats(<String, dynamic>{
        'total': 16,
        'ipnu': 12,
        'ippnu': 4,
      }),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          resourceRepositoryProvider.overrideWithValue(repository),
          periodControllerProvider.overrideWith(
            (Ref<PeriodState> ref) =>
                PeriodController(periodRepository, secureStore),
          ),
        ],
        child: const MaterialApp(
          home: ResourceListPage(
            definition: berkasSpResource,
            user: cabang,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final Finder total = find.byKey(
      const ValueKey<String>('resource-stat-total'),
    );
    final Finder ipnu = find.byKey(
      const ValueKey<String>('resource-stat-ipnu'),
    );
    final Finder ippnu = find.byKey(
      const ValueKey<String>('resource-stat-ippnu'),
    );
    final Size totalSize = tester.getSize(total);
    expect(tester.getSize(ipnu).width, closeTo(totalSize.width, .1));
    expect(tester.getSize(ippnu).width, closeTo(totalSize.width, .1));
    expect(totalSize.width, greaterThan(105));

    await tester.tap(find.byTooltip('Aksi Excel'));
    await tester.pumpAndSettle();
    expect(find.text('Import Excel'), findsOneWidget);
    expect(find.text('Export Excel'), findsOneWidget);
    expect(find.text('Unduh template'), findsNothing);
  });

  testWidgets('resource card renders folder accent and readable metadata',
      (WidgetTester tester) async {
    final ResourceItem item = ResourceItem(<String, dynamic>{
      'id': 'p-1',
      'keperluan': 'Permohonan izin kegiatan',
      'noSurat': '001/PAC/VIII/2026',
      'penerima': 'CBP_KPP',
      'status': 'PENDING',
      'user': <String, dynamic>{'name': 'PAC Barat'},
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ResourceCard(
            definition: pengajuanResource,
            item: item,
            accent: Colors.green,
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('Permohonan izin kegiatan'), findsOneWidget);
    expect(find.text('Menunggu'), findsOneWidget);
    expect(find.textContaining('001/PAC/VIII/2026'), findsOneWidget);
    expect(find.textContaining('PAC Barat'), findsOneWidget);
    expect(find.byType(InkWell), findsWidgets);
  });

  testWidgets('resource card keeps end time and participant count visible',
      (WidgetTester tester) async {
    final ResourceItem item = ResourceItem(<String, dynamic>{
      'id': 'attendance-1',
      'namaKegiatan': 'Rapat pleno',
      'penyelenggara': 'PC IPNU IPPNU Magetan',
      'tempat': 'Aula PCNU',
      'tanggal': '2026-08-24T00:00:00Z',
      'jamMulai': '08:00',
      'jamSelesai': '12:30',
      'isActive': false,
      '_count': <String, dynamic>{'dataPresensi': 17},
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ResourceCard(
            definition: presensiResource,
            item: item,
            accent: Colors.green,
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('Tertutup'), findsOneWidget);
    expect(find.textContaining('12:30'), findsOneWidget);
    expect(find.textContaining('17 peserta'), findsOneWidget);
  });

  testWidgets('resource card does not render empty status or metadata',
      (WidgetTester tester) async {
    final ResourceItem item = ResourceItem(<String, dynamic>{
      'id': 'sp-1',
      'nama': 'PK IPNU Tarbiyatul Ulum',
      'status': '   ',
      'catatan': '',
      'organisasi': 'IPNU',
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ResourceCard(
            definition: berkasSpResource,
            item: item,
            accent: Colors.blue,
            onTap: () {},
          ),
        ),
      ),
    );

    expect(find.byType(ResourceStatusBadge), findsNothing);
    expect(find.textContaining('Catatan:'), findsNothing);
    expect(find.textContaining('Organisasi: IPNU'), findsOneWidget);
  });

  testWidgets('resource list directs users to Periode when none is active',
      (WidgetTester tester) async {
    final _MockResourceDataSource repository = _MockResourceDataSource();
    final _MockPeriodRepository periodRepository = _MockPeriodRepository();
    final _MockSecureStore secureStore = _MockSecureStore();
    when(periodRepository.list).thenAnswer((_) async => const <AppPeriod>[]);
    when(secureStore.readViewPeriod).thenAnswer((_) async => null);
    when(
      () => repository.list(wilayahResource, any<ResourceQuery>()),
    ).thenAnswer(
      (_) async => const ResourcePageData(
        items: <ResourceItem>[],
        pagination: ResourcePagination(
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        ),
      ),
    );
    when(
      () => repository.stats(wilayahResource, any<ResourceQuery>()),
    ).thenAnswer((_) async => ResourceStats(<String, dynamic>{'total': 0}));

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          resourceRepositoryProvider.overrideWithValue(repository),
          periodControllerProvider.overrideWith(
            (Ref<PeriodState> ref) =>
                PeriodController(periodRepository, secureStore),
          ),
        ],
        child: const MaterialApp(
          home: ResourceListPage(
            definition: wilayahResource,
            user: pac,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Periode aktif diperlukan'), findsOneWidget);
    expect(find.text('Kelola periode'), findsOneWidget);
    expect(find.byIcon(Icons.calendar_month_outlined), findsOneWidget);
    expect(find.text('Tambah Wilayah'), findsNothing);
  });

  testWidgets('copy wilayah keeps selections from every result page',
      (WidgetTester tester) async {
    final _MockResourceDataSource repository = _MockResourceDataSource();
    final _MockPeriodRepository periodRepository = _MockPeriodRepository();
    final _MockSecureStore secureStore = _MockSecureStore();
    when(periodRepository.list).thenAnswer(
      (_) async => const <AppPeriod>[activePeriod, historicalPeriod],
    );
    when(secureStore.readViewPeriod)
        .thenAnswer((_) async => historicalPeriod.id);
    when(
      () => repository.list(wilayahResource, any<ResourceQuery>()),
    ).thenAnswer((Invocation invocation) async {
      final ResourceQuery query =
          invocation.positionalArguments[1] as ResourceQuery;
      return ResourcePageData(
        items: <ResourceItem>[
          if (query.page == 1)
            ResourceItem(<String, dynamic>{
              'id': 'ranting-1',
              'jenis': 'RANTING',
              'nama': 'Ranting Barat',
            })
          else
            ResourceItem(<String, dynamic>{
              'id': 'pk-1',
              'jenis': 'PK',
              'nama': 'Komisariat Timur',
            }),
        ],
        pagination: ResourcePagination(
          page: query.page,
          limit: 10,
          total: 2,
          totalPages: 2,
        ),
      );
    });
    when(
      () => repository.stats(wilayahResource, any<ResourceQuery>()),
    ).thenAnswer((_) async => ResourceStats(<String, dynamic>{'total': 2}));
    when(
      () => repository.copyWilayah(
        ids: any(named: 'ids'),
        type: any(named: 'type'),
      ),
    ).thenAnswer((_) async => 'Wilayah berhasil disalin.');

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          resourceRepositoryProvider.overrideWithValue(repository),
          periodControllerProvider.overrideWith(
            (Ref<PeriodState> ref) =>
                PeriodController(periodRepository, secureStore),
          ),
        ],
        child: const MaterialApp(
          home: ResourceListPage(
            definition: wilayahResource,
            user: pac,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(Checkbox));
    await tester.pump();
    expect(find.text('1 dipilih'), findsOneWidget);
    expect(find.text('1 / 2'), findsOneWidget);

    await tester.ensureVisible(find.byTooltip('Halaman berikutnya'));
    await tester.tap(find.byTooltip('Halaman berikutnya'));
    await tester.pumpAndSettle();
    expect(find.text('Ranting Barat'), findsNothing);
    expect(find.text('Komisariat Timur'), findsOneWidget);
    expect(find.text('2 / 2'), findsOneWidget);

    await tester.tap(find.byType(Checkbox));
    await tester.pump();
    expect(find.text('2 dipilih'), findsOneWidget);

    await tester.tap(find.byTooltip('Salin ke periode aktif'));
    await tester.pumpAndSettle();
    expect(
      find.text(
        '2 wilayah akan disalin dari periode yang sedang dilihat ke periode aktif.',
      ),
      findsOneWidget,
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Salin'));
    await tester.pumpAndSettle();

    verify(
      () => repository.copyWilayah(
        ids: <String>['ranting-1'],
        type: 'RANTING',
      ),
    ).called(1);
    verify(
      () => repository.copyWilayah(
        ids: <String>['pk-1'],
        type: 'PK',
      ),
    ).called(1);
    expect(find.text('2 dipilih'), findsNothing);
  });

  testWidgets('resource detail omits the dashboard-only period context',
      (WidgetTester tester) async {
    final _MockResourceDataSource repository = _MockResourceDataSource();
    when(
      () => repository.detail(
        wilayahResource,
        'wilayah-1',
        scope: ResourceScope.mine,
      ),
    ).thenAnswer(
      (_) async => ResourceItem(<String, dynamic>{
        'id': 'wilayah-1',
        'jenis': 'RANTING',
        'nama': 'Ranting Karangrejo',
      }),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          resourceRepositoryProvider.overrideWithValue(repository),
        ],
        child: const MaterialApp(
          home: ResourceDetailPage(
            definition: wilayahResource,
            user: pac,
            itemId: 'wilayah-1',
            controllerArgs: ResourceControllerArgs(resourceKey: 'wilayah'),
            activePeriod: activePeriod,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Masa Khidmat 2026–2028'), findsNothing);
    expect(find.text('Ranting Karangrejo'), findsOneWidget);
  });

  testWidgets('resource detail hides empty values and raw file storage key',
      (WidgetTester tester) async {
    final _MockResourceDataSource repository = _MockResourceDataSource();
    when(
      () => repository.detail(
        berkasSpResource,
        'sp-1',
        scope: ResourceScope.mine,
      ),
    ).thenAnswer(
      (_) async => ResourceItem(<String, dynamic>{
        'id': 'sp-1',
        'nama': 'PK IPNU Tarbiyatul Ulum',
        'organisasi': 'IPNU',
        'tanggalMulai': '2026-11-22',
        'tanggalBerakhir': '2026-11-22',
        'status': '',
        'file': 'berkas-sp/file-rahasia-pdf.enc',
        'user': <String, dynamic>{'name': 'Sekretaris Cabang'},
      }),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          resourceRepositoryProvider.overrideWithValue(repository),
        ],
        child: const MaterialApp(
          home: ResourceDetailPage(
            definition: berkasSpResource,
            user: cabang,
            itemId: 'sp-1',
            controllerArgs: ResourceControllerArgs(resourceKey: 'berkas-sp'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final Scaffold detailScaffold = tester.widget<Scaffold>(
      find.byType(Scaffold),
    );
    expect(detailScaffold.bottomNavigationBar, isNull);

    expect(find.text('Status masa berlaku'), findsNothing);
    expect(find.textContaining('file-rahasia'), findsNothing);
    expect(find.text('File lampiran'), findsOneWidget);
    expect(find.text('Unduh'), findsOneWidget);
    expect(find.text('Aksi data'), findsNothing);
    expect(find.byTooltip('Aksi data'), findsOneWidget);

    await tester.tap(find.byTooltip('Aksi data'));
    await tester.pumpAndSettle();
    expect(find.text('Hapus'), findsOneWidget);
    expect(find.text('Edit'), findsOneWidget);
  });

  testWidgets('menu-scoped wilayah type is rendered as a locked value',
      (WidgetTester tester) async {
    final _MockResourceDataSource repository = _MockResourceDataSource();
    when(
      () => repository.list(wilayahResource, any<ResourceQuery>()),
    ).thenAnswer(
      (_) async => const ResourcePageData(
        items: <ResourceItem>[],
        pagination: ResourcePagination(
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        ),
      ),
    );
    when(
      () => repository.stats(wilayahResource, any<ResourceQuery>()),
    ).thenAnswer(
      (_) async => ResourceStats(<String, dynamic>{'total': 0}),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          resourceRepositoryProvider.overrideWithValue(repository),
        ],
        child: const MaterialApp(
          home: ResourceFormPage(
            definition: wilayahResource,
            user: pac,
            controllerArgs: ResourceControllerArgs(
              resourceKey: 'wilayah',
              initialFilters: <String, String>{'jenis': 'RANTING'},
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Ranting'), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline_rounded), findsOneWidget);
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);
  });

  testWidgets('presensi QR points to the public frontend form',
      (WidgetTester tester) async {
    final Uri uri =
        Uri.parse('https://laci.example.test/presensi/presensi-123');

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: PresensiQrCard(
              uri: uri,
              activityName: 'Rapat pleno',
            ),
          ),
        ),
      ),
    );

    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.text(uri.toString()), findsOneWidget);
    expect(find.text('Salin'), findsOneWidget);
    expect(find.text('Bagikan'), findsOneWidget);
    expect(find.text('Unduh QR'), findsOneWidget);
    expect(find.text('Buka form'), findsOneWidget);
  });

  test('presensi QR download uses a safe deterministic PNG name', () {
    expect(
      presensiQrFileName('Rapat: Pleno / Gabungan?'),
      'QR-Presensi-Rapat_Pleno_Gabungan.png',
    );
    expect(presensiQrFileName('   '), 'QR-Presensi-Kegiatan.png');
  });

  test('presensi QR renderer returns PNG bytes', () async {
    final List<int> bytes = await renderPresensiQrPng(
      Uri.parse('https://laci.example.test/presensi/presensi-123'),
      size: 256,
    );

    expect(
      bytes.take(8),
      <int>[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    );
  });
}
