class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.frontendBaseUrl,
    required this.mobileRedirectUri,
    required this.ssoProfileUrl,
    required this.environment,
  });

  factory AppConfig.fromEnvironment(Map<String, String> values) {
    final String apiBaseUrl = _httpUrl(
      values,
      'API_BASE_URL',
      originOnly: true,
    );
    final String frontendBaseUrl = _httpUrl(
      values,
      'FRONTEND_BASE_URL',
      originOnly: true,
    );
    final String mobileRedirectUri = _required(values, 'MOBILE_REDIRECT_URI');
    final Uri? redirect = Uri.tryParse(mobileRedirectUri);
    if (redirect == null ||
        redirect.scheme != 'lacidigital' ||
        redirect.host.isEmpty ||
        !redirect.hasAbsolutePath ||
        redirect.hasQuery ||
        redirect.hasFragment) {
      throw const FormatException(
        'MOBILE_REDIRECT_URI wajib berupa deep link lacidigital://host/path.',
      );
    }
    return AppConfig(
      apiBaseUrl: apiBaseUrl,
      frontendBaseUrl: frontendBaseUrl,
      mobileRedirectUri: mobileRedirectUri,
      ssoProfileUrl: _httpUrl(values, 'SSO_PROFILE_URL'),
      environment: _required(values, 'APP_ENV'),
    );
  }

  static String _required(Map<String, String> values, String key) {
    final String value = values[key]?.trim() ?? '';
    if (value.isEmpty) {
      throw StateError('$key wajib diisi di mobile/.env.');
    }
    return value;
  }

  static String _httpUrl(
    Map<String, String> values,
    String key, {
    bool originOnly = false,
  }) {
    final String raw = _required(values, key);
    final Uri? uri = Uri.tryParse(raw);
    if (uri == null ||
        (uri.scheme != 'http' && uri.scheme != 'https') ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (originOnly && uri.path.isNotEmpty && uri.path != '/')) {
      throw FormatException(
        originOnly
            ? '$key wajib berupa origin HTTP(S) tanpa path, query, atau fragment.'
            : '$key wajib berupa URL HTTP(S) yang valid tanpa query atau fragment.',
      );
    }
    return raw.replaceAll(RegExp(r'/+$'), '');
  }

  final String apiBaseUrl;
  final String frontendBaseUrl;
  final String mobileRedirectUri;
  final String ssoProfileUrl;
  final String environment;

  String get apiV1Url => '$apiBaseUrl/api/v1';

  String get mobileCallbackScheme => Uri.parse(mobileRedirectUri).scheme;

  Uri publicAttendanceUri(String id) =>
      Uri.parse('$frontendBaseUrl/presensi/${Uri.encodeComponent(id)}');
}
