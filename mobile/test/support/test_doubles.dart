import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:laci_mobile/core/location/location_service.dart';
import 'package:laci_mobile/core/network/api_client.dart';
import 'package:laci_mobile/core/storage/secure_store.dart';
import 'package:laci_mobile/features/auth/data/auth_repository.dart';
import 'package:mocktail/mocktail.dart';

class MemorySecureStore implements AppSecureStore {
  TokenBundle? tokens;
  String? viewPeriod;
  String? location;
  int clearTokensCalls = 0;

  @override
  Future<void> clearTokens() async {
    clearTokensCalls += 1;
    tokens = null;
  }

  @override
  Future<String?> readLocation() async => location;

  @override
  Future<TokenBundle?> readTokens() async => tokens;

  @override
  Future<String?> readViewPeriod() async => viewPeriod;

  @override
  Future<void> writeLocation(String? value) async {
    location = value;
  }

  @override
  Future<void> writeTokens(TokenBundle value) async {
    tokens = value;
  }

  @override
  Future<void> writeViewPeriod(String? value) async {
    viewPeriod = value;
  }
}

class MockApiClient extends Mock implements ApiClient {}

class MockAuthRepository extends Mock implements AuthRepository {}

class MockLocationService extends Mock implements LocationService {}

typedef AdapterHandler = ResponseBody Function(RequestOptions options);

class RecordingHttpClientAdapter implements HttpClientAdapter {
  RecordingHttpClientAdapter(this.handler);

  final AdapterHandler handler;
  final List<RequestOptions> requests = <RequestOptions>[];

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return handler(options);
  }
}

ResponseBody jsonResponse(
  Object body, {
  int statusCode = 200,
}) =>
    ResponseBody.fromString(
      jsonEncode(body),
      statusCode,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
