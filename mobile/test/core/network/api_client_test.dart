import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/core/config/app_config.dart';
import 'package:laci_mobile/core/errors/app_exception.dart';
import 'package:laci_mobile/core/network/api_client.dart';
import 'package:laci_mobile/core/storage/secure_store.dart';

import '../../support/test_doubles.dart';

void main() {
  const AppConfig config = AppConfig(
    apiBaseUrl: 'https://api.example.test',
    frontendBaseUrl: 'https://web.example.test',
    mobileRedirectUri: 'lacidigital://oauth/callback',
    ssoProfileUrl: 'https://sso.example.test/profile',
    environment: 'test',
  );

  ApiClient buildClient({
    required MemorySecureStore store,
    required RecordingHttpClientAdapter adapter,
    UnauthorizedCallback? onUnauthorized,
  }) {
    final Dio dio = Dio(
      BaseOptions(
        baseUrl: config.apiV1Url,
        responseType: ResponseType.json,
      ),
    )..httpClientAdapter = adapter;
    return ApiClient(
      config: config,
      secureStore: store,
      dio: dio,
      onUnauthorized: onUnauthorized,
    );
  }

  test('menyertakan bearer, periode, dan lokasi pada request privat', () async {
    final MemorySecureStore store = MemorySecureStore()
      ..tokens = const TokenBundle(accessToken: 'opaque-token')
      ..viewPeriod = 'period-2026'
      ..location = '-7.6500, 111.3600';
    final RecordingHttpClientAdapter adapter = RecordingHttpClientAdapter(
      (RequestOptions _) => jsonResponse(<String, Object>{
        'data': <String, Object>{'ok': true},
      }),
    );
    final ApiClient client = buildClient(store: store, adapter: adapter);

    final Map<String, dynamic> response = await client.get('/me');

    expect(response['data'], <String, Object>{'ok': true});
    final RequestOptions request = adapter.requests.single;
    expect(request.uri.toString(), 'https://api.example.test/api/v1/me');
    expect(request.headers['Authorization'], 'Bearer opaque-token');
    expect(request.headers['X-View-Period'], 'period-2026');
    expect(request.headers['X-Client-Location'], '-7.6500, 111.3600');
  });

  test('request publik tidak membocorkan token atau konteks pengguna',
      () async {
    final MemorySecureStore store = MemorySecureStore()
      ..tokens = const TokenBundle(accessToken: 'secret')
      ..viewPeriod = 'period-private'
      ..location = 'private-location';
    final RecordingHttpClientAdapter adapter = RecordingHttpClientAdapter(
      (RequestOptions _) => jsonResponse(<String, Object>{'ok': true}),
    );
    final ApiClient client = buildClient(store: store, adapter: adapter);

    await client.get('/public', isPublic: true);

    final Map<String, dynamic> headers = adapter.requests.single.headers;
    expect(headers, isNot(contains('Authorization')));
    expect(headers, isNot(contains('X-View-Period')));
    expect(headers, isNot(contains('X-Client-Location')));
  });

  test('exchange publik membawa lokasi audit tanpa bearer atau periode',
      () async {
    final MemorySecureStore store = MemorySecureStore()
      ..tokens = const TokenBundle(accessToken: 'secret')
      ..viewPeriod = 'period-private'
      ..location = '-7.6500, 111.3600';
    final RecordingHttpClientAdapter adapter = RecordingHttpClientAdapter(
      (RequestOptions _) => jsonResponse(<String, Object>{'ok': true}),
    );
    final ApiClient client = buildClient(store: store, adapter: adapter);

    await client.post(
      '/auth/mobile/exchange',
      isPublic: true,
      includeAuditContext: true,
    );

    final Map<String, dynamic> headers = adapter.requests.single.headers;
    expect(headers, isNot(contains('Authorization')));
    expect(headers, isNot(contains('X-View-Period')));
    expect(headers['X-Client-Location'], '-7.6500, 111.3600');
    expect(headers['X-Client-User-Agent'], 'Laci Mobile');
  });

  test('header periode eksplisit tidak ditimpa periode tersimpan', () async {
    final MemorySecureStore store = MemorySecureStore()
      ..tokens = const TokenBundle(accessToken: 'opaque-token')
      ..viewPeriod = 'period-stored';
    final RecordingHttpClientAdapter adapter = RecordingHttpClientAdapter(
      (RequestOptions _) => jsonResponse(<String, Object>{'ok': true}),
    );
    final ApiClient client = buildClient(store: store, adapter: adapter);

    await client.get(
      '/arsip',
      headers: const <String, Object?>{'X-View-Period': 'period-explicit'},
    );

    expect(
      adapter.requests.single.headers['X-View-Period'],
      'period-explicit',
    );
  });

  test('memetakan problem API dan memicu expiry pada 401', () async {
    final MemorySecureStore store = MemorySecureStore();
    int unauthorizedCalls = 0;
    final RecordingHttpClientAdapter adapter = RecordingHttpClientAdapter(
      (RequestOptions _) => jsonResponse(
        <String, Object>{
          'error': <String, Object>{
            'code': 'UNAUTHORIZED',
            'message': 'Sesi tidak valid',
            'details': <String, Object>{'reason': 'expired'},
          },
        },
        statusCode: 401,
      ),
    );
    final ApiClient client = buildClient(
      store: store,
      adapter: adapter,
      onUnauthorized: (AppException _) async {
        unauthorizedCalls += 1;
      },
    );

    await expectLater(
      client.get('/me'),
      throwsA(
        isA<AppException>()
            .having((AppException error) => error.statusCode, 'status', 401)
            .having(
              (AppException error) => error.code,
              'code',
              'UNAUTHORIZED',
            )
            .having(
              (AppException error) => error.message,
              'message',
              'Sesi tidak valid',
            ),
      ),
    );
    expect(unauthorizedCalls, 1);
  });

  test('401 INVALID_TOKEN tidak mengakhiri sesi aplikasi', () async {
    final MemorySecureStore store = MemorySecureStore()
      ..tokens = const TokenBundle(accessToken: 'valid-app-session');
    final List<AppException> unauthorizedReasons = <AppException>[];
    final RecordingHttpClientAdapter adapter = RecordingHttpClientAdapter(
      (RequestOptions _) => jsonResponse(
        <String, Object>{
          'error': <String, Object>{
            'code': 'INVALID_TOKEN',
            'message': 'Token unduhan tidak valid',
          },
        },
        statusCode: 401,
      ),
    );
    final ApiClient client = buildClient(
      store: store,
      adapter: adapter,
      onUnauthorized: unauthorizedReasons.add,
    );

    await expectLater(
      client.download('/arsip/arsip-1/download'),
      throwsA(
        isA<AppException>().having(
          (AppException error) => error.code,
          'code',
          'INVALID_TOKEN',
        ),
      ),
    );

    expect(unauthorizedReasons, isEmpty);
    expect(store.tokens?.accessToken, 'valid-app-session');
  });

  test('memetakan kegagalan server tanpa problem terstruktur', () async {
    final MemorySecureStore store = MemorySecureStore();
    final RecordingHttpClientAdapter adapter = RecordingHttpClientAdapter(
      (RequestOptions _) => jsonResponse(
        <String, Object>{'message': 'unexpected'},
        statusCode: 503,
      ),
    );
    final ApiClient client = buildClient(store: store, adapter: adapter);

    await expectLater(
      client.get('/dashboard'),
      throwsA(
        isA<AppException>().having(
          (AppException error) => error.message,
          'message',
          'Server sedang bermasalah. Coba beberapa saat lagi.',
        ),
      ),
    );
  });
}
