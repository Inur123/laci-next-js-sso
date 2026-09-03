import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../shared/models/json_value.dart';
import '../config/app_config.dart';
import '../errors/app_exception.dart';
import '../storage/secure_store.dart';

typedef UnauthorizedCallback = FutureOr<void> Function(AppException reason);

class ApiClient {
  ApiClient({
    required AppConfig config,
    required AppSecureStore secureStore,
    Dio? dio,
    UnauthorizedCallback? onUnauthorized,
  })  : _secureStore = secureStore,
        _onUnauthorized = onUnauthorized,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: config.apiV1Url,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 30),
                sendTimeout: const Duration(seconds: 30),
                responseType: ResponseType.json,
                headers: const <String, String>{
                  'Accept': 'application/json',
                  'X-Client-User-Agent': 'Laci Mobile',
                },
              ),
            ) {
    _dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest:
            (RequestOptions options, RequestInterceptorHandler handler) async {
          options.headers.putIfAbsent(
            'X-Client-User-Agent',
            () => 'Laci Mobile',
          );
          if (options.extra['public'] != true) {
            final TokenBundle? bundle = await _secureStore.readTokens();
            if (bundle != null) {
              options.headers['Authorization'] = 'Bearer ${bundle.accessToken}';
            }
            final String? viewPeriod = await _secureStore.readViewPeriod();
            if (viewPeriod != null && viewPeriod.isNotEmpty) {
              options.headers.putIfAbsent('X-View-Period', () => viewPeriod);
            }
          }
          if (options.extra['public'] != true ||
              options.extra['auditContext'] == true) {
            final String? location = await _secureStore.readLocation();
            if (location != null && location.isNotEmpty) {
              options.headers['X-Client-Location'] = location;
            }
          }
          handler.next(options);
        },
        onError: (DioException error, ErrorInterceptorHandler handler) async {
          if (error.response?.statusCode == 401 &&
              error.requestOptions.extra['skipUnauthorizedCallback'] != true) {
            final AppException reason = _mapDioError(error);
            // A short-lived file/API token is not the authenticated app
            // session and must never force a logout.
            if (reason.code != 'INVALID_TOKEN' &&
                reason.code != 'INVALID_API_KEY') {
              await _onUnauthorized?.call(reason);
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio _dio;
  final AppSecureStore _secureStore;
  final UnauthorizedCallback? _onUnauthorized;

  Future<JsonMap> get(
    String path, {
    Map<String, dynamic>? query,
    bool isPublic = false,
    Map<String, Object?>? headers,
  }) =>
      _jsonRequest(
        path,
        method: 'GET',
        query: query,
        isPublic: isPublic,
        headers: headers,
      );

  Future<JsonMap> post(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    bool isPublic = false,
    bool includeAuditContext = false,
    Duration? receiveTimeout,
  }) =>
      _jsonRequest(
        path,
        method: 'POST',
        data: data,
        query: query,
        isPublic: isPublic,
        includeAuditContext: includeAuditContext,
        receiveTimeout: receiveTimeout,
      );

  Future<JsonMap> patch(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
  }) =>
      _jsonRequest(
        path,
        method: 'PATCH',
        data: data,
        query: query,
      );

  Future<JsonMap> delete(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
  }) =>
      _jsonRequest(
        path,
        method: 'DELETE',
        data: data,
        query: query,
      );

  Future<JsonMap> upload({
    required String path,
    required String filePath,
    required String fileName,
    required String prefix,
    ProgressCallback? onProgress,
  }) async {
    final FormData body = FormData.fromMap(<String, Object>{
      'prefix': prefix,
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
    });
    return _jsonRequest(
      path,
      method: 'POST',
      data: body,
      onSendProgress: onProgress,
    );
  }

  Future<Uint8List> download(
    String path, {
    Map<String, dynamic>? query,
    bool skipUnauthorizedCallback = false,
  }) async {
    try {
      final Response<List<int>> response = await _dio.get<List<int>>(
        path,
        queryParameters: query,
        options: Options(
          responseType: ResponseType.bytes,
          extra: <String, Object>{
            'skipUnauthorizedCallback': skipUnauthorizedCallback,
          },
        ),
      );
      return Uint8List.fromList(response.data ?? <int>[]);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<ResponseBody> openEventStream(String path) async {
    try {
      final Response<ResponseBody> response = await _dio.get<ResponseBody>(
        path,
        options: Options(
          responseType: ResponseType.stream,
          headers: const <String, String>{'Accept': 'text/event-stream'},
        ),
      );
      final ResponseBody? body = response.data;
      if (body == null) {
        throw const AppException(message: 'Koneksi realtime tidak tersedia');
      }
      return body;
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<JsonMap> _jsonRequest(
    String path, {
    required String method,
    Object? data,
    Map<String, dynamic>? query,
    bool isPublic = false,
    bool includeAuditContext = false,
    Map<String, Object?>? headers,
    ProgressCallback? onSendProgress,
    Duration? receiveTimeout,
  }) async {
    try {
      final Response<dynamic> response = await _dio.request<dynamic>(
        path,
        data: data,
        queryParameters: query,
        onSendProgress: onSendProgress,
        options: Options(
          method: method,
          headers: headers,
          extra: <String, Object>{
            'public': isPublic,
            'auditContext': includeAuditContext,
          },
          receiveTimeout: receiveTimeout,
        ),
      );
      return jsonMap(response.data);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  AppException _mapDioError(DioException error) {
    final int? status = error.response?.statusCode;
    final JsonMap response = _errorPayload(error.response?.data);
    final JsonMap problem = jsonMap(response['error']);
    if (problem.isNotEmpty) {
      return AppException(
        statusCode: status,
        code: stringValue(problem['code'], 'API_ERROR'),
        message:
            stringValue(problem['message'], 'Permintaan tidak dapat diproses'),
        details: problem['details'],
        cause: error,
      );
    }
    final String message = switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        'Koneksi ke server terlalu lama. Coba lagi.',
      DioExceptionType.connectionError =>
        'Tidak dapat terhubung ke server. Periksa jaringan Anda.',
      DioExceptionType.cancel => 'Permintaan dibatalkan.',
      _ => status != null && status >= 500
          ? 'Server sedang bermasalah. Coba beberapa saat lagi.'
          : 'Permintaan tidak dapat diproses.',
    };
    return AppException(
      statusCode: status,
      code: status == 401 ? 'UNAUTHORIZED' : 'NETWORK_ERROR',
      message: message,
      cause: error,
    );
  }

  JsonMap _errorPayload(Object? payload) {
    if (payload is List<int>) {
      try {
        return jsonMap(jsonDecode(utf8.decode(payload)));
      } on FormatException {
        return const <String, dynamic>{};
      }
    }
    return jsonMap(payload);
  }
}
