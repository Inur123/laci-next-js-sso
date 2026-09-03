import 'dart:io';
import 'dart:typed_data';

import 'package:excel/excel.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/errors/app_exception.dart';
import '../../../shared/models/json_value.dart';
import '../../auth/domain/app_user.dart';
import '../domain/resource_definition.dart';
import '../domain/resource_models.dart';

class ResourceSpreadsheetService {
  const ResourceSpreadsheetService();

  static const List<String> supportedImportExtensions = <String>['xlsx'];

  List<Map<String, dynamic>> parseImport(
    ResourceDefinition definition,
    Uint8List bytes,
  ) {
    final ResourceSpreadsheetDefinition spreadsheet =
        _configuration(definition);
    if (!spreadsheet.supportsImport) {
      throw const AppException(
        code: 'UNSUPPORTED_IMPORT',
        message: 'Resource ini tidak memiliki import Excel.',
      );
    }
    final Excel workbook;
    try {
      workbook = Excel.decodeBytes(bytes);
    } on Object {
      throw const AppException(
        code: 'INVALID_SPREADSHEET',
        message: 'File tidak dapat dibaca. Pastikan format file .xlsx benar.',
      );
    }
    if (workbook.tables.isEmpty) {
      throw const AppException(
        code: 'EMPTY_SPREADSHEET',
        message: 'File Excel tidak memiliki lembar kerja.',
      );
    }
    final Sheet sheet = workbook.tables.values.first;
    final List<List<Data?>> rows = sheet.rows;
    if (rows.length < 2) {
      throw const AppException(
        code: 'EMPTY_SPREADSHEET',
        message: 'File Excel kosong atau tidak memiliki data.',
      );
    }

    final Map<String, int> headerIndexes = <String, int>{};
    for (int index = 0; index < rows.first.length; index++) {
      final String header = _normalizeHeader(_cellText(rows.first[index]));
      if (header.isNotEmpty) headerIndexes.putIfAbsent(header, () => index);
    }
    final Map<SpreadsheetColumnDefinition, int> columns =
        <SpreadsheetColumnDefinition, int>{};
    final List<String> missing = <String>[];
    for (final SpreadsheetColumnDefinition column in spreadsheet.columns) {
      int? index;
      for (final String header in column.acceptedHeaders) {
        index = headerIndexes[_normalizeHeader(header)];
        if (index != null) break;
      }
      if (index == null) {
        if (!column.optional) missing.add(column.header);
      } else {
        columns[column] = index;
      }
    }
    if (missing.isNotEmpty) {
      throw AppException(
        code: 'MISSING_SPREADSHEET_COLUMNS',
        message: 'Kolom wajib tidak ditemukan: ${missing.join(', ')}.',
      );
    }

    final List<Map<String, dynamic>> result = <Map<String, dynamic>>[];
    for (int rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      final List<Data?> row = rows[rowIndex];
      if (row.every((Data? cell) => _cellText(cell).trim().isEmpty)) continue;
      final Map<String, dynamic> payload = <String, dynamic>{};
      for (final MapEntry<SpreadsheetColumnDefinition, int> entry
          in columns.entries) {
        final Data? cell = entry.value < row.length ? row[entry.value] : null;
        final String value = entry.key.kind == SpreadsheetValueKind.date
            ? _dateCellText(cell)
            : _cellText(cell).trim();
        if (value.isNotEmpty || !entry.key.optional) {
          payload[entry.key.key] = value;
        }
      }
      result.add(payload);
      if (result.length > spreadsheet.maxImportRows) {
        throw AppException(
          code: 'TOO_MANY_ROWS',
          message: 'Maksimal ${spreadsheet.maxImportRows} baris per import.',
        );
      }
    }
    if (result.isEmpty) {
      throw const AppException(
        code: 'EMPTY_SPREADSHEET',
        message: 'File Excel kosong atau tidak memiliki data.',
      );
    }
    return List<Map<String, dynamic>>.unmodifiable(result);
  }

  ResourceSpreadsheetDocument buildTemplate(
    ResourceDefinition definition,
  ) {
    final ResourceSpreadsheetDefinition spreadsheet =
        _configuration(definition);
    if (!spreadsheet.supportsImport) {
      throw const AppException(
        code: 'UNSUPPORTED_IMPORT',
        message: 'Resource ini tidak memiliki template import.',
      );
    }
    final Excel workbook = _workbook(spreadsheet.templateSheetName);
    final Sheet sheet = workbook[spreadsheet.templateSheetName];
    sheet.appendRow(
      spreadsheet.columns
          .map<CellValue?>((SpreadsheetColumnDefinition column) =>
              TextCellValue(column.header))
          .toList(growable: false),
    );
    sheet.appendRow(
      spreadsheet.columns
          .map<CellValue?>((SpreadsheetColumnDefinition column) =>
              TextCellValue(column.example))
          .toList(growable: false),
    );
    for (int index = 0; index < spreadsheet.columns.length; index++) {
      sheet.setColumnWidth(index, spreadsheet.columns[index].width);
    }
    _styleHeader(sheet, spreadsheet.columns.length, isCabang: false);
    return ResourceSpreadsheetDocument(
      bytes: _encode(workbook),
      name: spreadsheet.templateFileName!,
    );
  }

  ResourceSpreadsheetDocument buildExport(
    ResourceDefinition definition,
    List<ResourceItem> items,
    AppUser user, {
    DateTime? now,
    String? qualifier,
  }) {
    final ResourceSpreadsheetDefinition spreadsheet =
        _configuration(definition);
    if (items.isEmpty) {
      throw const AppException(
        code: 'EMPTY_EXPORT',
        message: 'Tidak ada data untuk diexport.',
      );
    }
    final Excel workbook = _workbook(spreadsheet.exportSheetName);
    final Sheet sheet = workbook[spreadsheet.exportSheetName];
    final List<SpreadsheetColumnDefinition> columns = spreadsheet.columns
        .where(
          (SpreadsheetColumnDefinition column) =>
              !column.cabangOnly || user.isCabang,
        )
        .where(
          (SpreadsheetColumnDefinition column) =>
              !column.omitWhenAllEmpty ||
              items.any(
                (ResourceItem item) =>
                    _exportValue(definition, column, item) != '-',
              ),
        )
        .toList(growable: false);
    sheet.appendRow(<CellValue?>[
      TextCellValue('No'),
      ...columns.map<CellValue?>(
        (SpreadsheetColumnDefinition column) => TextCellValue(column.header),
      ),
    ]);
    for (int index = 0; index < items.length; index++) {
      final ResourceItem item = items[index];
      sheet.appendRow(<CellValue?>[
        IntCellValue(index + 1),
        ...columns.map<CellValue?>(
          (SpreadsheetColumnDefinition column) => TextCellValue(
            _exportValue(definition, column, item),
          ),
        ),
      ]);
    }
    _styleHeader(
      sheet,
      columns.length + 1,
      isCabang: user.isCabang,
    );
    _sizeExportColumns(sheet, columns, items, definition);
    final DateTime date = now ?? DateTime.now();
    String prefix = user.isCabang && spreadsheet.cabangExportFilePrefix != null
        ? spreadsheet.cabangExportFilePrefix!
        : spreadsheet.exportFilePrefix;
    if (spreadsheet.qualifyWithPacFilter) {
      prefix = '${prefix}_${_safeFilePart(qualifier ?? 'All')}';
    }
    final String fileName =
        '${prefix}_${_two(date.day)}-${_two(date.month)}-${date.year}.xlsx';
    return ResourceSpreadsheetDocument(
      bytes: _encode(workbook),
      name: fileName,
    );
  }

  ResourceSpreadsheetDocument buildParticipantExport(
    ResourceItem presensi,
    List<PresensiParticipant> participants,
    AppUser user, {
    DateTime? now,
  }) {
    if (participants.isEmpty) {
      throw const AppException(
        code: 'EMPTY_EXPORT',
        message: 'Belum ada peserta untuk diexport.',
      );
    }
    const List<String> headers = <String>[
      'No',
      'Nama Lengkap',
      'Organisasi',
      'Tingkat',
      'Instansi',
      'Jabatan',
      'Waktu Absen',
    ];
    final Excel workbook = _workbook('Daftar Kehadiran');
    final Sheet sheet = workbook['Daftar Kehadiran'];
    sheet.appendRow(
      headers.map<CellValue?>((String value) => TextCellValue(value)).toList(),
    );
    for (int index = 0; index < participants.length; index++) {
      final PresensiParticipant participant = participants[index];
      sheet.appendRow(<CellValue?>[
        IntCellValue(index + 1),
        TextCellValue(_orDash(participant.name)),
        TextCellValue(
          participant.organization == 'UMUM'
              ? 'Eksternal'
              : _orDash(participant.organization),
        ),
        TextCellValue(_orDash(participant.level)),
        TextCellValue(_orDash(participant.institution)),
        TextCellValue(_orDash(participant.position)),
        TextCellValue(_shortIndonesianDateTime(participant.createdAt)),
      ]);
    }
    _styleHeader(sheet, headers.length, isCabang: user.isCabang);
    for (int column = 0; column < headers.length; column++) {
      int maxLength = headers[column].length;
      for (final List<Data?> row in sheet.rows.skip(1)) {
        final int length =
            column < row.length ? _cellText(row[column]).length : 0;
        if (length > maxLength) maxLength = length;
      }
      sheet.setColumnWidth(column, (maxLength + 2).clamp(8, 50).toDouble());
    }
    final DateTime date = now ?? DateTime.now();
    final String activity = _safeDocumentPart(
      presensi.text('namaKegiatan', 'Kegiatan'),
    );
    return ResourceSpreadsheetDocument(
      bytes: _encode(workbook),
      name:
          'Presensi-$activity-${_two(date.day)}-${_two(date.month)}-${date.year}.xlsx',
    );
  }

  ResourceSpreadsheetDefinition _configuration(
    ResourceDefinition definition,
  ) {
    final ResourceSpreadsheetDefinition? value = definition.spreadsheet;
    if (value == null) {
      throw const AppException(
        code: 'UNSUPPORTED_SPREADSHEET',
        message: 'Resource ini tidak memiliki fitur Excel.',
      );
    }
    return value;
  }

  Excel _workbook(String sheetName) {
    final Excel workbook = Excel.createExcel();
    if (sheetName != 'Sheet1') workbook.rename('Sheet1', sheetName);
    workbook.setDefaultSheet(sheetName);
    return workbook;
  }

  Uint8List _encode(Excel workbook) {
    final List<int>? encoded = workbook.encode();
    if (encoded == null || encoded.isEmpty) {
      throw const AppException(
        code: 'SPREADSHEET_ENCODE_FAILED',
        message: 'File Excel tidak dapat dibuat.',
      );
    }
    return Uint8List.fromList(encoded);
  }

  void _styleHeader(Sheet sheet, int columnCount, {required bool isCabang}) {
    final CellStyle style = CellStyle(
      bold: true,
      fontFamily: 'Arial',
      fontColorHex: ExcelColor.white,
      backgroundColorHex: ExcelColor.fromHexString(
        isCabang ? 'FF3B82F6' : 'FF10B981',
      ),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );
    for (int column = 0; column < columnCount; column++) {
      sheet
          .cell(CellIndex.indexByColumnRow(columnIndex: column, rowIndex: 0))
          .cellStyle = style;
    }
    sheet.setRowHeight(0, 24);
  }

  void _sizeExportColumns(
    Sheet sheet,
    List<SpreadsheetColumnDefinition> columns,
    List<ResourceItem> items,
    ResourceDefinition definition,
  ) {
    sheet.setColumnWidth(0, 7);
    for (int columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      final SpreadsheetColumnDefinition column = columns[columnIndex];
      int length = column.header.length;
      for (final ResourceItem item in items) {
        final int valueLength = _exportValue(definition, column, item).length;
        if (valueLength > length) length = valueLength;
      }
      sheet.setColumnWidth(
        columnIndex + 1,
        (length + 2).clamp(10, 50).toDouble(),
      );
    }
  }

  String _exportValue(
    ResourceDefinition definition,
    SpreadsheetColumnDefinition column,
    ResourceItem item,
  ) {
    if (column.kind == SpreadsheetValueKind.education) {
      return _educationValue(item[column.key], column.matchValue);
    }
    if (column.kind == SpreadsheetValueKind.training) {
      return _trainingValue(item[column.key], column.matchValue);
    }
    final Object? raw = column.kind == SpreadsheetValueKind.nested
        ? jsonMap(item[column.key])[column.nestedKey]
        : item[column.key];
    if (raw == null || raw.toString().trim().isEmpty) return '-';
    if (column.kind == SpreadsheetValueKind.date) {
      final DateTime? date = DateTime.tryParse(raw.toString());
      return date == null ? raw.toString() : _longIndonesianDate(date);
    }
    if (column.kind == SpreadsheetValueKind.dateTime) {
      final DateTime? date = DateTime.tryParse(raw.toString())?.toLocal();
      return date == null
          ? raw.toString()
          : '${_longIndonesianDate(date)}, ${_two(date.hour)}:${_two(date.minute)}';
    }
    if (column.kind == SpreadsheetValueKind.option) {
      for (final FieldDefinition field in definition.fields) {
        if (field.key == column.key) return field.optionLabel(raw);
      }
    }
    return raw.toString();
  }

  String _educationValue(Object? raw, String? level) {
    if (raw is! List) return '-';
    for (final Object? value in raw) {
      final Map<String, dynamic> row = jsonMap(value);
      if (stringValue(row['jenjang']) == level) {
        final String school = stringValue(row['namaSekolah']).trim();
        return school.isEmpty ? '-' : school;
      }
    }
    return '-';
  }

  String _trainingValue(Object? raw, String? training) {
    if (raw is! List) return '-';
    final List<String> values = <String>[];
    for (final Object? value in raw) {
      final Map<String, dynamic> row = jsonMap(value);
      if (stringValue(row['namaPerkaderan']).toUpperCase() != training) {
        continue;
      }
      final DateTime? date = DateTime.tryParse(stringValue(row['tanggal']));
      final String place = stringValue(row['tempat']).trim();
      final String dateLabel = date == null
          ? stringValue(row['tanggal'])
          : _longIndonesianDate(date);
      values.add(place.isEmpty ? dateLabel : '$dateLabel ($place)');
    }
    return values.isEmpty ? '-' : values.join(', ');
  }

  String _longIndonesianDate(DateTime date) {
    const List<String> months = <String>[
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  String _shortIndonesianDateTime(DateTime? value) {
    if (value == null) return '-';
    const List<String> months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    final DateTime date = value.toLocal();
    return '${_two(date.day)} ${months[date.month - 1]} ${date.year}, '
        '${_two(date.hour)}:${_two(date.minute)}';
  }

  String _orDash(String value) => value.trim().isEmpty ? '-' : value;

  String _safeDocumentPart(String value) {
    final String safe = value
        .trim()
        .replaceAll(RegExp(r'[\\/:*?"<>|]'), '_')
        .replaceAll(RegExp(r'\s+'), ' ');
    return safe.isEmpty ? 'Kegiatan' : safe;
  }

  String _dateCellText(Data? cell) {
    final CellValue? value = cell?.value;
    if (value is DateCellValue) {
      return '${value.year}-${_two(value.month)}-${_two(value.day)}';
    }
    if (value is DateTimeCellValue) {
      return '${value.year}-${_two(value.month)}-${_two(value.day)}';
    }
    return _cellText(cell).trim();
  }

  String _cellText(Data? cell) {
    final CellValue? value = cell?.value;
    if (value == null) return '';
    if (value is TextCellValue) return value.value.toString();
    return value.toString();
  }

  String _normalizeHeader(String value) =>
      value.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  String _two(int value) => value.toString().padLeft(2, '0');

  String _safeFilePart(String value) {
    final String safe = value
        .trim()
        .replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_')
        .replaceAll(RegExp('_+'), '_')
        .replaceAll(RegExp(r'^_+|_+$'), '');
    return safe.isEmpty ? 'All' : safe;
  }
}

class ResourceSpreadsheetFileActions {
  const ResourceSpreadsheetFileActions();

  Future<DownloadedResourceFile> save(
    ResourceSpreadsheetDocument document,
  ) async {
    final Directory directory = await getApplicationDocumentsDirectory();
    final File file = File('${directory.path}/${document.name}');
    await file.writeAsBytes(document.bytes, flush: true);
    return DownloadedResourceFile(path: file.path, name: document.name);
  }

  Future<void> open(DownloadedResourceFile file) => OpenFilex.open(file.path);

  Future<void> share(
    DownloadedResourceFile file, {
    required String subject,
  }) =>
      Share.shareXFiles(
        <XFile>[XFile(file.path)],
        subject: subject,
        fileNameOverrides: <String>[file.name],
      );
}
