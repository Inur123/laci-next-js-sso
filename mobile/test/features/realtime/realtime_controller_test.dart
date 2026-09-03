import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/features/realtime/application/realtime_controller.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/test_doubles.dart';

void main() {
  late MockApiClient apiClient;
  late List<StreamController<Uint8List>> streams;
  late RealtimeController controller;
  late int connectionCalls;

  setUp(() {
    apiClient = MockApiClient();
    streams = <StreamController<Uint8List>>[];
    connectionCalls = 0;
    when(() => apiClient.openEventStream('/realtime')).thenAnswer((_) async {
      connectionCalls++;
      final StreamController<Uint8List> stream = StreamController<Uint8List>();
      streams.add(stream);
      return ResponseBody(stream.stream, 200);
    });
    controller = RealtimeController(apiClient);
  });

  tearDown(() async {
    controller.dispose();
    for (final StreamController<Uint8List> stream in streams) {
      if (!stream.isClosed) await stream.close();
    }
  });

  test('push beruntun didebounce menjadi satu refresh terbaru', () async {
    await _waitUntil(() => connectionCalls == 1);
    streams.single.add(
      Uint8List.fromList(
        utf8.encode(
          'event: update\ndata: {"type":"mutation","id":"first"}\n\n'
          'event: update\ndata: {"type":"mutation","id":"latest"}\n\n',
        ),
      ),
    );

    await Future<void>.delayed(const Duration(milliseconds: 380));

    expect(controller.state.connection, RealtimeConnection.connected);
    expect(controller.state.revision, 1);
    expect(controller.state.lastEvent?['id'], 'latest');
    expect(
      controller.state.batchEvents.map((event) => event['id']),
      <String>['first', 'latest'],
    );
  });

  test('background memutus stream dan resume melakukan catch-up', () async {
    await _waitUntil(() => connectionCalls == 1);
    streams.single.add(
      Uint8List.fromList(
        utf8.encode(
          'event: update\ndata: {"type":"mutation","id":"queued"}\n\n',
        ),
      ),
    );
    controller.setForeground(false);

    await Future<void>.delayed(const Duration(milliseconds: 380));
    expect(controller.state.connection, RealtimeConnection.disconnected);
    expect(controller.state.revision, 0);
    expect(controller.state.lastEvent, isNull);
    expect(controller.state.batchEvents, isEmpty);

    controller.setForeground(true);
    await _waitUntil(() => connectionCalls == 2);

    expect(controller.state.revision, 1);
    expect(controller.state.connection, RealtimeConnection.connected);
  });
}

Future<void> _waitUntil(bool Function() predicate) async {
  for (int attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw TestFailure('Kondisi realtime tidak tercapai sebelum timeout.');
}
