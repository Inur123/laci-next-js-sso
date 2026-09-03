import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:laci_mobile/features/resources/data/resource_file_actions.dart';
import 'package:laci_mobile/features/resources/data/resource_spreadsheet_service.dart';
import 'package:laci_mobile/features/resources/domain/resource_definition.dart';
import 'package:laci_mobile/features/resources/domain/resource_definitions.dart';
import 'package:laci_mobile/features/resources/domain/resource_models.dart';

void main() {
  const AppUser pac = AppUser(
    id: 'pac-1',
    name: 'PAC Barat',
    email: 'pac@example.test',
    role: UserRole.pac,
    isActive: true,
    emailVerified: true,
  );
  const AppUser cabang = AppUser(
    id: 'cabang-1',
    name: 'PC Magetan',
    email: 'cabang@example.test',
    role: UserRole.cabang,
    isActive: true,
    emailVerified: true,
  );

  test('registers every backend resource exactly once', () {
    expect(
      resourceDefinitions.map((ResourceDefinition item) => item.key),
      <String>[
        'wilayah',
        'anggota',
        'agenda-kegiatan',
        'arsip',
        'berkas-pimpinan',
        'berkas-sp',
        'pengajuan-berkas',
        'presensi',
      ],
    );
    expect(resourceDefinitionFor('arsip'), same(arsipResource));
    expect(() => resourceDefinitionFor('unknown'), throwsArgumentError);
  });

  test('matches backend upload prefixes and size limits', () {
    expect(arsipResource.fileField?.uploadPrefix, 'arsip');
    expect(arsipResource.fileField?.maxFileBytes, 2 * 1024 * 1024);
    expect(
      berkasPimpinanResource.fileField?.uploadPrefix,
      'berkas-pimpinan',
    );
    expect(
      berkasPimpinanResource.fileField?.maxFileBytes,
      5 * 1024 * 1024,
    );
    expect(berkasPimpinanResource.fileField?.requiredOnCreate, isTrue);
    expect(berkasSpResource.fileField?.uploadPrefix, 'berkas-sp');
    expect(berkasSpResource.fileField?.maxFileBytes, 2 * 1024 * 1024);
    expect(pengajuanResource.fileField?.uploadPrefix, 'pengajuan-berkas');
    expect(pengajuanResource.fileField?.requiredOnCreate, isTrue);
    expect(pengajuanResource.fileField?.requiredOnEdit, isFalse);
    expect(
      arsipResource.fileField?.acceptedExtensions,
      containsAll(<String>['ppt', 'pptx', 'webp']),
    );
  });

  test('offers only executable spreadsheet and backend sort contracts', () {
    expect(
      ResourceSpreadsheetService.supportedImportExtensions,
      const <String>['xlsx'],
    );
    expect(
      agendaResource.sorts.map((SortDefinition sort) => sort.key),
      contains('status'),
    );
    expect(
      berkasSpResource.sorts.map((SortDefinition sort) => sort.key),
      contains('status'),
    );
    expect(
      pengajuanResource.sorts.map((SortDefinition sort) => sort.key),
      contains('pengaju'),
    );
    expect(pengajuanResource.searchHint, contains('pengaju'));
    final FieldDefinition formOrganization = berkasSpResource.formFields
        .firstWhere((FieldDefinition field) => field.key == 'organisasi');
    final FilterDefinition filterOrganization = berkasSpResource.filters
        .firstWhere(
            (FilterDefinition filter) => filter.queryKey == 'organisasi');
    expect(
      formOrganization.options.map((ResourceOption option) => option.value),
      isNot(contains('BERSAMA')),
    );
    expect(
      filterOrganization.options.map((ResourceOption option) => option.value),
      contains('BERSAMA'),
    );
  });

  test('distinguishes a Berkas SP that expires today', () {
    final DateTime today = DateTime.now();
    final ResourceItem item = ResourceItem(<String, dynamic>{
      'id': 'sp-1',
      'nama': 'SP PAC Barat',
      'organisasi': 'IPNU',
      'tanggalBerakhir': today.toIso8601String(),
      'status': 'HAMPIR_HABIS',
    });
    final FieldDefinition status = berkasSpResource.fields.firstWhere(
      (FieldDefinition field) => field.key == 'status',
    );

    expect(item['status'], 'BERAKHIR_HARI_INI');
    expect(status.optionLabel(item['status']), 'Berakhir Hari Ini!');
  });

  test('enforces mobile role and workflow permissions', () {
    final Map<String, dynamic> pending = <String, dynamic>{
      'id': 'p-1',
      'status': 'PENDING',
      'file': 'pengajuan/file-pdf.enc',
    };
    final Map<String, dynamic> accepted = <String, dynamic>{
      ...pending,
      'status': 'DITERIMA',
    };

    expect(wilayahResource.canCreate(pac, ResourceScope.mine), isTrue);
    expect(wilayahResource.canCreate(cabang, ResourceScope.mine), isFalse);
    expect(agendaResource.canAccess(pac), isFalse);
    expect(agendaResource.canAccess(cabang), isTrue);
    expect(pengajuanResource.canCreate(pac, ResourceScope.mine), isTrue);
    expect(pengajuanResource.canCreate(cabang, ResourceScope.review), isFalse);
    expect(
      pengajuanResource.canEdit(pac, ResourceScope.mine, pending),
      isTrue,
    );
    expect(
      pengajuanResource.canEdit(pac, ResourceScope.mine, accepted),
      isFalse,
    );
    expect(
      pengajuanResource.canReviewStatus(cabang, ResourceScope.review),
      isTrue,
    );
    expect(
      pengajuanResource.canDownload(pac, ResourceScope.reference, pending),
      isTrue,
    );
    expect(anggotaResource.canVerifyMember(cabang), isTrue);
    expect(anggotaResource.canVerifyMember(pac), isFalse);
  });

  test('serializes list query without ALL filters', () {
    const ResourceQuery query = ResourceQuery(
      search: 'surat undangan',
      page: 2,
      limit: 20,
      scope: ResourceScope.review,
      sortKey: 'tanggal',
      sortAscending: true,
      filters: <String, String>{
        'status': 'PENDING',
        'penerima': 'ALL',
      },
    );

    expect(query.toApiQuery(), <String, dynamic>{
      'page': 2,
      'limit': 20,
      'search': 'surat undangan',
      'scope': 'review',
      'sortKey': 'tanggal',
      'sortDir': 'asc',
      'status': 'PENDING',
    });
  });

  test('serializes the Pengaju sort contract', () {
    const ResourceQuery query = ResourceQuery(
      sortKey: 'pengaju',
      sortAscending: true,
      scope: ResourceScope.reference,
    );

    expect(query.toApiQuery(), <String, dynamic>{
      'page': 1,
      'limit': 10,
      'scope': 'reference',
      'sortKey': 'pengaju',
      'sortDir': 'asc',
    });
  });

  test('suggests a safe file name from encrypted storage key', () {
    final ResourceItem item = ResourceItem(<String, dynamic>{
      'id': 'a-1',
      'perihal': 'Undangan / Rapat',
      'file': 'arsip/123-random-pdf.enc',
    });
    expect(
      ResourceFileActions.suggestedName(arsipResource, item),
      'Undangan_Rapat.pdf',
    );
  });
}
