import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/core/config/app_config.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppConfig', () {
    test('membentuk base URL API v1 dan skema callback mobile', () {
      const AppConfig config = AppConfig(
        apiBaseUrl: 'https://api.example.test',
        frontendBaseUrl: 'https://web.example.test',
        mobileRedirectUri: 'lacidigital://oauth/callback',
        ssoProfileUrl: 'https://sso.example.test/profile',
        environment: 'test',
      );

      expect(config.apiV1Url, 'https://api.example.test/api/v1');
      expect(config.mobileCallbackScheme, 'lacidigital');
    });

    test('QR presensi memakai halaman publik FE, bukan endpoint JSON API', () {
      const AppConfig config = AppConfig(
        apiBaseUrl: 'https://api.example.test',
        frontendBaseUrl: 'https://web.example.test',
        mobileRedirectUri: 'lacidigital://oauth/callback',
        ssoProfileUrl: 'https://sso.example.test/profile',
        environment: 'test',
      );

      final Uri attendance = config.publicAttendanceUri('presensi/rahasia');

      expect(
        attendance.toString(),
        'https://web.example.test/presensi/presensi%2Frahasia',
      );
      expect(attendance.host, 'web.example.test');
      expect(attendance.toString(), isNot(contains('/api/v1/')));
    });

    test('memuat seluruh URL dari environment dan menormalkan trailing slash',
        () {
      final AppConfig config = AppConfig.fromEnvironment(
        <String, String>{
          'API_BASE_URL': 'https://api.example.test/',
          'FRONTEND_BASE_URL': 'https://web.example.test/',
          'MOBILE_REDIRECT_URI': 'lacidigital://oauth/callback',
          'SSO_PROFILE_URL': 'https://sso.example.test/profile/',
          'APP_ENV': 'test',
        },
      );

      expect(config.apiBaseUrl, 'https://api.example.test');
      expect(config.frontendBaseUrl, 'https://web.example.test');
      expect(config.ssoProfileUrl, 'https://sso.example.test/profile');
      expect(config.mobileRedirectUri, 'lacidigital://oauth/callback');
      expect(config.apiV1Url, endsWith('/api/v1'));
    });

    test('menolak environment kosong atau URL origin yang tidak valid', () {
      expect(
        () => AppConfig.fromEnvironment(const <String, String>{}),
        throwsStateError,
      );
      expect(
        () => AppConfig.fromEnvironment(<String, String>{
          'API_BASE_URL': 'https://api.example.test/api/v1',
          'FRONTEND_BASE_URL': 'https://web.example.test',
          'MOBILE_REDIRECT_URI': 'lacidigital://oauth/callback',
          'SSO_PROFILE_URL': 'https://sso.example.test/profile',
          'APP_ENV': 'test',
        }),
        throwsFormatException,
      );
      expect(
        () => AppConfig.fromEnvironment(<String, String>{
          'API_BASE_URL': 'https://user:password@api.example.test',
          'FRONTEND_BASE_URL': 'https://web.example.test',
          'MOBILE_REDIRECT_URI': 'lacidigital://oauth/callback',
          'SSO_PROFILE_URL': 'https://sso.example.test/profile',
          'APP_ENV': 'test',
        }),
        throwsFormatException,
      );
      expect(
        () => AppConfig.fromEnvironment(<String, String>{
          'API_BASE_URL': 'https://api.example.test',
          'FRONTEND_BASE_URL': 'https://web.example.test',
          'MOBILE_REDIRECT_URI':
              'lacidigital://oauth/callback?unexpected=value',
          'SSO_PROFILE_URL': 'https://sso.example.test/profile',
          'APP_ENV': 'test',
        }),
        throwsFormatException,
      );
    });

    test('asset .env aktual dapat dimuat dan memenuhi kontrak konfigurasi',
        () async {
      await dotenv.load(fileName: '.env');

      final AppConfig config = AppConfig.fromEnvironment(dotenv.env);

      expect(config.environment, isNotEmpty);
      expect(config.apiBaseUrl, isNotEmpty);
      expect(config.frontendBaseUrl, isNotEmpty);
      expect(config.ssoProfileUrl, isNotEmpty);
      expect(config.mobileCallbackScheme, 'lacidigital');
    });
  });
}
