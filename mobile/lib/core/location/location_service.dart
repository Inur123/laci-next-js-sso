import 'package:geolocator/geolocator.dart';

import '../errors/app_exception.dart';
import '../storage/secure_store.dart';

class LocationService {
  const LocationService(this._secureStore);

  final AppSecureStore _secureStore;

  Future<String?> captureForLogin() async {
    // Never attach coordinates captured for a previous account/session.
    await _secureStore.writeLocation(null);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw const AppException(
          code: 'LOCATION_SERVICE_DISABLED',
          message: 'Aktifkan layanan lokasi perangkat untuk masuk.',
        );
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        throw const AppException(
          code: 'LOCATION_DENIED_FOREVER',
          message:
              'Izin lokasi diblokir. Buka pengaturan aplikasi untuk masuk.',
        );
      }
      if (permission == LocationPermission.denied) {
        throw const AppException(
          code: 'LOCATION_DENIED',
          message: 'Izinkan lokasi saat menggunakan aplikasi untuk masuk.',
        );
      }
      final Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );
      final String value = '${position.latitude}, ${position.longitude}';
      await _secureStore.writeLocation(value);
      return value;
    } on AppException {
      rethrow;
    } on Object {
      throw const AppException(
        code: 'LOCATION_UNAVAILABLE',
        message: 'Lokasi tidak dapat diperoleh. Aktifkan GPS lalu coba lagi.',
      );
    }
  }

  Future<bool> openSettings() => Geolocator.openAppSettings();
}
