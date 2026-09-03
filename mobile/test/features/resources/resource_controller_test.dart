import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/core/errors/app_exception.dart';
import 'package:laci_mobile/features/resources/application/resource_controller.dart';
import 'package:laci_mobile/features/resources/data/resource_repository.dart';
import 'package:laci_mobile/features/resources/domain/resource_definition.dart';
import 'package:laci_mobile/features/resources/domain/resource_definitions.dart';
import 'package:laci_mobile/features/resources/domain/resource_models.dart';
import 'package:mocktail/mocktail.dart';

class _MockResourceDataSource extends Mock implements ResourceDataSource {}

void main() {
  setUpAll(() {
    registerFallbackValue(const ResourceQuery());
    registerFallbackValue(
      const ResourceDraft(values: <String, dynamic>{}),
    );
  });

  late _MockResourceDataSource repository;
  late ResourceController controller;

  ResourcePageData page(String id) => ResourcePageData(
        items: <ResourceItem>[
          ResourceItem(<String, dynamic>{
            'id': id,
            'perihal': 'Surat undangan',
          }),
        ],
        pagination: const ResourcePagination(
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        ),
      );

  setUp(() {
    repository = _MockResourceDataSource();
    controller = ResourceController(
      definition: arsipResource,
      scope: ResourceScope.mine,
      initialFilters: const <String, String>{'jenisSurat': 'MASUK'},
      repository: repository,
    );
  });

  tearDown(() => controller.dispose());

  void stubLoad({String id = 'arsip-1'}) {
    when(
      () => repository.list(
        arsipResource,
        any<ResourceQuery>(),
      ),
    ).thenAnswer((_) async => page(id));
    when(
      () => repository.stats(
        arsipResource,
        any<ResourceQuery>(),
      ),
    ).thenAnswer(
      (_) async => ResourceStats(<String, dynamic>{'total': 1, 'masuk': 1}),
    );
  }

  test('starts with definition sort and menu-provided filters', () {
    expect(controller.state.query.sortKey, 'tanggal');
    expect(controller.state.query.sortAscending, isFalse);
    expect(controller.state.query.filters['jenisSurat'], 'MASUK');
  });

  test('keeps menu-provided filters immutable across apply and reset',
      () async {
    stubLoad();

    await controller.replaceFilters(
      const <String, String>{'jenisSurat': 'KELUAR', 'organisasi': 'IPNU'},
    );
    expect(controller.state.query.filters, <String, String>{
      'jenisSurat': 'MASUK',
      'organisasi': 'IPNU',
    });

    await controller.replaceFilters(const <String, String>{});
    expect(
      controller.state.query.filters,
      const <String, String>{'jenisSurat': 'MASUK'},
    );
  });

  test('member resource starts on the pending workflow tab', () {
    final ResourceController members = ResourceController(
      definition: anggotaResource,
      scope: ResourceScope.mine,
      repository: repository,
    );
    addTearDown(members.dispose);

    expect(members.state.query.filters['status'], 'PENDING');
  });

  test('member filter reset keeps the active workflow tab', () async {
    final ResourceController members = ResourceController(
      definition: anggotaResource,
      scope: ResourceScope.mine,
      repository: repository,
    );
    addTearDown(members.dispose);
    when(
      () => repository.list(anggotaResource, any<ResourceQuery>()),
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
      () => repository.stats(anggotaResource, any<ResourceQuery>()),
    ).thenAnswer((_) async => ResourceStats(<String, dynamic>{'total': 0}));

    await members.setFilter('status', 'DITOLAK');
    await members.replaceFilters(const <String, String>{});

    expect(members.state.query.filters, const <String, String>{
      'status': 'DITOLAK',
    });
  });

  test('loads list and stats as one ready state', () async {
    stubLoad();

    await controller.load();

    expect(controller.state.phase, ResourceLoadPhase.ready);
    expect(controller.state.items.single.id, 'arsip-1');
    expect(controller.state.stats?.count('masuk'), 1);
    expect(controller.state.errorMessage, isNull);
  });

  test('search resets pagination and reloads the server query', () async {
    stubLoad();
    await controller.load();
    clearInteractions(repository);
    stubLoad(id: 'arsip-search');

    await controller.setSearch('undangan');

    final ResourceQuery query = verify(
      () => repository.list(
        arsipResource,
        captureAny<ResourceQuery>(),
      ),
    ).captured.single as ResourceQuery;
    expect(query.search, 'undangan');
    expect(query.page, 1);
    expect(controller.state.items.single.id, 'arsip-search');
  });

  test('keeps a useful API error for the empty failure state', () async {
    when(
      () => repository.list(arsipResource, any<ResourceQuery>()),
    ).thenThrow(
      const AppException(
        code: 'NO_ACTIVE_PERIOD',
        message: 'Belum ada periode aktif.',
      ),
    );
    when(
      () => repository.stats(arsipResource, any<ResourceQuery>()),
    ).thenAnswer((_) async => ResourceStats(<String, dynamic>{}));

    await controller.load();

    expect(controller.state.phase, ResourceLoadPhase.failure);
    expect(controller.state.errorMessage, 'Belum ada periode aktif.');
  });

  test('create mutation reloads data and always clears busy state', () async {
    stubLoad(id: 'created-1');
    when(
      () => repository.create(
        arsipResource,
        any<ResourceDraft>(),
      ),
    ).thenAnswer(
      (_) async => ResourceItem(<String, dynamic>{
        'id': 'created-1',
        'perihal': 'Surat baru',
      }),
    );
    final ResourceItem result = await controller.create(
      const ResourceDraft(values: <String, dynamic>{'perihal': 'Surat baru'}),
    );

    expect(result.id, 'created-1');
    expect(controller.state.isMutating, isFalse);
    expect(controller.state.items.single.id, 'created-1');
    verify(
      () => repository.create(arsipResource, any<ResourceDraft>()),
    ).called(1);
  });
}
