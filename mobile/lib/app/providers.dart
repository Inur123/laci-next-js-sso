import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/app_config.dart';
import '../core/location/location_service.dart';
import '../core/network/api_client.dart';
import '../core/network/session_events.dart';
import '../core/storage/secure_store.dart';
import '../features/admin/data/admin_repository.dart';
import '../features/auth/application/auth_controller.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/realtime/application/realtime_controller.dart';
import '../features/resources/data/resource_file_actions.dart';
import '../features/resources/data/resource_repository.dart';

final Provider<AppConfig> appConfigProvider = Provider<AppConfig>(
  (Ref<AppConfig> ref) => throw StateError(
    'AppConfig belum dimuat dari mobile/.env pada main.dart.',
  ),
);

final Provider<AppSecureStore> secureStoreProvider = Provider<AppSecureStore>(
  (Ref<AppSecureStore> ref) => SecureStore(),
);

final Provider<SessionEvents> sessionEventsProvider = Provider<SessionEvents>(
  (Ref<SessionEvents> ref) {
    final SessionEvents events = SessionEvents();
    ref.onDispose(events.dispose);
    return events;
  },
);

final Provider<ApiClient> apiClientProvider = Provider<ApiClient>(
  (Ref<ApiClient> ref) => ApiClient(
    config: ref.watch(appConfigProvider),
    secureStore: ref.watch(secureStoreProvider),
    onUnauthorized: ref.watch(sessionEventsProvider).expire,
  ),
);

final Provider<LocationService> locationServiceProvider =
    Provider<LocationService>(
  (Ref<LocationService> ref) => LocationService(
    ref.watch(secureStoreProvider),
  ),
);

final Provider<AuthRepository> authRepositoryProvider =
    Provider<AuthRepository>(
  (Ref<AuthRepository> ref) => AuthRepository(
    config: ref.watch(appConfigProvider),
    secureStore: ref.watch(secureStoreProvider),
    apiClient: ref.watch(apiClientProvider),
  ),
);

final Provider<AdminRepository> adminRepositoryProvider =
    Provider<AdminRepository>(
  (Ref<AdminRepository> ref) => AdminRepository(
    ref.watch(apiClientProvider),
  ),
);

final StateNotifierProvider<AuthController, AuthState> authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(
    repository: ref.watch(authRepositoryProvider),
    locationService: ref.watch(locationServiceProvider),
    sessionEvents: ref.watch(sessionEventsProvider),
    onSessionCleared: () => ResourceFileActions(
      ResourceRepository(ref.read(apiClientProvider)),
    ).clearTemporaryFiles(),
  ),
);

final AutoDisposeStateNotifierProvider<RealtimeController, RealtimeState>
    realtimeControllerProvider =
    StateNotifierProvider.autoDispose<RealtimeController, RealtimeState>(
  (ref) => RealtimeController(
    ref.watch(apiClientProvider),
  ),
);
