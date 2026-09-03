import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../../../core/config/app_config.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_store.dart';
import '../../../shared/models/json_value.dart';
import '../domain/app_user.dart';

class AuthRepository {
  AuthRepository({
    required AppConfig config,
    required AppSecureStore secureStore,
    required ApiClient apiClient,
  })  : _config = config,
        _secureStore = secureStore,
        _apiClient = apiClient;

  final AppConfig _config;
  final AppSecureStore _secureStore;
  final ApiClient _apiClient;

  Future<AppUser?> restoreSession() async {
    TokenBundle? tokens = await _secureStore.readTokens();
    if (tokens == null) return null;
    try {
      if (tokens.isExpired) {
        await clearLocalSession();
        return null;
      }
      final AppUser user = await currentUser();
      try {
        return await syncSsoProfile();
      } on AppException catch (error) {
        if (error.isUnauthorized) rethrow;
        // SSO profile availability must not invalidate an otherwise valid
        // Laci application session. A later resume will retry the sync.
        return user;
      } on Object {
        return user;
      }
    } on AppException catch (error) {
      if (error.isUnauthorized) {
        await clearLocalSession();
        if (error.code == 'ACCOUNT_INACTIVE') rethrow;
        return null;
      }
      rethrow;
    }
  }

  Future<AppUser> login() async {
    final String appState = _randomUrlSafe(32);
    final String codeVerifier = _randomUrlSafe(48);
    final String challenge = base64Url
        .encode(sha256.convert(utf8.encode(codeVerifier)).bytes)
        .replaceAll('=', '');
    final Uri loginUri = Uri.parse('${_config.apiV1Url}/auth/mobile/login')
        .replace(queryParameters: <String, String>{
      'redirect_uri': _config.mobileRedirectUri,
      'state': appState,
      'code_challenge': challenge,
      'code_challenge_method': 'S256',
    });
    try {
      final String callback = await FlutterWebAuth2.authenticate(
        url: loginUri.toString(),
        callbackUrlScheme: _config.mobileCallbackScheme,
        options: const FlutterWebAuth2Options(
          preferEphemeral: false,
          useWebview: false,
        ),
      );
      final Uri result = Uri.parse(callback);
      if (result.queryParameters['state'] != appState) {
        throw const AppException(
          code: 'INVALID_AUTH_STATE',
          message: 'Validasi keamanan login gagal. Silakan ulangi.',
        );
      }
      final String? providerError = result.queryParameters['error'];
      if (providerError != null && providerError.isNotEmpty) {
        if (providerError == 'account_inactive') {
          throw const AppException(
            code: 'ACCOUNT_INACTIVE',
            statusCode: 401,
            message: 'Akun Anda dinonaktifkan oleh Sekretaris Cabang.',
          );
        }
        throw AppException(
          code: providerError == 'access_denied'
              ? 'LOGIN_CANCELLED'
              : 'SSO_LOGIN_FAILED',
          message: providerError == 'access_denied'
              ? 'Login dibatalkan.'
              : 'Login SSO tidak dapat diselesaikan.',
        );
      }
      final String? oneTimeCode = result.queryParameters['code'];
      if (oneTimeCode == null || oneTimeCode.isEmpty) {
        throw const AppException(
          code: 'SSO_CODE_MISSING',
          message: 'Kode login dari server tidak tersedia.',
        );
      }
      final JsonMap exchange = await _apiClient.post(
        '/auth/mobile/exchange',
        isPublic: true,
        includeAuditContext: true,
        data: <String, String>{
          'code': oneTimeCode,
          'codeVerifier': codeVerifier,
          'redirectUri': _config.mobileRedirectUri,
        },
      );
      final JsonMap data = jsonMap(exchange['data']);
      final String? accessToken = data['accessToken']?.toString();
      if (accessToken == null || accessToken.isEmpty) {
        throw const AppException(
          code: 'SESSION_TOKEN_MISSING',
          message: 'Server tidak mengembalikan sesi aplikasi.',
        );
      }
      final DateTime expiresAt = dateTimeValue(data['expiresAt']) ??
          DateTime.now().add(
            Duration(seconds: intValue(data['expiresIn'], 21600)),
          );
      await _secureStore.writeTokens(
        TokenBundle(
          accessToken: accessToken,
          expiresAt: expiresAt,
        ),
      );
      try {
        final JsonMap embeddedUser = jsonMap(data['user']);
        if (embeddedUser.isNotEmpty) {
          return _validatedUser(AppUser.fromJson(embeddedUser));
        }
        return currentUser();
      } catch (_) {
        await clearLocalSession();
        rethrow;
      }
    } on PlatformException catch (error) {
      final String detail = (error.message ?? '').toLowerCase();
      if (detail.contains('cancel') || detail.contains('user cancelled')) {
        throw const AppException(
          code: 'LOGIN_CANCELLED',
          message: 'Login dibatalkan.',
        );
      }
      throw AppException(
        code: 'SSO_LOGIN_FAILED',
        message: 'Login SSO tidak dapat diselesaikan.',
        cause: error,
      );
    }
  }

  Future<AppUser> currentUser() async {
    final JsonMap response = await _apiClient.get('/me');
    final AppUser user = AppUser.fromJson(jsonMap(response['data']));
    if (user.id.isEmpty) {
      throw const AppException(
        code: 'INVALID_USER',
        message: 'Data pengguna dari server tidak valid.',
      );
    }
    return _validatedUser(user);
  }

  Future<AppUser> syncSsoProfile() async {
    final JsonMap response = await _apiClient.post('/me/sync');
    final AppUser user = AppUser.fromJson(jsonMap(response['data']));
    if (user.id.isEmpty) {
      throw const AppException(
        code: 'INVALID_USER',
        message: 'Data pengguna dari server tidak valid.',
      );
    }
    return _validatedUser(user);
  }

  Future<void> logout() async {
    try {
      await _apiClient.post('/auth/mobile/logout');
    } catch (_) {
      // Local cleanup is authoritative when the network is unavailable.
    } finally {
      await clearLocalSession();
    }
  }

  /// Discards every account-scoped artifact without making a network call.
  /// This is also used when the system SSO sheet is cancelled midway.
  Future<void> clearLocalSession() => Future.wait<void>(<Future<void>>[
        _secureStore.clearTokens(),
        _secureStore.writeViewPeriod(null),
        _secureStore.writeLocation(null),
      ]);

  AppUser _validatedUser(AppUser user) {
    if (!user.isActive) {
      throw const AppException(
        code: 'ACCOUNT_INACTIVE',
        statusCode: 401,
        message: 'Akun Anda dinonaktifkan oleh Sekretaris Cabang.',
      );
    }
    return user;
  }

  String _randomUrlSafe(int bytes) {
    final Random random = Random.secure();
    final List<int> values = List<int>.generate(
      bytes,
      (_) => random.nextInt(256),
      growable: false,
    );
    return base64Url.encode(values).replaceAll('=', '');
  }
}
