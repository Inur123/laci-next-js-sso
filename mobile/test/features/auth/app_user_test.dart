import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/features/auth/domain/app_user.dart';
import 'package:laci_mobile/features/periods/domain/app_period.dart';

void main() {
  group('AppUser', () {
    test('memetakan role cabang dan status verifikasi dari API', () {
      final AppUser user = AppUser.fromJson(<String, dynamic>{
        'id': 'user-1',
        'name': 'Nurul Huda',
        'email': 'nurul@example.test',
        'role': 'SEKRETARIS_CABANG',
        'isActive': true,
        'emailVerified': true,
        'periodeAktifId': 'periode-1',
      });

      expect(user.role, UserRole.cabang);
      expect(user.isCabang, isTrue);
      expect(user.emailVerified, isTrue);
      expect(user.activePeriodId, 'periode-1');
      expect(user.initials, 'NH');
      expect(user.role.apiValue, 'SEKRETARIS_CABANG');
    });

    test('role PAC dan inisial nama tetap dipetakan secara eksplisit', () {
      final AppUser pac = AppUser.fromJson(<String, dynamic>{
        'id': 'user-2',
        'name': '  Zainur   Rohman  Magetan ',
        'email': 'zainur@example.test',
        'role': 'SEKRETARIS_PAC',
        'isActive': 1,
        'emailVerified': false,
      });
      expect(pac.role, UserRole.pac);
      expect(pac.role.shortLabel, 'PAC');
      expect(pac.initials, 'ZR');
    });

    test('role kosong atau tidak dikenal ditolak, bukan dianggap PAC', () {
      for (final Object? role in <Object?>[
        null,
        '',
        'ADMIN',
        'SEKRETARIS_RANTING',
      ]) {
        expect(
          () => AppUser.fromJson(<String, dynamic>{
            'id': 'user-invalid',
            'name': 'Pengguna Tidak Dikenal',
            'role': role,
          }),
          throwsA(isA<FormatException>()),
          reason: 'role $role harus ditolak',
        );
      }
    });

    test('copyWith mempertahankan aturan akses dan mengganti profil', () {
      const AppUser original = AppUser(
        id: 'user-1',
        name: 'Nama Lama',
        email: 'lama@example.test',
        role: UserRole.pac,
        isActive: true,
        emailVerified: true,
      );

      final AppUser updated = original.copyWith(
        name: 'Nama Baru',
        email: 'baru@example.test',
        activePeriodId: 'periode-2',
      );

      expect(updated.name, 'Nama Baru');
      expect(updated.email, 'baru@example.test');
      expect(updated.role, UserRole.pac);
      expect(updated.emailVerified, isTrue);
      expect(updated.activePeriodId, 'periode-2');
    });
  });

  test('AppPeriod memetakan nama, status, dan timestamp API', () {
    final AppPeriod period = AppPeriod.fromJson(<String, dynamic>{
      'id': 'period-1',
      'nama': 'Masa Khidmat 2026-2028',
      'isActive': true,
      'createdAt': '2026-08-24T00:00:00Z',
      'updatedAt': 'invalid',
    });

    expect(period.id, 'period-1');
    expect(period.name, 'Masa Khidmat 2026-2028');
    expect(period.isActive, isTrue);
    expect(period.createdAt?.toUtc().year, 2026);
    expect(period.updatedAt, isNull);
  });
}
