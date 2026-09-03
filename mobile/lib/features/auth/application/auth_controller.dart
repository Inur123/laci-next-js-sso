import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/location/location_service.dart';
import '../../../core/network/session_events.dart';
import '../data/auth_repository.dart';
import '../domain/app_user.dart';

typedef SessionArtifactsCleanup = FutureOr<void> Function();

enum AuthStatus {
  initializing,
  unauthenticated,
  authenticating,
  authenticated,
  failure,
}

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.message,
    this.errorCode,
  });

  const AuthState.initializing() : this(status: AuthStatus.initializing);

  final AuthStatus status;
  final AppUser? user;
  final String? message;
  final String? errorCode;

  bool get isAuthenticated =>
      status == AuthStatus.authenticated && user != null;
}

class AuthController extends StateNotifier<AuthState> {
  AuthController({
    required AuthRepository repository,
    required LocationService locationService,
    required SessionEvents sessionEvents,
    SessionArtifactsCleanup? onSessionCleared,
  })  : _repository = repository,
        _locationService = locationService,
        _onSessionCleared = onSessionCleared,
        super(const AuthState.initializing()) {
    _sessionSubscription = sessionEvents.onExpired.listen(expireSession);
    unawaited(initialize());
  }

  final AuthRepository _repository;
  final LocationService _locationService;
  final SessionArtifactsCleanup? _onSessionCleared;
  late final StreamSubscription<AppException?> _sessionSubscription;
  bool _revalidating = false;
  bool _expiring = false;
  int _sessionRevision = 0;

  Future<void> initialize() async {
    final int revision = ++_sessionRevision;
    state = const AuthState.initializing();
    try {
      final AppUser? user = await _repository.restoreSession();
      if (revision != _sessionRevision) return;
      if (user == null) {
        await _clearSessionArtifacts();
        if (revision != _sessionRevision) return;
      }
      state = user == null
          ? const AuthState(status: AuthStatus.unauthenticated)
          : AuthState(status: AuthStatus.authenticated, user: user);
    } catch (error) {
      if (revision != _sessionRevision) return;
      if (error is AppException && error.isUnauthorized) {
        await _clearSessionArtifacts();
        if (revision != _sessionRevision) return;
      }
      state = AuthState(
        status: AuthStatus.failure,
        message: _message(error),
        errorCode: error is AppException ? error.code : null,
      );
    }
  }

  Future<void> login() async {
    if (state.status == AuthStatus.authenticating) return;
    final int revision = ++_sessionRevision;
    state = const AuthState(status: AuthStatus.authenticating);
    try {
      final String? location = await _locationService.captureForLogin();
      if (location == null || location.trim().isEmpty) {
        throw const AppException(
          code: 'LOCATION_REQUIRED',
          message: 'Lokasi perangkat wajib tersedia untuk masuk.',
        );
      }
      final AppUser user = await _repository.login();
      if (revision != _sessionRevision) {
        await _repository.clearLocalSession();
        return;
      }
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (error) {
      await _repository.clearLocalSession();
      if (revision != _sessionRevision) return;
      state = AuthState(
        status: AuthStatus.failure,
        message: _message(error),
        errorCode: error is AppException ? error.code : null,
      );
    }
  }

  Future<void> retry() => initialize();

  Future<void> revalidateSession() async {
    if (!state.isAuthenticated || _revalidating || _expiring) return;
    _revalidating = true;
    final int revision = _sessionRevision;
    try {
      final AppUser user = await _repository.syncSsoProfile();
      if (revision != _sessionRevision || !state.isAuthenticated) return;
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } on AppException catch (error) {
      if (revision != _sessionRevision || !state.isAuthenticated) return;
      if (error.code == 'ACCOUNT_INACTIVE' || error.isUnauthorized) {
        await _clearSessionArtifacts();
        if (revision != _sessionRevision || !state.isAuthenticated) return;
        final bool inactive = error.code == 'ACCOUNT_INACTIVE';
        state = AuthState(
          status: AuthStatus.failure,
          message: inactive
              ? _message(error)
              : 'Sesi telah berakhir. Silakan masuk kembali.',
          errorCode: inactive ? 'ACCOUNT_INACTIVE' : 'SESSION_EXPIRED',
        );
      }
      // A transient network failure must not discard an otherwise valid local
      // session. The next protected request will retry validation.
    } on Object {
      // Malformed/transient responses are handled by the next user request;
      // lifecycle callbacks must never surface as unhandled async errors.
    } finally {
      _revalidating = false;
    }
  }

  Future<void> openLocationSettings() => _locationService.openSettings();

  Future<void> logout() async {
    ++_sessionRevision;
    await _repository.logout();
    await _clearSessionArtifacts();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<void> expireSession([AppException? reason]) async {
    if (!state.isAuthenticated || _expiring) return;
    _expiring = true;
    ++_sessionRevision;
    try {
      await _repository.logout();
      await _clearSessionArtifacts();
      final bool inactive = reason?.code == 'ACCOUNT_INACTIVE';
      state = AuthState(
        status: AuthStatus.failure,
        message: inactive
            ? reason?.message ??
                'Akun Anda dinonaktifkan oleh Sekretaris Cabang.'
            : 'Sesi telah berakhir. Silakan masuk kembali.',
        errorCode: inactive ? 'ACCOUNT_INACTIVE' : 'SESSION_EXPIRED',
      );
    } finally {
      _expiring = false;
    }
  }

  void updateUser(AppUser user) {
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> _clearSessionArtifacts() async {
    try {
      await _onSessionCleared?.call();
    } on Object {
      // Temporary-file cleanup must never prevent local session revocation.
    }
  }

  String _message(Object error) => error is AppException
      ? error.message
      : 'Terjadi kesalahan. Coba kembali.';

  @override
  void dispose() {
    unawaited(_sessionSubscription.cancel());
    super.dispose();
  }
}
