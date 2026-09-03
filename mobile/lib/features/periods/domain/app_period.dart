import '../../../shared/models/json_value.dart';

class AppPeriod {
  const AppPeriod({
    required this.id,
    required this.name,
    required this.isActive,
    this.createdAt,
    this.updatedAt,
  });

  factory AppPeriod.fromJson(JsonMap json) => AppPeriod(
        id: stringValue(json['id']),
        name: stringValue(json['nama']),
        isActive: boolValue(json['isActive']),
        createdAt: dateTimeValue(json['createdAt']),
        updatedAt: dateTimeValue(json['updatedAt']),
      );

  final String id;
  final String name;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}
