import 'dart:io';
import 'dart:typed_data';

import '../../../core/errors/app_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/models/json_value.dart';
import '../domain/resource_definition.dart';
import '../domain/resource_models.dart';

abstract interface class ResourceDataSource {
  Future<ResourcePageData> list(
    ResourceDefinition definition,
    ResourceQuery query,
  );

  Future<List<ResourceItem>> listForExport(
    ResourceDefinition definition,
    ResourceQuery query,
  );

  Future<ResourceStats> stats(
    ResourceDefinition definition,
    ResourceQuery query,
  );

  Future<ResourceItem> detail(
    ResourceDefinition definition,
    String id, {
    ResourceScope scope,
  });

  Future<ResourceItem> create(
    ResourceDefinition definition,
    ResourceDraft draft,
  );

  Future<ResourceItem> update(
    ResourceDefinition definition,
    String id,
    ResourceDraft draft,
  );

  Future<String> delete(ResourceDefinition definition, String id);

  Future<String> updateMemberStatus(
    String id,
    String status, {
    String? reason,
  });

  Future<String> updateApplicationStatus(
    String id,
    String status, {
    String? reason,
  });

  Future<String> copyMembers({
    required List<String> ids,
    required String sourcePeriodId,
    required String targetPeriodId,
  });

  Future<String> copyWilayah({
    required List<String> ids,
    required String type,
  });

  Future<List<ResourcePeriodRef>> periods();

  Future<List<ResourceItem>> membersForPeriod(String periodId);

  Future<List<ResourceDirectoryUser>> pacDirectory();

  Future<List<AgendaHoliday>> agendaHolidays(int year);

  Future<List<PresensiParticipant>> participants(String presensiId);

  Future<Uint8List> memberImage(String memberId);

  Future<Uint8List> download(
    ResourceDefinition definition,
    ResourceItem item, {
    ResourceScope scope,
  });

  Future<SpreadsheetImportResult> importSpreadsheet(
    ResourceDefinition definition,
    List<JsonMap> rows,
    String fileName,
  );

  Future<String> logSpreadsheetExport(
    ResourceDefinition definition,
    String fileName,
  );

  Future<String> logExport(String module, String fileName);
}

class ResourceRepository implements ResourceDataSource {
  const ResourceRepository(this._apiClient);

  final ApiClient _apiClient;

  @override
  Future<ResourcePageData> list(
    ResourceDefinition definition,
    ResourceQuery query,
  ) async {
    final JsonMap response = await _apiClient.get(
      definition.path,
      query: query.toApiQuery(),
    );
    return ResourcePageData.fromJson(response);
  }

  @override
  Future<List<ResourceItem>> listForExport(
    ResourceDefinition definition,
    ResourceQuery query,
  ) async {
    const int pageSize = 100;
    final List<ResourceItem> result = <ResourceItem>[];
    int page = 1;
    while (true) {
      final ResourcePageData current = await list(
        definition,
        query.copyWith(page: page, limit: pageSize),
      );
      result.addAll(current.items);
      final int totalPages = current.pagination.totalPages;
      if (current.items.isEmpty || totalPages <= page) break;
      page++;
    }
    return List<ResourceItem>.unmodifiable(result);
  }

  @override
  Future<ResourceStats> stats(
    ResourceDefinition definition,
    ResourceQuery query,
  ) async {
    final Map<String, dynamic> parameters = <String, dynamic>{};
    if (query.scope.apiValue != null) {
      parameters['scope'] = query.scope.apiValue;
    }
    final String? userId = query.filters['userId'];
    if (userId != null && userId.isNotEmpty && userId != 'ALL') {
      parameters['userId'] = userId;
    }
    final JsonMap response = await _apiClient.get(
      '${definition.path}/stats',
      query: parameters,
    );
    return ResourceStats(jsonMap(response['data']));
  }

  @override
  Future<ResourceItem> detail(
    ResourceDefinition definition,
    String id, {
    ResourceScope scope = ResourceScope.mine,
  }) async {
    final JsonMap response = await _apiClient.get(
      '${definition.path}/$id',
      query: scope.apiValue == null
          ? null
          : <String, dynamic>{'scope': scope.apiValue},
    );
    return ResourceItem(jsonMap(response['data']));
  }

  @override
  Future<ResourceItem> create(
    ResourceDefinition definition,
    ResourceDraft draft,
  ) async {
    final JsonMap payload = await _payloadWithUpload(definition, draft);
    final JsonMap response = await _apiClient.post(
      definition.path,
      data: payload,
    );
    return ResourceItem(jsonMap(response['data']));
  }

  @override
  Future<ResourceItem> update(
    ResourceDefinition definition,
    String id,
    ResourceDraft draft,
  ) async {
    final JsonMap payload = await _payloadWithUpload(definition, draft);
    final JsonMap response = await _apiClient.patch(
      '${definition.path}/$id',
      data: payload,
    );
    return ResourceItem(jsonMap(response['data']));
  }

  Future<JsonMap> _payloadWithUpload(
    ResourceDefinition definition,
    ResourceDraft draft,
  ) async {
    final JsonMap payload = Map<String, dynamic>.from(draft.values);
    final LocalResourceFile? localFile = draft.file;
    if (localFile == null) return payload;
    final FieldDefinition? fileField = definition.fileField;
    if (fileField == null || fileField.uploadPrefix == null) {
      throw const AppException(
        code: 'INVALID_FILE_CONFIG',
        message: 'Resource ini tidak menerima unggahan file.',
      );
    }
    await _validateFile(fileField, localFile);
    final JsonMap uploadResponse = await _apiClient.upload(
      path: '/files',
      filePath: localFile.path,
      fileName: localFile.name,
      prefix: fileField.uploadPrefix!,
    );
    final String key = stringValue(jsonMap(uploadResponse['data'])['key']);
    if (key.isEmpty) {
      throw const AppException(
        code: 'INVALID_UPLOAD_RESPONSE',
        message: 'Server tidak mengembalikan identitas file.',
      );
    }
    payload[fileField.key] = key;
    payload['fileName'] = localFile.name;
    return payload;
  }

  Future<void> _validateFile(
    FieldDefinition field,
    LocalResourceFile file,
  ) async {
    final int? maxBytes = field.maxFileBytes;
    if (maxBytes != null && file.size > maxBytes) {
      throw AppException(
        code: 'FILE_TOO_LARGE',
        message: 'Ukuran file maksimal ${maxBytes ~/ (1024 * 1024)} MB.',
      );
    }
    final int dot = file.name.lastIndexOf('.');
    final String extension =
        dot < 0 ? '' : file.name.substring(dot + 1).toLowerCase();
    if (field.acceptedExtensions.isNotEmpty &&
        !field.acceptedExtensions.contains(extension)) {
      throw AppException(
        code: 'INVALID_FILE_TYPE',
        message:
            'Format file harus ${field.acceptedExtensions.map((String item) => item.toUpperCase()).join(', ')}.',
      );
    }
    final Uint8List bytes;
    try {
      bytes = await File(file.path).readAsBytes();
    } on FileSystemException {
      throw const AppException(
        code: 'FILE_READ_FAILED',
        message: 'File yang dipilih tidak dapat dibaca.',
      );
    }
    if (maxBytes != null && bytes.length > maxBytes) {
      throw AppException(
        code: 'FILE_TOO_LARGE',
        message: 'Ukuran file maksimal ${maxBytes ~/ (1024 * 1024)} MB.',
      );
    }
    if (!_matchesFileSignature(extension, bytes)) {
      throw const AppException(
        code: 'INVALID_FILE_CONTENT',
        message: 'Isi file tidak sesuai dengan ekstensi yang dipilih.',
      );
    }
  }

  bool _matchesFileSignature(String extension, Uint8List bytes) {
    bool startsWith(List<int> signature) {
      if (bytes.length < signature.length) return false;
      for (int index = 0; index < signature.length; index++) {
        if (bytes[index] != signature[index]) return false;
      }
      return true;
    }

    switch (extension) {
      case 'pdf':
        return startsWith(const <int>[0x25, 0x50, 0x44, 0x46, 0x2D]);
      case 'jpg' || 'jpeg':
        return startsWith(const <int>[0xFF, 0xD8, 0xFF]);
      case 'png':
        return startsWith(
          const <int>[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
        );
      case 'webp':
        return bytes.length >= 12 &&
            _asciiAt(bytes, 0, 'RIFF') &&
            _asciiAt(bytes, 8, 'WEBP');
      case 'doc' || 'ppt':
        return startsWith(
          const <int>[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
        );
      case 'docx':
        return _isZip(bytes) &&
            _containsAscii(bytes, '[Content_Types].xml') &&
            _containsAscii(bytes, 'word/');
      case 'pptx':
        return _isZip(bytes) &&
            _containsAscii(bytes, '[Content_Types].xml') &&
            _containsAscii(bytes, 'ppt/');
      default:
        return false;
    }
  }

  bool _isZip(Uint8List bytes) =>
      bytes.length >= 4 &&
      bytes[0] == 0x50 &&
      bytes[1] == 0x4B &&
      ((bytes[2] == 0x03 && bytes[3] == 0x04) ||
          (bytes[2] == 0x05 && bytes[3] == 0x06) ||
          (bytes[2] == 0x07 && bytes[3] == 0x08));

  bool _asciiAt(Uint8List bytes, int offset, String value) {
    if (offset + value.length > bytes.length) return false;
    for (int index = 0; index < value.length; index++) {
      if (bytes[offset + index] != value.codeUnitAt(index)) return false;
    }
    return true;
  }

  bool _containsAscii(Uint8List bytes, String value) {
    if (value.isEmpty || bytes.length < value.length) return false;
    for (int offset = 0; offset <= bytes.length - value.length; offset++) {
      if (_asciiAt(bytes, offset, value)) return true;
    }
    return false;
  }

  @override
  Future<String> delete(ResourceDefinition definition, String id) async {
    final JsonMap response = await _apiClient.delete('${definition.path}/$id');
    return _message(response, 'Data berhasil dihapus.');
  }

  @override
  Future<String> updateMemberStatus(
    String id,
    String status, {
    String? reason,
  }) async {
    final JsonMap response = await _apiClient.patch(
      '/anggota/$id/status',
      data: <String, dynamic>{'status': status, 'reason': reason ?? ''},
    );
    return _message(response, 'Status anggota berhasil diperbarui.');
  }

  @override
  Future<String> updateApplicationStatus(
    String id,
    String status, {
    String? reason,
  }) async {
    final JsonMap response = await _apiClient.patch(
      '/pengajuan-berkas/$id/status',
      data: <String, dynamic>{'status': status, 'reason': reason ?? ''},
    );
    return _message(response, 'Status pengajuan berhasil diperbarui.');
  }

  @override
  Future<String> copyMembers({
    required List<String> ids,
    required String sourcePeriodId,
    required String targetPeriodId,
  }) async {
    final JsonMap response = await _apiClient.post(
      '/anggota/copy-period',
      data: <String, dynamic>{
        'anggotaIds': ids,
        'sourcePeriodeId': sourcePeriodId,
        'targetPeriodeId': targetPeriodId,
      },
    );
    return _message(response, 'Anggota berhasil disalin ke periode tujuan.');
  }

  @override
  Future<String> copyWilayah({
    required List<String> ids,
    required String type,
  }) async {
    final JsonMap response = await _apiClient.post(
      '/wilayah/copy',
      data: <String, dynamic>{'wilayahIds': ids, 'jenis': type},
    );
    return _message(response, 'Wilayah berhasil disalin ke periode aktif.');
  }

  @override
  Future<List<ResourcePeriodRef>> periods() async {
    final JsonMap response = await _apiClient.get(
      '/periods',
      query: <String, dynamic>{'page': 1, 'limit': 100},
    );
    return jsonMapList(response['data'])
        .map<ResourcePeriodRef>(ResourcePeriodRef.fromJson)
        .toList(growable: false);
  }

  @override
  Future<List<ResourceItem>> membersForPeriod(String periodId) async {
    final List<ResourceItem> result = <ResourceItem>[];
    int page = 1;
    while (true) {
      final JsonMap response = await _apiClient.get(
        '/anggota',
        query: <String, dynamic>{'page': page, 'limit': 100},
        headers: <String, Object?>{'X-View-Period': periodId},
      );
      final ResourcePageData current = ResourcePageData.fromJson(response);
      result.addAll(current.items);
      if (current.items.isEmpty || current.pagination.totalPages <= page) {
        break;
      }
      page++;
    }
    return List<ResourceItem>.unmodifiable(result);
  }

  @override
  Future<List<ResourceDirectoryUser>> pacDirectory() async {
    final JsonMap response = await _apiClient.get(
      '/directory/users',
      query: <String, dynamic>{'role': 'SEKRETARIS_PAC'},
    );
    return jsonMapList(response['data'])
        .map<ResourceDirectoryUser>(ResourceDirectoryUser.fromJson)
        .toList(growable: false);
  }

  @override
  Future<List<AgendaHoliday>> agendaHolidays(int year) async {
    final JsonMap response = await _apiClient.get(
      '/public/phbi',
      query: <String, dynamic>{'year': year},
      isPublic: true,
    );
    return jsonMapList(response['holidays'])
        .map<AgendaHoliday>(AgendaHoliday.fromJson)
        .where(
          (AgendaHoliday holiday) =>
              holiday.date != null && holiday.description.isNotEmpty,
        )
        .toList(growable: false);
  }

  @override
  Future<List<PresensiParticipant>> participants(String presensiId) async {
    final JsonMap response =
        await _apiClient.get('/presensi/$presensiId/participants');
    return jsonMapList(response['data'])
        .map<PresensiParticipant>(PresensiParticipant.fromJson)
        .toList(growable: false);
  }

  @override
  Future<Uint8List> memberImage(String memberId) =>
      _apiClient.download('/images/anggota/$memberId');

  @override
  Future<Uint8List> download(
    ResourceDefinition definition,
    ResourceItem item, {
    ResourceScope scope = ResourceScope.mine,
  }) async {
    for (int attempt = 0; attempt < 2; attempt++) {
      final JsonMap tokenResponse = await _apiClient.post(
        '${definition.path}/${item.id}/download-token',
        query: scope.apiValue == null
            ? null
            : <String, dynamic>{'scope': scope.apiValue},
      );
      final String token = stringValue(tokenResponse['token']);
      if (token.isEmpty) {
        throw const AppException(
          code: 'INVALID_DOWNLOAD_TOKEN',
          message: 'Token unduhan tidak tersedia.',
        );
      }
      try {
        return await _apiClient.download(
          '${definition.path}/${item.id}/download',
          query: <String, dynamic>{'token': token},
          skipUnauthorizedCallback: true,
        );
      } on AppException catch (error) {
        final bool expired = error.code == 'INVALID_TOKEN' ||
            error.code == 'UNAUTHORIZED' ||
            error.statusCode == 401;
        if (!expired || attempt == 1) rethrow;
      }
    }
    throw const AppException(
      code: 'INVALID_DOWNLOAD_TOKEN',
      message: 'Token unduhan tidak dapat diperbarui.',
    );
  }

  @override
  Future<SpreadsheetImportResult> importSpreadsheet(
    ResourceDefinition definition,
    List<JsonMap> rows,
    String fileName,
  ) async {
    final ResourceSpreadsheetDefinition? spreadsheet = definition.spreadsheet;
    if (spreadsheet == null || !spreadsheet.supportsImport) {
      throw const AppException(
        code: 'UNSUPPORTED_IMPORT',
        message: 'Resource ini tidak memiliki import Excel.',
      );
    }
    if (rows.isEmpty) {
      throw const AppException(
        code: 'EMPTY_SPREADSHEET',
        message: 'File Excel kosong atau tidak memiliki data.',
      );
    }
    if (rows.length > spreadsheet.maxImportRows) {
      throw AppException(
        code: 'TOO_MANY_ROWS',
        message: 'Maksimal ${spreadsheet.maxImportRows} baris per import.',
      );
    }
    final JsonMap response = await _apiClient.post(
      '/imports/${definition.key}',
      data: <String, dynamic>{'rows': rows, 'fileName': fileName},
      receiveTimeout: const Duration(minutes: 2),
    );
    return SpreadsheetImportResult.fromJson(response);
  }

  @override
  Future<String> logSpreadsheetExport(
    ResourceDefinition definition,
    String fileName,
  ) async {
    final ResourceSpreadsheetDefinition? spreadsheet = definition.spreadsheet;
    if (spreadsheet == null) {
      throw const AppException(
        code: 'UNSUPPORTED_EXPORT',
        message: 'Resource ini tidak memiliki export Excel.',
      );
    }
    return logExport(spreadsheet.module, fileName);
  }

  @override
  Future<String> logExport(String module, String fileName) async {
    final JsonMap response = await _apiClient.post(
      '/exports/log',
      data: <String, dynamic>{
        'module': module,
        'fileName': fileName,
      },
    );
    return _message(response, 'Export tercatat.');
  }

  String _message(JsonMap response, String fallback) =>
      stringValue(response['message'], fallback);
}
