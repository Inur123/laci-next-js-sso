class AppException implements Exception {
  const AppException({
    required this.message,
    this.code = 'APP_ERROR',
    this.statusCode,
    this.details,
    this.cause,
  });

  final String code;
  final String message;
  final int? statusCode;
  final Object? details;
  final Object? cause;

  static String messageOf(Object error) =>
      error is AppException ? error.message : 'Terjadi kesalahan. Coba lagi.';

  bool get isUnauthorized => statusCode == 401 || code == 'UNAUTHORIZED';
  bool get isForbidden => statusCode == 403 || code == 'FORBIDDEN';
  bool get isValidation => statusCode == 422 || code == 'VALIDATION_ERROR';

  @override
  String toString() => message;
}
