import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_exception.dart';
import '../../../shared/models/json_value.dart';
import '../data/resource_repository.dart';
import '../domain/resource_models.dart';
import 'resource_controller.dart';

enum PresensiParticipantSortKey {
  name('Nama lengkap'),
  organization('Organisasi'),
  level('Tingkat'),
  position('Jabatan / instansi'),
  createdAt('Waktu absen');

  const PresensiParticipantSortKey(this.label);

  final String label;
}

const int presensiParticipantsPerPage = 10;

List<PresensiParticipant> filterAndSortPresensiParticipants(
  Iterable<PresensiParticipant> participants, {
  String search = '',
  PresensiParticipantSortKey sortKey = PresensiParticipantSortKey.createdAt,
  bool ascending = false,
}) {
  final String query = search.trim().toLowerCase();
  final List<MapEntry<int, PresensiParticipant>> matching = participants
      .toList(growable: false)
      .asMap()
      .entries
      .where((MapEntry<int, PresensiParticipant> entry) {
    if (query.isEmpty) return true;
    final PresensiParticipant participant = entry.value;
    return <String>[
      participant.name,
      participant.organization,
      participant.position,
      participant.institution,
      participant.level,
    ].any((String value) => value.toLowerCase().contains(query));
  }).toList(growable: true);

  matching.sort((
    MapEntry<int, PresensiParticipant> left,
    MapEntry<int, PresensiParticipant> right,
  ) {
    final PresensiParticipant a = left.value;
    final PresensiParticipant b = right.value;
    int compared;
    if (sortKey == PresensiParticipantSortKey.createdAt) {
      final DateTime? aDate = a.createdAt;
      final DateTime? bDate = b.createdAt;
      if (aDate == null && bDate == null) {
        compared = 0;
      } else if (aDate == null) {
        return 1;
      } else if (bDate == null) {
        return -1;
      } else {
        compared = aDate.compareTo(bDate);
      }
    } else {
      String value(PresensiParticipant participant) => switch (sortKey) {
            PresensiParticipantSortKey.name => participant.name,
            PresensiParticipantSortKey.organization => participant.organization,
            PresensiParticipantSortKey.level => participant.level,
            PresensiParticipantSortKey.position =>
              participant.organization.toUpperCase() == 'UMUM'
                  ? participant.institution
                  : participant.position,
            PresensiParticipantSortKey.createdAt => '',
          };
      compared = value(a).toLowerCase().compareTo(value(b).toLowerCase());
    }
    if (compared == 0) return left.key.compareTo(right.key);
    return ascending ? compared : -compared;
  });
  return matching
      .map<PresensiParticipant>(
        (MapEntry<int, PresensiParticipant> entry) => entry.value,
      )
      .toList(growable: false);
}

int presensiParticipantPageCount(
  int total, {
  int pageSize = presensiParticipantsPerPage,
}) {
  if (total <= 0 || pageSize <= 0) return 0;
  return (total + pageSize - 1) ~/ pageSize;
}

List<PresensiParticipant> paginatePresensiParticipants(
  List<PresensiParticipant> participants, {
  required int page,
  int pageSize = presensiParticipantsPerPage,
}) {
  if (participants.isEmpty || pageSize <= 0) {
    return const <PresensiParticipant>[];
  }
  final int totalPages = presensiParticipantPageCount(
    participants.length,
    pageSize: pageSize,
  );
  final int safePage = page.clamp(1, totalPages);
  final int start = (safePage - 1) * pageSize;
  final int requestedEnd = start + pageSize;
  final int end =
      requestedEnd < participants.length ? requestedEnd : participants.length;
  return participants.sublist(start, end);
}

class PresensiParticipantsState {
  const PresensiParticipantsState({
    this.items = const <PresensiParticipant>[],
    this.loading = true,
    this.errorMessage,
  });

  final List<PresensiParticipant> items;
  final bool loading;
  final String? errorMessage;

  bool get isInitialLoading => loading && items.isEmpty;
  bool get isRefreshing => loading && items.isNotEmpty;

  PresensiParticipantsState copyWith({
    List<PresensiParticipant>? items,
    bool? loading,
    String? errorMessage,
    bool clearError = false,
  }) =>
      PresensiParticipantsState(
        items: items ?? this.items,
        loading: loading ?? this.loading,
        errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
      );
}

class PresensiParticipantsController
    extends StateNotifier<PresensiParticipantsState> {
  PresensiParticipantsController({
    required ResourceDataSource repository,
    required String presensiId,
  })  : _repository = repository,
        _presensiId = presensiId,
        super(const PresensiParticipantsState());

  final ResourceDataSource _repository;
  final String _presensiId;
  bool _requestInFlight = false;

  Future<void> refresh() async {
    if (_requestInFlight) return;
    _requestInFlight = true;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final List<PresensiParticipant> participants =
          await _repository.participants(_presensiId);
      if (!mounted) return;
      state = PresensiParticipantsState(items: participants, loading: false);
    } on Object catch (error) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        errorMessage: error is AppException
            ? error.message
            : 'Peserta tidak dapat dimuat.',
      );
    } finally {
      _requestInFlight = false;
    }
  }
}

/// Returns true only for pushes that can change the roster of [presensiId].
/// Generic updates for other modules/sessions must not trigger a participant
/// request.
bool realtimeTargetsPresensiParticipants(JsonMap? event, String presensiId) {
  if (event == null) return false;
  final String type = stringValue(event['type']);
  if (type == 'presensi') {
    return stringValue(event['presensiId']) == presensiId;
  }
  if (type != 'mutation' || stringValue(event['module']) != 'PRESENSI') {
    return false;
  }
  final String entityId = stringValue(event['entityId']);
  return entityId.isEmpty || entityId == presensiId;
}

bool realtimeBatchTargetsPresensiParticipants(
  Iterable<JsonMap> events,
  JsonMap? fallbackEvent,
  String presensiId,
) {
  for (final JsonMap event in events) {
    if (realtimeTargetsPresensiParticipants(event, presensiId)) return true;
  }
  return events.isEmpty &&
      realtimeTargetsPresensiParticipants(fallbackEvent, presensiId);
}

final AutoDisposeStateNotifierProviderFamily<PresensiParticipantsController,
        PresensiParticipantsState, String> presensiParticipantsProvider =
    StateNotifierProvider.autoDispose.family<PresensiParticipantsController,
        PresensiParticipantsState, String>(
  (Ref<PresensiParticipantsState> ref, String presensiId) {
    final PresensiParticipantsController controller =
        PresensiParticipantsController(
      repository: ref.watch(resourceRepositoryProvider),
      presensiId: presensiId,
    );
    Future<void>.microtask(controller.refresh);
    return controller;
  },
);
