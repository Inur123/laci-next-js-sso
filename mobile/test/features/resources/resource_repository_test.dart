import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/core/errors/app_exception.dart';
import 'package:laci_mobile/core/network/api_client.dart';
import 'package:laci_mobile/features/resources/data/resource_repository.dart';
import 'package:laci_mobile/features/resources/domain/resource_definition.dart';
import 'package:laci_mobile/features/resources/domain/resource_definitions.dart';
import 'package:laci_mobile/features/resources/domain/resource_models.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  late _MockApiClient apiClient;
  late ResourceRepository repository;

  setUp(() {
    apiClient = _MockApiClient();
    repository = ResourceRepository(apiClient);
  });

  test('lists data using search, filter, pagination, sort, and scope',
      () async {
    when(
      () => apiClient.get(
        '/pengajuan-berkas',
        query: any<Map<String, dynamic>>(named: 'query'),
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'p-1',
            'keperluan': 'Surat rekomendasi',
            'status': 'PENDING',
          },
        ],
        'pagination': <String, dynamic>{
          'page': 2,
          'limit': 10,
          'total': 11,
          'totalPages': 2,
        },
      },
    );

    const ResourceQuery query = ResourceQuery(
      search: 'rekomendasi',
      page: 2,
      filters: <String, String>{'status': 'PENDING'},
      sortKey: 'tanggal',
      sortAscending: false,
      scope: ResourceScope.review,
    );
    final ResourcePageData result =
        await repository.list(pengajuanResource, query);

    expect(result.items.single.id, 'p-1');
    expect(result.pagination.total, 11);
    final Map<String, dynamic> sentQuery = verify(
      () => apiClient.get(
        '/pengajuan-berkas',
        query: captureAny<Map<String, dynamic>>(named: 'query'),
      ),
    ).captured.single as Map<String, dynamic>;
    expect(sentQuery['scope'], 'review');
    expect(sentQuery['search'], 'rekomendasi');
    expect(sentQuery['status'], 'PENDING');
    expect(sentQuery['sortDir'], 'desc');
  });

  test('uploads a file before creating the domain resource', () async {
    final Directory directory = await Directory.systemTemp.createTemp(
      'laci-resource-test-',
    );
    final File fixture = File('${directory.path}/lampiran.pdf');
    await fixture.writeAsBytes(<int>[
      0x25,
      0x50,
      0x44,
      0x46,
      0x2D,
      0x31,
      0x2E,
      0x37,
    ]);
    when(
      () => apiClient.upload(
        path: '/files',
        filePath: fixture.path,
        fileName: 'lampiran.pdf',
        prefix: 'pengajuan-berkas',
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{'key': 'pengajuan-berkas/key-pdf.enc'},
      },
    );
    when(
      () => apiClient.post(
        '/pengajuan-berkas',
        data: any<Object>(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{
        'data': <String, dynamic>{
          'id': 'created-1',
          'keperluan': 'Permohonan izin',
        },
      },
    );

    final ResourceItem created = await repository.create(
      pengajuanResource,
      ResourceDraft(
        values: <String, dynamic>{
          'noSurat': '001/PAC/I/2026',
          'penerima': 'IPNU',
          'tanggal': '2026-08-24T00:00:00Z',
          'keperluan': 'Permohonan izin',
        },
        file: LocalResourceFile(
          path: fixture.path,
          name: 'lampiran.pdf',
          size: await fixture.length(),
        ),
      ),
    );

    expect(created.id, 'created-1');
    final Map<String, dynamic> payload = verify(
      () => apiClient.post(
        '/pengajuan-berkas',
        data: captureAny<Object>(named: 'data'),
      ),
    ).captured.single as Map<String, dynamic>;
    expect(payload['file'], 'pengajuan-berkas/key-pdf.enc');
    expect(payload['fileName'], 'lampiran.pdf');
    await directory.delete(recursive: true);
  });

  test('rejects oversized files before making an upload request', () async {
    final Future<ResourceItem> result = repository.create(
      arsipResource,
      const ResourceDraft(
        values: <String, dynamic>{},
        file: LocalResourceFile(
          path: '/tmp/large.pdf',
          name: 'large.pdf',
          size: 2 * 1024 * 1024 + 1,
        ),
      ),
    );

    await expectLater(
      result,
      throwsA(
        isA<AppException>().having(
          (AppException error) => error.code,
          'code',
          'FILE_TOO_LARGE',
        ),
      ),
    );
    verifyNever(
      () => apiClient.upload(
        path: any<String>(named: 'path'),
        filePath: any<String>(named: 'filePath'),
        fileName: any<String>(named: 'fileName'),
        prefix: any<String>(named: 'prefix'),
      ),
    );
  });

  test('uses a short-lived token for downloading', () async {
    final ResourceItem item = ResourceItem(<String, dynamic>{
      'id': 'arsip-1',
      'perihal': 'Undangan',
      'file': 'arsip/key-pdf.enc',
    });
    when(
      () => apiClient.post('/arsip/arsip-1/download-token', query: null),
    ).thenAnswer(
      (_) async => <String, dynamic>{'token': 'five-minute-token'},
    );
    when(
      () => apiClient.download(
        '/arsip/arsip-1/download',
        query: <String, dynamic>{'token': 'five-minute-token'},
        skipUnauthorizedCallback: true,
      ),
    ).thenAnswer((_) async => Uint8List.fromList(<int>[1, 2, 3]));

    final Uint8List bytes = await repository.download(arsipResource, item);

    expect(bytes, <int>[1, 2, 3]);
    verify(
      () => apiClient.post('/arsip/arsip-1/download-token', query: null),
    ).called(1);
  });

  test('rejects a renamed file whose bytes do not match its extension',
      () async {
    final Directory directory = await Directory.systemTemp.createTemp(
      'laci-invalid-file-test-',
    );
    final File fixture = File('${directory.path}/renamed.pdf');
    await fixture.writeAsString('this is not a PDF');

    await expectLater(
      repository.create(
        arsipResource,
        ResourceDraft(
          values: const <String, dynamic>{},
          file: LocalResourceFile(
            path: fixture.path,
            name: 'renamed.pdf',
            size: await fixture.length(),
          ),
        ),
      ),
      throwsA(
        isA<AppException>().having(
          (AppException error) => error.code,
          'code',
          'INVALID_FILE_CONTENT',
        ),
      ),
    );
    verifyNever(
      () => apiClient.upload(
        path: any<String>(named: 'path'),
        filePath: any<String>(named: 'filePath'),
        fileName: any<String>(named: 'fileName'),
        prefix: any<String>(named: 'prefix'),
      ),
    );
    await directory.delete(recursive: true);
  });

  test('re-mints an expired download token once and preserves reference scope',
      () async {
    final ResourceItem item = ResourceItem(<String, dynamic>{
      'id': 'reference-1',
      'file': 'pengajuan-berkas/key-pdf.enc',
    });
    int tokenRequest = 0;
    when(
      () => apiClient.post(
        '/pengajuan-berkas/reference-1/download-token',
        query: <String, dynamic>{'scope': 'reference'},
      ),
    ).thenAnswer((_) async {
      tokenRequest++;
      return <String, dynamic>{'token': 'token-$tokenRequest'};
    });
    when(
      () => apiClient.download(
        '/pengajuan-berkas/reference-1/download',
        query: <String, dynamic>{'token': 'token-1'},
        skipUnauthorizedCallback: true,
      ),
    ).thenThrow(
      const AppException(
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Token kedaluwarsa',
      ),
    );
    when(
      () => apiClient.download(
        '/pengajuan-berkas/reference-1/download',
        query: <String, dynamic>{'token': 'token-2'},
        skipUnauthorizedCallback: true,
      ),
    ).thenAnswer((_) async => Uint8List.fromList(<int>[9, 8, 7]));

    final Uint8List result = await repository.download(
      pengajuanResource,
      item,
      scope: ResourceScope.reference,
    );

    expect(result, <int>[9, 8, 7]);
    verify(
      () => apiClient.post(
        '/pengajuan-berkas/reference-1/download-token',
        query: <String, dynamic>{'scope': 'reference'},
      ),
    ).called(2);
  });

  test('sends exact member copy and review workflow contracts', () async {
    when(
      () => apiClient.post(
        '/anggota/copy-period',
        data: any<Object>(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{'message': '2 anggota disalin'},
    );
    when(
      () => apiClient.patch(
        '/pengajuan-berkas/p-1/status',
        data: any<Object>(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{'message': 'Status diperbarui'},
    );

    await repository.copyMembers(
      ids: <String>['a-1', 'a-2'],
      sourcePeriodId: 'period-old',
      targetPeriodId: 'period-active',
    );
    await repository.updateApplicationStatus(
      'p-1',
      'DITOLAK',
      reason: 'Lampiran belum lengkap',
    );

    final Map<String, dynamic> copyPayload = verify(
      () => apiClient.post(
        '/anggota/copy-period',
        data: captureAny<Object>(named: 'data'),
      ),
    ).captured.single as Map<String, dynamic>;
    expect(copyPayload, <String, dynamic>{
      'anggotaIds': <String>['a-1', 'a-2'],
      'sourcePeriodeId': 'period-old',
      'targetPeriodeId': 'period-active',
    });
    final Map<String, dynamic> statusPayload = verify(
      () => apiClient.patch(
        '/pengajuan-berkas/p-1/status',
        data: captureAny<Object>(named: 'data'),
      ),
    ).captured.single as Map<String, dynamic>;
    expect(statusPayload['status'], 'DITOLAK');
    expect(statusPayload['reason'], 'Lampiran belum lengkap');
  });

  test('imports spreadsheet rows through the exact backend contract', () async {
    when(
      () => apiClient.post(
        '/imports/arsip',
        data: any<Object>(named: 'data'),
        receiveTimeout: const Duration(minutes: 2),
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{
        'success': 1,
        'failed': 1,
        'errors': <String>['Baris 3: tanggal tidak valid'],
        'message': '1 data berhasil diimpor',
      },
    );

    final SpreadsheetImportResult result = await repository.importSpreadsheet(
      arsipResource,
      <Map<String, dynamic>>[
        <String, dynamic>{
          'noSurat': '001/A/2026',
          'jenisSurat': 'MASUK',
          'tanggal': '2026-08-24',
        },
      ],
      'arsip.xlsx',
    );

    expect(result.success, 1);
    expect(result.failed, 1);
    expect(result.errors.single, contains('Baris 3'));
    final Map<String, dynamic> payload = verify(
      () => apiClient.post(
        '/imports/arsip',
        data: captureAny<Object>(named: 'data'),
        receiveTimeout: const Duration(minutes: 2),
      ),
    ).captured.single as Map<String, dynamic>;
    expect(payload['fileName'], 'arsip.xlsx');
    expect(payload['rows'], isA<List<Map<String, dynamic>>>());
  });

  test('logs spreadsheet export with the backend module identifier', () async {
    when(
      () => apiClient.post(
        '/exports/log',
        data: any<Object>(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => <String, dynamic>{'message': 'Export tercatat'},
    );

    await repository.logSpreadsheetExport(
      berkasSpResource,
      'Berkas_SP_24-08-2026.xlsx',
    );

    final Map<String, dynamic> payload = verify(
      () => apiClient.post(
        '/exports/log',
        data: captureAny<Object>(named: 'data'),
      ),
    ).captured.single as Map<String, dynamic>;
    expect(payload, <String, dynamic>{
      'module': 'BERKAS_SP',
      'fileName': 'Berkas_SP_24-08-2026.xlsx',
    });
  });

  test('collects every backend page for spreadsheet export', () async {
    int request = 0;
    when(
      () => apiClient.get(
        '/berkas-pimpinan',
        query: any<Map<String, dynamic>>(named: 'query'),
      ),
    ).thenAnswer((_) async {
      request++;
      return <String, dynamic>{
        'data': <Map<String, dynamic>>[
          <String, dynamic>{'id': 'item-$request', 'nama': 'Berkas $request'},
        ],
        'pagination': <String, dynamic>{
          'page': request,
          'limit': 100,
          'total': 2,
          'totalPages': 2,
        },
      };
    });

    final List<ResourceItem> items = await repository.listForExport(
      berkasPimpinanResource,
      const ResourceQuery(search: 'ketua', sortKey: 'tanggal'),
    );

    expect(items.map<String>((ResourceItem item) => item.id),
        <String>['item-1', 'item-2']);
    final List<dynamic> captured = verify(
      () => apiClient.get(
        '/berkas-pimpinan',
        query: captureAny<Map<String, dynamic>>(named: 'query'),
      ),
    ).captured;
    expect(captured, hasLength(2));
    expect((captured.first as Map<String, dynamic>)['page'], 1);
    expect((captured.last as Map<String, dynamic>)['page'], 2);
    expect((captured.last as Map<String, dynamic>)['limit'], 100);
  });
}
