import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/storage/secure_store.dart';
import '../../dashboard/application/dashboard_controller.dart';
import '../../resources/application/resource_controller.dart';
import '../data/period_repository.dart';
import '../domain/app_period.dart';

class PeriodState {
  const PeriodState({
    this.periods = const <AppPeriod>[],
    this.viewPeriodId,
    this.loading = false,
    this.mutating = false,
    this.error,
  });

  final List<AppPeriod> periods;
  final String? viewPeriodId;
  final bool loading;
  final bool mutating;
  final String? error;

  AppPeriod? get activePeriod {
    for (final AppPeriod period in periods) {
      if (period.isActive) return period;
    }
    return null;
  }

  AppPeriod? get viewPeriod {
    final String? id = viewPeriodId;
    if (id == null || id == activePeriod?.id) return null;
    for (final AppPeriod period in periods) {
      if (period.id == id) return period;
    }
    return null;
  }

  PeriodState copyWith({
    List<AppPeriod>? periods,
    String? viewPeriodId,
    bool clearViewPeriod = false,
    bool? loading,
    bool? mutating,
    String? error,
    bool clearError = false,
  }) =>
      PeriodState(
        periods: periods ?? this.periods,
        viewPeriodId:
            clearViewPeriod ? null : viewPeriodId ?? this.viewPeriodId,
        loading: loading ?? this.loading,
        mutating: mutating ?? this.mutating,
        error: clearError ? null : error ?? this.error,
      );
}

class PeriodController extends StateNotifier<PeriodState> {
  PeriodController(
    this._repository,
    this._store, {
    void Function()? onContextChanged,
  })  : _onContextChanged = onContextChanged,
        super(const PeriodState()) {
    load();
  }

  final PeriodRepository _repository;
  final AppSecureStore _store;
  final void Function()? _onContextChanged;

  Future<void> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final List<AppPeriod> periods = await _repository.list();
      final String? stored = await _store.readViewPeriod();
      final bool valid = stored != null &&
          periods.any((AppPeriod period) => period.id == stored);
      if (!valid && stored != null) await _store.writeViewPeriod(null);
      state = PeriodState(
        periods: periods,
        viewPeriodId: valid ? stored : null,
      );
    } catch (error) {
      state = state.copyWith(
        loading: false,
        error: _message(error),
      );
    }
  }

  Future<void> setViewPeriod(String? id) async {
    await _store.writeViewPeriod(id);
    state = state.copyWith(
      viewPeriodId: id,
      clearViewPeriod: id == null,
    );
    _onContextChanged?.call();
  }

  Future<String?> create(String name) => _mutation(
        () => _repository.create(name),
        'Periode berhasil dibuat.',
      );

  Future<String?> update(String id, String name) => _mutation(
        () => _repository.update(id, name),
        'Periode berhasil diperbarui.',
      );

  Future<String?> activate(String id) async {
    final String? result = await _mutation(
      () => _repository.activate(id),
      'Periode berhasil diaktifkan.',
    );
    if (result != null) await setViewPeriod(null);
    return result;
  }

  Future<String?> delete(String id) => _mutation(
        () => _repository.delete(id),
        'Periode berhasil dihapus.',
      );

  Future<String?> _mutation(
    Future<void> Function() operation,
    String success,
  ) async {
    state = state.copyWith(mutating: true, clearError: true);
    try {
      await operation();
      await load();
      _onContextChanged?.call();
      return success;
    } catch (error) {
      state = state.copyWith(mutating: false, error: _message(error));
      return null;
    }
  }

  String _message(Object error) =>
      error is AppException ? error.message : 'Periode tidak dapat diproses.';
}

final Provider<PeriodRepository> periodRepositoryProvider =
    Provider<PeriodRepository>(
  (Ref<PeriodRepository> ref) => PeriodRepository(
    ref.watch(apiClientProvider),
  ),
);

final AutoDisposeStateNotifierProvider<PeriodController, PeriodState>
    periodControllerProvider =
    StateNotifierProvider.autoDispose<PeriodController, PeriodState>(
  (ref) => PeriodController(
    ref.watch(periodRepositoryProvider),
    ref.watch(secureStoreProvider),
    onContextChanged: () {
      ref.invalidate(dashboardControllerProvider);
      ref.invalidate(resourceControllerProvider);
    },
  ),
);
