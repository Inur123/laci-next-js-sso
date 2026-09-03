import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/shared/models/json_value.dart';

void main() {
  group('JSON value helpers', () {
    test('menormalkan map dinamis dan list map', () {
      expect(
        jsonMap(<Object, Object>{1: 'satu', 'aktif': true}),
        <String, dynamic>{'1': 'satu', 'aktif': true},
      );
      expect(jsonMap('bukan-map'), isEmpty);
      expect(
        jsonMapList(<Object?>[
          <String, Object>{'id': 1},
          null,
        ]),
        <Map<String, dynamic>>[
          <String, dynamic>{'id': 1},
          <String, dynamic>{},
        ],
      );
      expect(jsonMapList(<String, Object>{'id': 1}), isEmpty);
    });

    test('mengonversi nilai primitif dengan fallback yang aman', () {
      expect(stringValue(null, '-'), '-');
      expect(stringValue(42), '42');
      expect(boolValue(true), isTrue);
      expect(boolValue(1), isTrue);
      expect(boolValue(0), isFalse);
      expect(boolValue('TRUE'), isTrue);
      expect(boolValue('ya', true), isFalse);
      expect(intValue(8.9), 8);
      expect(intValue('27'), 27);
      expect(intValue('invalid', 5), 5);
    });

    test('tanggal invalid tidak melempar exception', () {
      expect(dateTimeValue('2026-08-24T10:00:00Z')?.toUtc().year, 2026);
      expect(dateTimeValue('bukan-tanggal'), isNull);
      expect(dateTimeValue(null), isNull);
    });
  });
}
