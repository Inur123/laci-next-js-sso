import 'dart:typed_data';

import '../../../shared/models/json_value.dart';
import 'resource_definition.dart';

class ResourceItem {
  ResourceItem(JsonMap value) : data = Map<String, dynamic>.unmodifiable(value);

  final JsonMap data;

  String get id => stringValue(data['id']);

  Object? operator [](String key) => value(key);
  Object? value(String key) {
    if (key == 'status' &&
        data['status'] == null &&
        data.containsKey('namaKegiatan')) {
      return presensiIsOpen(this) ? 'OPEN' : 'CLOSED';
    }
    if (key == 'status' &&
        data.containsKey('tanggalBerakhir') &&
        data.containsKey('organisasi')) {
      if (berkasSpEndsToday(this)) return 'BERAKHIR_HARI_INI';
      if (data['status'] == null) return berkasSpStatus(this);
    }
    return data[key];
  }

  String text(String key, [String fallback = '-']) {
    final Object? raw = value(key);
    if (raw == null || raw.toString().trim().isEmpty) return fallback;
    return raw.toString();
  }
}

class ResourcePagination {
  const ResourcePagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory ResourcePagination.fromJson(JsonMap json) => ResourcePagination(
        page: intValue(json['page'], 1),
        limit: intValue(json['limit'], 10),
        total: intValue(json['total']),
        totalPages: intValue(json['totalPages']),
      );

  final int page;
  final int limit;
  final int total;
  final int totalPages;
}

class ResourcePageData {
  const ResourcePageData({required this.items, required this.pagination});

  factory ResourcePageData.fromJson(JsonMap json) => ResourcePageData(
        items: jsonMapList(json['data'])
            .map<ResourceItem>(ResourceItem.new)
            .toList(growable: false),
        pagination: ResourcePagination.fromJson(jsonMap(json['pagination'])),
      );

  final List<ResourceItem> items;
  final ResourcePagination pagination;
}

class ResourceStats {
  ResourceStats(JsonMap value)
      : values = Map<String, dynamic>.unmodifiable(value);

  final JsonMap values;

  int count(String key) => intValue(values[key]);
}

class ResourceQuery {
  const ResourceQuery({
    this.search = '',
    this.page = 1,
    this.limit = 10,
    this.filters = const <String, String>{},
    this.sortKey,
    this.sortAscending = false,
    this.scope = ResourceScope.mine,
  });

  final String search;
  final int page;
  final int limit;
  final Map<String, String> filters;
  final String? sortKey;
  final bool sortAscending;
  final ResourceScope scope;

  Map<String, dynamic> toApiQuery() {
    final Map<String, dynamic> query = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (search.trim().isNotEmpty) query['search'] = search.trim();
    if (scope.apiValue != null) query['scope'] = scope.apiValue;
    if (sortKey != null && sortKey!.isNotEmpty) {
      query['sortKey'] = sortKey;
      query['sortDir'] = sortAscending ? 'asc' : 'desc';
    }
    for (final MapEntry<String, String> entry in filters.entries) {
      if (entry.value.isNotEmpty && entry.value != 'ALL') {
        query[entry.key] = entry.value;
      }
    }
    return query;
  }

  ResourceQuery copyWith({
    String? search,
    int? page,
    int? limit,
    Map<String, String>? filters,
    String? sortKey,
    bool clearSort = false,
    bool? sortAscending,
    ResourceScope? scope,
  }) =>
      ResourceQuery(
        search: search ?? this.search,
        page: page ?? this.page,
        limit: limit ?? this.limit,
        filters: filters ?? this.filters,
        sortKey: clearSort ? null : sortKey ?? this.sortKey,
        sortAscending: sortAscending ?? this.sortAscending,
        scope: scope ?? this.scope,
      );
}

class LocalResourceFile {
  const LocalResourceFile({
    required this.path,
    required this.name,
    required this.size,
  });

  final String path;
  final String name;
  final int size;
}

class ResourceDraft {
  const ResourceDraft({
    required this.values,
    this.file,
  });

  final JsonMap values;
  final LocalResourceFile? file;
}

class ResourcePeriodRef {
  const ResourcePeriodRef({
    required this.id,
    required this.name,
    required this.isActive,
  });

  factory ResourcePeriodRef.fromJson(JsonMap json) => ResourcePeriodRef(
        id: stringValue(json['id']),
        name: stringValue(json['nama']),
        isActive: boolValue(json['isActive']),
      );

  final String id;
  final String name;
  final bool isActive;
}

class ResourceDirectoryUser {
  const ResourceDirectoryUser({required this.id, required this.name});

  factory ResourceDirectoryUser.fromJson(JsonMap json) => ResourceDirectoryUser(
        id: stringValue(json['id']),
        name: stringValue(json['name']),
      );

  final String id;
  final String name;
}

class AgendaHoliday {
  const AgendaHoliday({required this.date, required this.description});

  factory AgendaHoliday.fromJson(JsonMap json) => AgendaHoliday(
        date: dateTimeValue(json['date'] ?? json['holiday_date']),
        description: stringValue(
          json['description'] ?? json['holiday_name'] ?? json['name'],
        ),
      );

  final DateTime? date;
  final String description;
}

class PresensiParticipant {
  const PresensiParticipant({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.organization,
    required this.level,
    required this.position,
    required this.institution,
    required this.createdAt,
  });

  factory PresensiParticipant.fromJson(JsonMap json) => PresensiParticipant(
        id: stringValue(json['id']),
        name: stringValue(json['namaLengkap']),
        email: stringValue(json['email']),
        phone: stringValue(json['noHp']),
        organization: stringValue(json['organisasi']),
        level: stringValue(json['tingkat']),
        position: stringValue(json['jabatan']),
        institution: stringValue(json['instansi']),
        createdAt: dateTimeValue(json['createdAt']),
      );

  final String id;
  final String name;
  final String email;
  final String phone;
  final String organization;
  final String level;
  final String position;
  final String institution;
  final DateTime? createdAt;
}

bool presensiIsOpen(ResourceItem item, {DateTime? now}) {
  if (item.data['isActive'] != true) return false;
  final DateTime? rawDate = dateTimeValue(item.data['tanggal']);
  final List<String> start = stringValue(item.data['jamMulai']).split(':');
  final List<String> end = stringValue(item.data['jamSelesai']).split(':');
  if (rawDate == null || start.length < 2 || end.length < 2) return false;
  final DateTime jakartaDate = rawDate.toUtc().add(const Duration(hours: 7));
  final DateTime jakartaNow =
      (now ?? DateTime.now()).toUtc().add(const Duration(hours: 7));
  final int? startHour = int.tryParse(start[0]);
  final int? startMinute = int.tryParse(start[1]);
  final int? endHour = int.tryParse(end[0]);
  final int? endMinute = int.tryParse(end[1]);
  if (startHour == null ||
      startMinute == null ||
      endHour == null ||
      endMinute == null) {
    return false;
  }
  final DateTime opens = DateTime(
    jakartaDate.year,
    jakartaDate.month,
    jakartaDate.day,
    startHour,
    startMinute,
  );
  final DateTime closes = DateTime(
    jakartaDate.year,
    jakartaDate.month,
    jakartaDate.day,
    endHour,
    endMinute,
  );
  final DateTime comparableNow = DateTime(
    jakartaNow.year,
    jakartaNow.month,
    jakartaNow.day,
    jakartaNow.hour,
    jakartaNow.minute,
    jakartaNow.second,
  );
  return !comparableNow.isBefore(opens) && !comparableNow.isAfter(closes);
}

String berkasSpStatus(ResourceItem item, {DateTime? now}) {
  final DateTime? end = dateTimeValue(item.data['tanggalBerakhir'])?.toLocal();
  if (end == null) return '';
  final DateTime todayValue = (now ?? DateTime.now()).toLocal();
  final DateTime today =
      DateTime(todayValue.year, todayValue.month, todayValue.day);
  final DateTime lastDay = DateTime(end.year, end.month, end.day);
  final int days = lastDay.difference(today).inDays;
  if (days < 0) return 'KEDALUWARSA';
  if (days <= 30) return 'HAMPIR_HABIS';
  return 'AKTIF';
}

bool berkasSpEndsToday(ResourceItem item, {DateTime? now}) {
  final DateTime? end = dateTimeValue(item.data['tanggalBerakhir'])?.toLocal();
  if (end == null) return false;
  final DateTime current = (now ?? DateTime.now()).toLocal();
  return end.year == current.year &&
      end.month == current.month &&
      end.day == current.day;
}

class DownloadedResourceFile {
  const DownloadedResourceFile({
    required this.path,
    required this.name,
  });

  final String path;
  final String name;
}

class SpreadsheetImportResult {
  const SpreadsheetImportResult({
    required this.success,
    required this.failed,
    required this.errors,
    required this.message,
  });

  factory SpreadsheetImportResult.fromJson(JsonMap json) =>
      SpreadsheetImportResult(
        success: intValue(json['success']),
        failed: intValue(json['failed']),
        errors: (json['errors'] as List<Object?>? ?? const <Object?>[])
            .map<String>(stringValue)
            .where((String value) => value.isNotEmpty)
            .toList(growable: false),
        message: stringValue(json['message'], 'Import selesai.'),
      );

  final int success;
  final int failed;
  final List<String> errors;
  final String message;
}

class ResourceSpreadsheetDocument {
  const ResourceSpreadsheetDocument({
    required this.bytes,
    required this.name,
  });

  final Uint8List bytes;
  final String name;
}
