import 'dart:typed_data';

import 'package:excel/excel.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/core/errors/app_exception.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:laci_mobile/features/resources/data/resource_spreadsheet_service.dart';
import 'package:laci_mobile/features/resources/domain/resource_definition.dart';
import 'package:laci_mobile/features/resources/domain/resource_definitions.dart';
import 'package:laci_mobile/features/resources/domain/resource_models.dart';

void main() {
  const ResourceSpreadsheetService service = ResourceSpreadsheetService();
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

  test('builds exact FE-compatible templates for all supported resources', () {
    final Map<ResourceDefinition, List<String>> expected =
        <ResourceDefinition, List<String>>{
      arsipResource: <String>[
        'No. Surat',
        'Jenis Surat',
        'Organisasi',
        'Tanggal',
        'Pengirim/Penerima',
        'Perihal',
        'Deskripsi',
      ],
      berkasPimpinanResource: <String>['Nama', 'Tanggal', 'Catatan'],
      berkasSpResource: <String>[
        'Nama Pimpinan',
        'Organisasi',
        'Tanggal Mulai',
        'Tanggal Berakhir',
        'Catatan',
      ],
    };

    for (final MapEntry<ResourceDefinition, List<String>> entry
        in expected.entries) {
      final ResourceSpreadsheetDocument document =
          service.buildTemplate(entry.key);
      final ResourceSpreadsheetDefinition spreadsheet = entry.key.spreadsheet!;
      final Excel decoded = Excel.decodeBytes(document.bytes);

      expect(document.name, spreadsheet.templateFileName);
      expect(decoded.tables.keys, contains(spreadsheet.templateSheetName));
      expect(
        _rowText(decoded[spreadsheet.templateSheetName].rows.first),
        entry.value,
      );
      expect(
        _rowText(decoded[spreadsheet.templateSheetName].rows[1]),
        spreadsheet.columns
            .map<String>((SpreadsheetColumnDefinition item) => item.example),
      );
    }
  });

  test('parses aliases and typed Excel dates into backend import rows', () {
    final Excel workbook = Excel.createExcel();
    final Sheet sheet = workbook['Sheet1'];
    sheet.appendRow(<CellValue?>[
      TextCellValue('Nama Pimpinan'),
      TextCellValue('Tanggal'),
      TextCellValue('Catatan'),
    ]);
    sheet.appendRow(<CellValue?>[
      TextCellValue('Dokumen Ketua'),
      const DateCellValue(year: 2026, month: 8, day: 24),
      null,
    ]);

    final List<Map<String, dynamic>> rows = service.parseImport(
      berkasPimpinanResource,
      Uint8List.fromList(workbook.encode()!),
    );

    expect(rows, <Map<String, dynamic>>[
      <String, dynamic>{
        'nama': 'Dokumen Ketua',
        'tanggal': '2026-08-24',
      },
    ]);
  });

  test('rejects missing required headers before calling the backend', () {
    final Excel workbook = Excel.createExcel();
    workbook['Sheet1'].appendRow(<CellValue?>[TextCellValue('Catatan')]);
    workbook['Sheet1'].appendRow(<CellValue?>[TextCellValue('Tidak lengkap')]);

    expect(
      () => service.parseImport(
        berkasSpResource,
        Uint8List.fromList(workbook.encode()!),
      ),
      throwsA(
        isA<AppException>().having(
          (AppException error) => error.code,
          'code',
          'MISSING_SPREADSHEET_COLUMNS',
        ),
      ),
    );
  });

  test('exports exact headers, localized values, and role-aware file names',
      () {
    final List<ResourceItem> items = <ResourceItem>[
      ResourceItem(<String, dynamic>{
        'id': 'arsip-1',
        'noSurat': '001/A/VIII/2026',
        'jenisSurat': 'MASUK',
        'organisasi': 'BERSAMA',
        'tanggal': '2026-08-24T00:00:00Z',
        'pengirimPenerima': 'PC Magetan',
        'perihal': 'Undangan rapat',
        'deskripsi': null,
      }),
    ];

    final ResourceSpreadsheetDocument pacDocument = service.buildExport(
      arsipResource,
      items,
      pac,
      now: DateTime(2026, 8, 24),
    );
    final ResourceSpreadsheetDocument cabangDocument = service.buildExport(
      arsipResource,
      items,
      cabang,
      now: DateTime(2026, 8, 24),
    );
    final Sheet sheet = Excel.decodeBytes(
        pacDocument.bytes)[arsipResource.spreadsheet!.exportSheetName];

    expect(pacDocument.name, 'Arsip_Surat_PAC_24-08-2026.xlsx');
    expect(cabangDocument.name, 'Arsip_Surat_Cabang_24-08-2026.xlsx');
    expect(_rowText(sheet.rows.first), <String>[
      'No',
      'No. Surat',
      'Jenis Surat',
      'Organisasi',
      'Tanggal',
      'Pengirim/Penerima',
      'Perihal',
      'Deskripsi',
    ]);
    expect(_rowText(sheet.rows[1]), <String>[
      '1',
      '001/A/VIII/2026',
      'Surat masuk',
      'Bersama',
      '24 Agustus 2026',
      'PC Magetan',
      'Undangan rapat',
      '-',
    ]);
  });

  test('separates import modules from export-only resources', () {
    expect(arsipResource.spreadsheet?.supportsImport, isTrue);
    expect(berkasPimpinanResource.spreadsheet?.supportsImport, isTrue);
    expect(berkasSpResource.spreadsheet?.supportsImport, isTrue);
    expect(anggotaResource.spreadsheet?.supportsImport, isFalse);
    expect(agendaResource.spreadsheet?.supportsImport, isFalse);
    expect(pengajuanResource.spreadsheet?.supportsImport, isFalse);
    expect(wilayahResource.spreadsheet, isNull);
    expect(presensiResource.spreadsheet, isNull);
  });
}

List<String> _rowText(List<Data?> row) => row
    .map<String>((Data? cell) => cell?.value?.toString() ?? '')
    .toList(growable: false);
