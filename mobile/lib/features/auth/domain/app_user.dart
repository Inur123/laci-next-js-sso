import '../../../shared/models/json_value.dart';

enum UserRole {
  cabang,
  pac;

  static UserRole fromApi(Object? value) => switch (value) {
        'SEKRETARIS_CABANG' => UserRole.cabang,
        'SEKRETARIS_PAC' => UserRole.pac,
        _ => throw FormatException('Role pengguna tidak didukung: $value'),
      };

  String get apiValue =>
      this == UserRole.cabang ? 'SEKRETARIS_CABANG' : 'SEKRETARIS_PAC';

  String get shortLabel => this == UserRole.cabang ? 'CABANG' : 'PAC';
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
    required this.emailVerified,
    this.image,
    this.activePeriodId,
  });

  factory AppUser.fromJson(JsonMap json) => AppUser(
        id: stringValue(json['id']),
        name: stringValue(json['name']),
        email: stringValue(json['email']),
        role: UserRole.fromApi(json['role']),
        isActive: boolValue(json['isActive']),
        emailVerified: boolValue(json['emailVerified']),
        image: json['image']?.toString(),
        activePeriodId: json['periodeAktifId']?.toString(),
      );

  final String id;
  final String name;
  final String email;
  final UserRole role;
  final bool isActive;
  final bool emailVerified;
  final String? image;
  final String? activePeriodId;

  bool get isCabang => role == UserRole.cabang;

  String get initials {
    final List<String> words = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((String word) => word.isNotEmpty)
        .toList();
    if (words.isEmpty) return 'LD';
    return words.take(2).map((String word) => word[0].toUpperCase()).join();
  }

  AppUser copyWith({
    String? name,
    String? email,
    String? image,
    String? activePeriodId,
  }) =>
      AppUser(
        id: id,
        name: name ?? this.name,
        email: email ?? this.email,
        role: role,
        isActive: isActive,
        emailVerified: emailVerified,
        image: image ?? this.image,
        activePeriodId: activePeriodId ?? this.activePeriodId,
      );
}
