import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/features/resources/application/presensi_participants_controller.dart';
import 'package:laci_mobile/features/resources/data/resource_repository.dart';
import 'package:laci_mobile/features/resources/domain/resource_models.dart';
import 'package:mocktail/mocktail.dart';

class _MockResourceDataSource extends Mock implements ResourceDataSource {}

void main() {
  const PresensiParticipant participant = PresensiParticipant(
    id: 'participant-1',
    name: 'Aisyah',
    email: 'aisyah@example.test',
    phone: '08123456789',
    organization: 'IPPNU',
    level: 'PAC',
    position: 'Sekretaris',
    institution: 'PAC Barat',
    createdAt: null,
  );

  late _MockResourceDataSource repository;
  late PresensiParticipantsController controller;

  setUp(() {
    repository = _MockResourceDataSource();
    controller = PresensiParticipantsController(
      repository: repository,
      presensiId: 'presensi-1',
    );
  });

  tearDown(() => controller.dispose());

  PresensiParticipant rosterParticipant({
    required String id,
    required String name,
    required String organization,
    required String level,
    required String position,
    required String institution,
    required DateTime createdAt,
  }) =>
      PresensiParticipant(
        id: id,
        name: name,
        email: '$id@example.test',
        phone: '08123456789',
        organization: organization,
        level: level,
        position: position,
        institution: institution,
        createdAt: createdAt,
      );

  test('loads the participant roster and exposes a stable ready state',
      () async {
    when(() => repository.participants('presensi-1'))
        .thenAnswer((_) async => const <PresensiParticipant>[participant]);

    await controller.refresh();

    expect(controller.state.loading, isFalse);
    expect(controller.state.items, const <PresensiParticipant>[participant]);
    expect(controller.state.errorMessage, isNull);
  });

  test('coalesces overlapping realtime and polling refresh requests', () async {
    final Completer<List<PresensiParticipant>> response =
        Completer<List<PresensiParticipant>>();
    when(() => repository.participants('presensi-1'))
        .thenAnswer((_) => response.future);

    final Future<void> first = controller.refresh();
    final Future<void> duplicate = controller.refresh();
    response.complete(const <PresensiParticipant>[participant]);
    await Future.wait<void>(<Future<void>>[first, duplicate]);

    verify(() => repository.participants('presensi-1')).called(1);
    expect(controller.state.items.single.name, 'Aisyah');
  });

  test('targets only realtime events for the current presensi roster', () {
    expect(
      realtimeTargetsPresensiParticipants(
        <String, dynamic>{
          'type': 'presensi',
          'presensiId': 'presensi-1',
        },
        'presensi-1',
      ),
      isTrue,
    );
    expect(
      realtimeTargetsPresensiParticipants(
        <String, dynamic>{
          'type': 'presensi',
          'presensiId': 'presensi-2',
        },
        'presensi-1',
      ),
      isFalse,
    );
    expect(
      realtimeTargetsPresensiParticipants(
        <String, dynamic>{
          'type': 'mutation',
          'module': 'AGENDA_KEGIATAN',
          'entityId': 'presensi-1',
        },
        'presensi-1',
      ),
      isFalse,
    );
  });

  test('keeps a presensi event when another module ends the SSE batch', () {
    final List<Map<String, dynamic>> events = <Map<String, dynamic>>[
      <String, dynamic>{
        'type': 'presensi',
        'presensiId': 'presensi-1',
      },
      <String, dynamic>{
        'type': 'mutation',
        'module': 'ARSIP_SURAT',
        'entityId': 'arsip-1',
      },
    ];

    expect(
      realtimeBatchTargetsPresensiParticipants(
        events,
        events.last,
        'presensi-1',
      ),
      isTrue,
    );
  });

  test('searches every FE participant field and exposes five sort options', () {
    final List<PresensiParticipant> participants = <PresensiParticipant>[
      rosterParticipant(
        id: 'zain',
        name: 'Zain',
        organization: 'IPNU',
        level: 'PC',
        position: 'Ketua',
        institution: '',
        createdAt: DateTime.utc(2026, 8, 24, 10),
      ),
      rosterParticipant(
        id: 'aisyah',
        name: 'Aisyah',
        organization: 'UMUM',
        level: 'Eksternal',
        position: '',
        institution: 'Kampus Beta',
        createdAt: DateTime.utc(2026, 8, 24, 9),
      ),
      rosterParticipant(
        id: 'budi',
        name: 'Budi',
        organization: 'IPPNU',
        level: 'PAC',
        position: 'Sekretaris',
        institution: '',
        createdAt: DateTime.utc(2026, 8, 24, 8),
      ),
    ];

    expect(PresensiParticipantSortKey.values, hasLength(5));
    expect(
      filterAndSortPresensiParticipants(participants, search: 'kampus')
          .single
          .id,
      'aisyah',
    );
    expect(
      filterAndSortPresensiParticipants(participants, search: 'sekretaris')
          .single
          .id,
      'budi',
    );
    expect(
      filterAndSortPresensiParticipants(participants, search: 'eksternal')
          .single
          .id,
      'aisyah',
    );

    final Map<PresensiParticipantSortKey, List<String>> expectedAscending =
        <PresensiParticipantSortKey, List<String>>{
      PresensiParticipantSortKey.name: <String>['aisyah', 'budi', 'zain'],
      PresensiParticipantSortKey.organization: <String>[
        'zain',
        'budi',
        'aisyah',
      ],
      PresensiParticipantSortKey.level: <String>['aisyah', 'budi', 'zain'],
      PresensiParticipantSortKey.position: <String>['aisyah', 'zain', 'budi'],
      PresensiParticipantSortKey.createdAt: <String>['budi', 'aisyah', 'zain'],
    };
    for (final MapEntry<PresensiParticipantSortKey, List<String>> expectation
        in expectedAscending.entries) {
      expect(
        filterAndSortPresensiParticipants(
          participants,
          sortKey: expectation.key,
          ascending: true,
        ).map<String>((PresensiParticipant item) => item.id),
        expectation.value,
        reason: expectation.key.label,
      );
    }
  });

  test('defaults to newest attendance and paginates ten participants', () {
    final List<PresensiParticipant> participants =
        List<PresensiParticipant>.generate(
      23,
      (int index) => rosterParticipant(
        id: 'participant-$index',
        name: 'Peserta $index',
        organization: 'IPNU',
        level: 'PAC',
        position: 'Anggota',
        institution: '',
        createdAt: DateTime.utc(2026, 8, 24, 0, index),
      ),
    );

    final List<PresensiParticipant> sorted =
        filterAndSortPresensiParticipants(participants);
    expect(sorted.first.id, 'participant-22');
    expect(presensiParticipantPageCount(sorted.length), 3);
    expect(
      paginatePresensiParticipants(sorted, page: 1),
      hasLength(presensiParticipantsPerPage),
    );
    expect(
      paginatePresensiParticipants(sorted, page: 2),
      hasLength(presensiParticipantsPerPage),
    );
    expect(
      paginatePresensiParticipants(sorted, page: 3)
          .map<String>((PresensiParticipant item) => item.id),
      <String>['participant-2', 'participant-1', 'participant-0'],
    );
  });
}
