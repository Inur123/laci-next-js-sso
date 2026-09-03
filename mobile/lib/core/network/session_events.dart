import 'dart:async';

import '../errors/app_exception.dart';

class SessionEvents {
  final StreamController<AppException?> _expired =
      StreamController<AppException?>.broadcast();

  Stream<AppException?> get onExpired => _expired.stream;

  void expire([AppException? reason]) => _expired.add(reason);

  Future<void> dispose() => _expired.close();
}
