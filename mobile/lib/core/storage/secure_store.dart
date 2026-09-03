import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenBundle {
  const TokenBundle({
    required this.accessToken,
    this.refreshToken,
    this.idToken,
    this.expiresAt,
  });

  final String accessToken;
  final String? refreshToken;
  final String? idToken;
  final DateTime? expiresAt;

  bool get isExpired =>
      expiresAt != null &&
      DateTime.now().isAfter(expiresAt!.subtract(const Duration(minutes: 1)));
}

abstract interface class AppSecureStore {
  Future<TokenBundle?> readTokens();
  Future<void> writeTokens(TokenBundle tokens);
  Future<void> clearTokens();
  Future<String?> readViewPeriod();
  Future<void> writeViewPeriod(String? value);
  Future<String?> readLocation();
  Future<void> writeLocation(String? value);
}

class SecureStore implements AppSecureStore {
  SecureStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const String _accessToken = 'auth.access_token';
  static const String _refreshToken = 'auth.refresh_token';
  static const String _idToken = 'auth.id_token';
  static const String _expiresAt = 'auth.expires_at';
  static const String _viewPeriod = 'preference.view_period';
  static const String _location = 'audit.location';

  final FlutterSecureStorage _storage;

  @override
  Future<TokenBundle?> readTokens() async {
    final String? accessToken = await _storage.read(key: _accessToken);
    if (accessToken == null || accessToken.isEmpty) return null;
    final String? expiresAt = await _storage.read(key: _expiresAt);
    return TokenBundle(
      accessToken: accessToken,
      refreshToken: await _storage.read(key: _refreshToken),
      idToken: await _storage.read(key: _idToken),
      expiresAt: expiresAt == null ? null : DateTime.tryParse(expiresAt),
    );
  }

  @override
  Future<void> writeTokens(TokenBundle tokens) async {
    await Future.wait<void>(<Future<void>>[
      _storage.write(key: _accessToken, value: tokens.accessToken),
      _writeNullable(_refreshToken, tokens.refreshToken),
      _writeNullable(_idToken, tokens.idToken),
      _writeNullable(_expiresAt, tokens.expiresAt?.toIso8601String()),
    ]);
  }

  @override
  Future<void> clearTokens() => Future.wait<void>(<Future<void>>[
        _storage.delete(key: _accessToken),
        _storage.delete(key: _refreshToken),
        _storage.delete(key: _idToken),
        _storage.delete(key: _expiresAt),
      ]);

  @override
  Future<String?> readViewPeriod() => _storage.read(key: _viewPeriod);

  @override
  Future<void> writeViewPeriod(String? value) =>
      _writeNullable(_viewPeriod, value);

  @override
  Future<String?> readLocation() => _storage.read(key: _location);

  @override
  Future<void> writeLocation(String? value) => _writeNullable(_location, value);

  Future<void> _writeNullable(String key, String? value) =>
      value == null || value.isEmpty
          ? _storage.delete(key: key)
          : _storage.write(key: key, value: value);
}
