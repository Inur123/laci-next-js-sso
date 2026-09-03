typedef JsonMap = Map<String, dynamic>;

JsonMap jsonMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map<String, dynamic>(
      (Object? key, Object? item) => MapEntry<String, dynamic>(
        key.toString(),
        item,
      ),
    );
  }
  return <String, dynamic>{};
}

List<JsonMap> jsonMapList(Object? value) {
  if (value is! List) return <JsonMap>[];
  return value.map<JsonMap>(jsonMap).toList(growable: false);
}

String stringValue(Object? value, [String fallback = '']) =>
    value == null ? fallback : value.toString();

bool boolValue(Object? value, [bool fallback = false]) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}

int intValue(Object? value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

DateTime? dateTimeValue(Object? value) =>
    value == null ? null : DateTime.tryParse(value.toString());
