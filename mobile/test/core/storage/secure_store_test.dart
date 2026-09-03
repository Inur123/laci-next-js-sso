import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/core/storage/secure_store.dart';

import '../../support/test_doubles.dart';

void main() {
  group('TokenBundle', () {
    test('menganggap token kedaluwarsa satu menit sebelum batas server', () {
      final TokenBundle nearExpiry = TokenBundle(
        accessToken: 'near-expiry',
        expiresAt: DateTime.now().add(const Duration(seconds: 30)),
      );
      final TokenBundle valid = TokenBundle(
        accessToken: 'valid',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      );
      const TokenBundle withoutExpiry = TokenBundle(accessToken: 'no-expiry');

      expect(nearExpiry.isExpired, isTrue);
      expect(valid.isExpired, isFalse);
      expect(withoutExpiry.isExpired, isFalse);
    });
  });

  test('kontrak secure store menyimpan preferensi dan membersihkan token',
      () async {
    final MemorySecureStore store = MemorySecureStore();
    final TokenBundle bundle = TokenBundle(
      accessToken: 'opaque-mobile-token',
      expiresAt: DateTime.utc(2026, 8, 24, 12),
    );

    await store.writeTokens(bundle);
    await store.writeViewPeriod('period-1');
    await store.writeLocation('-7.6500, 111.3600');

    expect((await store.readTokens())?.accessToken, 'opaque-mobile-token');
    expect(await store.readViewPeriod(), 'period-1');
    expect(await store.readLocation(), '-7.6500, 111.3600');

    await store.clearTokens();

    expect(await store.readTokens(), isNull);
    expect(store.clearTokensCalls, 1);
  });
}
