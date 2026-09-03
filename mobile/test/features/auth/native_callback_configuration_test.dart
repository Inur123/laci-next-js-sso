import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Android callback SSO kembali ke task aplikasi yang sama', () {
    final String manifest = File(
      'android/app/src/main/AndroidManifest.xml',
    ).readAsStringSync();

    expect(
      manifest,
      contains('android:name=".MainActivity"'),
    );
    expect(manifest, contains('android:launchMode="singleTop"'));
    expect(
      manifest,
      contains(
        'android:name="com.linusu.flutter_web_auth_2.CallbackActivity"',
      ),
    );
    expect(manifest, contains('android:scheme="lacidigital"'));

    // flutter_web_auth_2 5.x meminta affinity kosong pada kedua activity yang
    // diekspor agar Auth Tab tertutup dan task aplikasi kembali ke foreground.
    expect(
      RegExp(r'android:taskAffinity=""').allMatches(manifest).length,
      2,
    );
  });

  test('iOS mendaftarkan URL scheme callback SSO', () {
    final String infoPlist = File('ios/Runner/Info.plist').readAsStringSync();

    expect(infoPlist, contains('<key>CFBundleURLSchemes</key>'));
    expect(infoPlist, contains('<string>lacidigital</string>'));
  });
}
