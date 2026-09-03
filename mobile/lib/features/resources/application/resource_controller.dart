import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_exception.dart';
import '../data/resource_file_actions.dart';
import '../data/resource_repository.dart';
import '../data/resource_spreadsheet_service.dart';
import '../domain/resource_definition.dart';
import '../domain/resource_definitions.dart';
import '../domain/resource_models.dart';

enum ResourceLoadPhase { initial, loading, ready, failure }

class ResourceState {
  const ResourceState({
    required this.query,
    this.phase = ResourceLoadPhase.initial,
    this.items = const <ResourceItem>[],
    this.stats,
    this.pagination,
    this.errorMessage,
    this.isMutating = false,
  });

  factory ResourceState.initial(
    ResourceDefinition definition,
    ResourceScope scope,
    Map<String, String> initialFilters,
  ) =>
      ResourceState(
        query: ResourceQuery(
          scope: scope,
          filters: Map<String, String>.unmodifiable(<String, String>{
            ...definition.defaultFilters,
            ...initialFilters,
          }),
          sortKey: definition.defaultSortKey,
          sortAscending: definition.defaultSortAscending,
        ),
      );

  final ResourceLoadPhase phase;
  final ResourceQuery query;
  final List<ResourceItem> items;
  final ResourceStats? stats;
  final ResourcePagination? pagination;
  final String? errorMessage;
  final bool isMutating;

  bool get isInitialLoading =>
      (phase == ResourceLoadPhase.initial ||
          phase == ResourceLoadPhase.loading) &&
      items.isEmpty;

  bool get isRefreshing =>
      phase == ResourceLoadPhase.loading && items.isNotEmpty;

  ResourceState copyWith({
    ResourceLoadPhase? phase,
    ResourceQuery? query,
    List<ResourceItem>? items,
    ResourceStats? stats,
    ResourcePagination? pagination,
    String? errorMessage,
    bool clearError = false,
    bool? isMutating,
  }) =>
      ResourceState(
        phase: phase ?? this.phase,
        query: query ?? this.query,
        items: items ?? this.items,
        stats: stats ?? this.stats,
        pagination: pagination ?? this.pagination,
        errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
        isMutating: isMutating ?? this.isMutating,
      );
}

class ResourceControllerArgs {
  const ResourceControllerArgs({
    required this.resourceKey,
    this.scope = ResourceScope.mine,
    this.initialFilters = const <String, String>{},
  });

  final String resourceKey;
  final ResourceScope scope;
  final Map<String, String> initialFilters;

  @override
  bool operator ==(Object other) =>
      other is ResourceControllerArgs &&
      other.resourceKey == resourceKey &&
      other.scope == scope &&
      _sameFilters(other.initialFilters, initialFilters);

  @override
  int get hashCode {
    final List<String> entries = initialFilters.entries
        .map<String>(
          (MapEntry<String, String> entry) => '${entry.key}=${entry.value}',
        )
        .toList(growable: false)
      ..sort();
    return Object.hash(resourceKey, scope, Object.hashAll(entries));
  }

  static bool _sameFilters(
    Map<String, String> left,
    Map<String, String> right,
  ) {
    if (left.length != right.length) return false;
    for (final MapEntry<String, String> entry in left.entries) {
      if (right[entry.key] != entry.value) return false;
    }
    return true;
  }
}

class ResourceController extends StateNotifier<ResourceState> {
  ResourceController({
    required ResourceDefinition definition,
    required ResourceScope scope,
    Map<String, String> initialFilters = const <String, String>{},
    required ResourceDataSource repository,
  })  : _definition = definition,
        _repository = repository,
        _initialFilters = Map<String, String>.unmodifiable(initialFilters),
        super(ResourceState.initial(definition, scope, initialFilters));

  final ResourceDefinition _definition;
  final ResourceDataSource _repository;
  final Map<String, String> _initialFilters;
  int _requestGeneration = 0;

  Future<void> load() async {
    final int generation = ++_requestGeneration;
    state = state.copyWith(
      phase: ResourceLoadPhase.loading,
      clearError: true,
    );
    try {
      final List<Object> results = await Future.wait<Object>(<Future<Object>>[
        _repository.list(_definition, state.query),
        _repository.stats(_definition, state.query),
      ]);
      if (!mounted || generation != _requestGeneration) return;
      final ResourcePageData page = results[0] as ResourcePageData;
      state = state.copyWith(
        phase: ResourceLoadPhase.ready,
        items: page.items,
        pagination: page.pagination,
        stats: results[1] as ResourceStats,
        clearError: true,
      );
    } on Object catch (error) {
      if (!mounted || generation != _requestGeneration) return;
      state = state.copyWith(
        phase: ResourceLoadPhase.failure,
        errorMessage: _errorMessage(error),
      );
    }
  }

  Future<void> refresh() => load();

  Future<void> setSearch(String value) async {
    state = state.copyWith(query: state.query.copyWith(search: value, page: 1));
    await load();
  }

  Future<void> setFilter(String key, String value) async {
    if (_initialFilters.containsKey(key)) return;
    final Map<String, String> filters =
        Map<String, String>.from(state.query.filters);
    if (value.isEmpty || value == 'ALL') {
      filters.remove(key);
    } else {
      filters[key] = value;
    }
    state = state.copyWith(
      query: state.query.copyWith(filters: filters, page: 1),
    );
    await load();
  }

  Future<void> replaceFilters(Map<String, String> values) async {
    final Map<String, String> filters = <String, String>{
      ...Map<String, String>.fromEntries(
        values.entries.where(
          (MapEntry<String, String> entry) =>
              entry.value.isNotEmpty && entry.value != 'ALL',
        ),
      ),
      ..._initialFilters,
    };
    // Status anggota adalah workflow tab, bukan filter biasa. Reset filter
    // harus mempertahankan tab yang sedang dibuka dan tidak kembali ke semua.
    if (_definition.key == 'anggota' && !filters.containsKey('status')) {
      filters['status'] = state.query.filters['status'] ??
          _definition.defaultFilters['status'] ??
          'PENDING';
    }
    state = state.copyWith(
      query: state.query.copyWith(filters: filters, page: 1),
    );
    await load();
  }

  Future<void> setSort(String? key, {bool? ascending}) async {
    state = state.copyWith(
      query: state.query.copyWith(
        sortKey: key,
        clearSort: key == null,
        sortAscending: ascending,
        page: 1,
      ),
    );
    await load();
  }

  Future<void> goToPage(int page) async {
    final int totalPages = state.pagination?.totalPages ?? 1;
    if (page < 1 || page > totalPages || page == state.query.page) return;
    state = state.copyWith(query: state.query.copyWith(page: page));
    await load();
  }

  Future<ResourceItem> create(ResourceDraft draft) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      final ResourceItem result = await _repository.create(_definition, draft);
      await load();
      return result;
    } finally {
      if (mounted) state = state.copyWith(isMutating: false);
    }
  }

  Future<ResourceItem> update(String id, ResourceDraft draft) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      final ResourceItem result =
          await _repository.update(_definition, id, draft);
      await load();
      return result;
    } finally {
      if (mounted) state = state.copyWith(isMutating: false);
    }
  }

  Future<String> delete(String id) => _mutateAndReload(
        () => _repository.delete(_definition, id),
      );

  Future<String> verifyMember(
    String id,
    String status, {
    String? reason,
  }) =>
      _mutateAndReload(
        () => _repository.updateMemberStatus(id, status, reason: reason),
      );

  Future<String> reviewApplication(
    String id,
    String status, {
    String? reason,
  }) =>
      _mutateAndReload(
        () => _repository.updateApplicationStatus(id, status, reason: reason),
      );

  Future<String> copyMembers({
    required List<String> ids,
    required String sourcePeriodId,
    required String targetPeriodId,
  }) =>
      _mutateAndReload(
        () => _repository.copyMembers(
          ids: ids,
          sourcePeriodId: sourcePeriodId,
          targetPeriodId: targetPeriodId,
        ),
      );

  Future<String> copyWilayah({
    required List<String> ids,
    required String type,
  }) =>
      _mutateAndReload(
        () => _repository.copyWilayah(ids: ids, type: type),
      );

  Future<String> _mutateAndReload(Future<String> Function() operation) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      final String message = await operation();
      await load();
      return message;
    } finally {
      if (mounted) state = state.copyWith(isMutating: false);
    }
  }

  String _errorMessage(Object error) =>
      error is AppException ? error.message : 'Data tidak dapat dimuat.';
}

final Provider<ResourceDataSource> resourceRepositoryProvider =
    Provider<ResourceDataSource>(
  (Ref<ResourceDataSource> ref) =>
      ResourceRepository(ref.watch(apiClientProvider)),
);

final Provider<ResourceFileActions> resourceFileActionsProvider =
    Provider<ResourceFileActions>(
  (Ref<ResourceFileActions> ref) =>
      ResourceFileActions(ref.watch(resourceRepositoryProvider)),
);

final Provider<ResourceSpreadsheetService> resourceSpreadsheetServiceProvider =
    Provider<ResourceSpreadsheetService>(
  (Ref<ResourceSpreadsheetService> ref) => const ResourceSpreadsheetService(),
);

final Provider<ResourceSpreadsheetFileActions>
    resourceSpreadsheetFileActionsProvider =
    Provider<ResourceSpreadsheetFileActions>(
  (Ref<ResourceSpreadsheetFileActions> ref) =>
      const ResourceSpreadsheetFileActions(),
);

final AutoDisposeFutureProvider<List<ResourcePeriodRef>>
    resourcePeriodsProvider =
    FutureProvider.autoDispose<List<ResourcePeriodRef>>(
  (ref) => ref.watch(resourceRepositoryProvider).periods(),
);

final AutoDisposeFutureProvider<List<ResourceDirectoryUser>>
    resourcePacDirectoryProvider =
    FutureProvider.autoDispose<List<ResourceDirectoryUser>>(
  (ref) => ref.watch(resourceRepositoryProvider).pacDirectory(),
);

final AutoDisposeStateNotifierProviderFamily<ResourceController, ResourceState,
        ResourceControllerArgs> resourceControllerProvider =
    StateNotifierProvider.autoDispose
        .family<ResourceController, ResourceState, ResourceControllerArgs>(
  (
    Ref<ResourceState> ref,
    ResourceControllerArgs arguments,
  ) {
    final ResourceController controller = ResourceController(
      definition: resourceDefinitionFor(arguments.resourceKey),
      scope: arguments.scope,
      initialFilters: arguments.initialFilters,
      repository: ref.watch(resourceRepositoryProvider),
    );
    Future<void>.microtask(controller.load);
    return controller;
  },
);
