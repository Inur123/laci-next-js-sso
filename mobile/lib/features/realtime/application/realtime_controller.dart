import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/models/json_value.dart';

enum RealtimeConnection { connecting, connected, reconnecting, disconnected }

class RealtimeState {
  const RealtimeState({
    this.connection = RealtimeConnection.connecting,
    this.lastEvent,
    this.batchEvents = const <JsonMap>[],
    this.revision = 0,
  });

  final RealtimeConnection connection;
  final JsonMap? lastEvent;
  final List<JsonMap> batchEvents;
  final int revision;

  bool containsModule(String module) => batchEvents.any(
        (JsonMap event) => stringValue(event['module']) == module,
      );

  RealtimeState copyWith({
    RealtimeConnection? connection,
    JsonMap? lastEvent,
    List<JsonMap>? batchEvents,
    bool clearEvent = false,
    int? revision,
  }) =>
      RealtimeState(
        connection: connection ?? this.connection,
        lastEvent: clearEvent ? null : lastEvent ?? this.lastEvent,
        batchEvents:
            clearEvent ? const <JsonMap>[] : batchEvents ?? this.batchEvents,
        revision: revision ?? this.revision,
      );
}

class RealtimeController extends StateNotifier<RealtimeState> {
  RealtimeController(this._apiClient) : super(const RealtimeState()) {
    _start();
  }

  static const Duration _eventDebounce = Duration(milliseconds: 300);

  final ApiClient _apiClient;
  StreamSubscription<String>? _subscription;
  Timer? _eventTimer;
  final List<JsonMap> _pendingEvents = <JsonMap>[];
  bool _closed = false;
  bool _foreground = true;
  int _retry = 0;
  int _generation = 0;

  void _start() {
    final int generation = ++_generation;
    unawaited(_run(generation));
  }

  void setForeground(bool foreground) {
    if (_closed || _foreground == foreground) return;
    _foreground = foreground;
    ++_generation;
    if (!foreground) {
      _eventTimer?.cancel();
      _eventTimer = null;
      _pendingEvents.clear();
      unawaited(_subscription?.cancel());
      _subscription = null;
      state = state.copyWith(connection: RealtimeConnection.disconnected);
      return;
    }
    _retry = 0;
    // Data may have changed while the app was suspended. Trigger one catch-up
    // refetch before opening a fresh stream.
    state = state.copyWith(
      connection: RealtimeConnection.connecting,
      revision: state.revision + 1,
      clearEvent: true,
    );
    _start();
  }

  Future<void> _run(int generation) async {
    while (_isCurrent(generation)) {
      state = state.copyWith(
        connection: _retry == 0
            ? RealtimeConnection.connecting
            : RealtimeConnection.reconnecting,
      );
      try {
        final ResponseBody body = await _apiClient.openEventStream('/realtime');
        if (!_isCurrent(generation)) return;
        state = state.copyWith(connection: RealtimeConnection.connected);
        _retry = 0;
        await _consume(body, generation);
      } catch (_) {
        if (!_isCurrent(generation)) return;
      }
      if (!_isCurrent(generation)) return;
      _retry++;
      state = state.copyWith(connection: RealtimeConnection.reconnecting);
      final int seconds = _retry > 5 ? 30 : (1 << (_retry - 1)).clamp(1, 16);
      await Future<void>.delayed(Duration(seconds: seconds));
    }
  }

  bool _isCurrent(int generation) =>
      !_closed && _foreground && generation == _generation;

  Future<void> _consume(ResponseBody body, int generation) async {
    String eventName = '';
    final StringBuffer data = StringBuffer();
    final Stream<String> lines = body.stream
        .cast<List<int>>()
        .transform<String>(utf8.decoder)
        .transform<String>(const LineSplitter());
    _subscription = lines.listen(
      (String line) {
        if (line.isEmpty) {
          if (eventName == 'update' && data.isNotEmpty) {
            try {
              final Object? decoded = jsonDecode(data.toString());
              _queueEvent(jsonMap(decoded), generation);
            } on FormatException {
              // Ignore malformed pushes; the next valid update still arrives.
            }
          }
          eventName = '';
          data.clear();
          return;
        }
        if (line.startsWith('event:')) {
          eventName = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          if (data.isNotEmpty) data.write('\n');
          data.write(line.substring(5).trimLeft());
        }
      },
    );
    await _subscription!.asFuture<void>();
  }

  void _queueEvent(JsonMap event, int generation) {
    if (!_isCurrent(generation) || event.isEmpty) return;
    if (_pendingEvents.length == 256) _pendingEvents.removeAt(0);
    _pendingEvents.add(event);
    _eventTimer ??= Timer(_eventDebounce, () {
      _eventTimer = null;
      if (!_isCurrent(generation)) {
        _pendingEvents.clear();
        return;
      }
      if (_pendingEvents.isEmpty) return;
      final List<JsonMap> events = List<JsonMap>.unmodifiable(_pendingEvents);
      _pendingEvents.clear();
      state = state.copyWith(
        connection: RealtimeConnection.connected,
        lastEvent: events.last,
        batchEvents: events,
        revision: state.revision + 1,
      );
    });
  }

  @override
  void dispose() {
    _closed = true;
    ++_generation;
    _eventTimer?.cancel();
    _eventTimer = null;
    _pendingEvents.clear();
    unawaited(_subscription?.cancel());
    super.dispose();
  }
}
