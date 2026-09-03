import '../../../core/network/api_client.dart';
import '../../../shared/models/json_value.dart';

class AdminRepository {
  const AdminRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<JsonMap> activityLogs({
    required int page,
    required String scope,
    String search = '',
    String action = 'ALL',
    String module = 'ALL',
    String userId = 'ALL',
    String? startDate,
    String? endDate,
    String sortKey = 'createdAt',
    String sortDir = 'desc',
  }) =>
      _apiClient.get(
        '/activity-logs',
        query: <String, dynamic>{
          'page': page,
          'limit': 20,
          'scope': scope,
          if (search.trim().isNotEmpty) 'search': search.trim(),
          if (action != 'ALL') 'action': action,
          if (module != 'ALL') 'module': module,
          if (userId != 'ALL') 'userId': userId,
          if (startDate != null) 'startDate': startDate,
          if (endDate != null) 'endDate': endDate,
          'sortKey': sortKey,
          'sortDir': sortDir,
        },
      );

  Future<JsonMap> activityLog(String id) =>
      _apiClient.get('/activity-logs/$id');

  Future<JsonMap> activityStats({
    required String scope,
    String userId = 'ALL',
  }) =>
      _apiClient.get('/activity-logs/stats', query: <String, dynamic>{
        'scope': scope,
        if (userId != 'ALL') 'userId': userId,
      });

  Future<JsonMap> activityMonitoring({String userId = 'ALL'}) =>
      _apiClient.get('/activity-logs/monitoring', query: <String, dynamic>{
        if (userId != 'ALL') 'userId': userId,
      });

  Future<List<JsonMap>> pacUsers() async {
    final JsonMap response = await _apiClient.get(
      '/directory/users',
      query: <String, dynamic>{'role': 'SEKRETARIS_PAC'},
    );
    return jsonMapList(response['data']);
  }

  Future<JsonMap> users({
    required int page,
    String search = '',
    String status = 'ALL',
    String emailStatus = 'ALL',
    String sortKey = 'createdAt',
    String sortDir = 'desc',
  }) =>
      _apiClient.get(
        '/users',
        query: <String, dynamic>{
          'page': page,
          'limit': 20,
          if (search.trim().isNotEmpty) 'search': search.trim(),
          if (status != 'ALL') 'status': status,
          if (emailStatus != 'ALL') 'emailStatus': emailStatus,
          'sortKey': sortKey,
          'sortDir': sortDir,
        },
      );

  Future<JsonMap> user(String id) => _apiClient.get('/users/$id');

  Future<JsonMap> userStats() => _apiClient.get('/users/stats');

  Future<String> updateUserStatus(String id, bool isActive) async {
    final JsonMap response = await _apiClient.patch(
      '/users/$id/status',
      data: <String, bool>{'isActive': isActive},
    );
    return stringValue(
        response['message'], 'Status pengguna berhasil diperbarui');
  }

  Future<String> deleteUser(String id) async {
    final JsonMap response = await _apiClient.delete('/users/$id');
    return stringValue(response['message'], 'Pengguna berhasil dihapus');
  }

  Future<JsonMap> emailLogs({
    required int page,
    String search = '',
    String type = 'ALL',
    String status = 'ALL',
    String sortKey = 'createdAt',
    String sortDir = 'desc',
    String? dateFrom,
    String? dateTo,
  }) =>
      _apiClient.get(
        '/email-logs',
        query: <String, dynamic>{
          'page': page,
          'limit': 20,
          if (search.trim().isNotEmpty) 'search': search.trim(),
          if (type != 'ALL') 'type': type,
          if (status != 'ALL') 'status': status,
          'sortKey': sortKey,
          'sortDir': sortDir,
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
        },
      );

  Future<JsonMap> emailStats() => _apiClient.get('/email-logs/stats');

  Future<String> retryEmail(String id) async {
    final JsonMap response = await _apiClient.post('/email-logs/$id/retry');
    return stringValue(response['message'], 'Email berhasil dikirim ulang');
  }

  Future<List<JsonMap>> backups() async {
    final JsonMap response = await _apiClient.get('/backups');
    return jsonMapList(response['data']);
  }

  Future<String> createBackup() async {
    final JsonMap response = await _apiClient.post(
      '/backups',
      receiveTimeout: const Duration(minutes: 6),
    );
    return stringValue(response['message'], 'Backup berhasil dibuat');
  }

  Future<String> deleteBackup(String key) async {
    final JsonMap response = await _apiClient.delete(
      '/backups',
      query: <String, dynamic>{'key': key},
    );
    return stringValue(response['message'], 'Backup berhasil dihapus');
  }

  Future<Uri> backupUrl(String key) async {
    final JsonMap response = await _apiClient.get(
      '/backups/url',
      query: <String, dynamic>{'key': key},
    );
    final Uri? uri = Uri.tryParse(stringValue(response['url']));
    if (uri == null || !uri.hasScheme) {
      throw const FormatException('URL backup tidak valid');
    }
    return uri;
  }
}
