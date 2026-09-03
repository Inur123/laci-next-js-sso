import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/models/json_value.dart';

class DashboardState {
  const DashboardState({
    this.data = const <String, dynamic>{},
    this.loading = false,
    this.error,
  });

  final JsonMap data;
  final bool loading;
  final String? error;
}

class DashboardController extends StateNotifier<DashboardState> {
  DashboardController(this._apiClient) : super(const DashboardState()) {
    load();
  }

  final ApiClient _apiClient;

  Future<void> load() async {
    state = DashboardState(data: state.data, loading: true);
    try {
      final JsonMap response = await _apiClient.get('/dashboard');
      state = DashboardState(data: jsonMap(response['data']));
    } catch (error) {
      state = DashboardState(
        data: state.data,
        error: error is AppException
            ? error.message
            : 'Dashboard tidak dapat dimuat.',
      );
    }
  }
}

final AutoDisposeStateNotifierProvider<DashboardController, DashboardState>
    dashboardControllerProvider =
    StateNotifierProvider.autoDispose<DashboardController, DashboardState>(
  (ref) => DashboardController(
    ref.watch(apiClientProvider),
  ),
);
