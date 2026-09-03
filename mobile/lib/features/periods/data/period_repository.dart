import '../../../core/network/api_client.dart';
import '../../../shared/models/json_value.dart';
import '../domain/app_period.dart';

class PeriodRepository {
  const PeriodRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<AppPeriod>> list() async {
    final JsonMap response = await _apiClient.get(
      '/periods',
      query: <String, dynamic>{'page': 1, 'limit': 100},
    );
    return jsonMapList(response['data'])
        .map<AppPeriod>(AppPeriod.fromJson)
        .toList(growable: false);
  }

  Future<void> create(String name) => _apiClient.post(
        '/periods',
        data: <String, String>{'nama': name.trim()},
      );

  Future<void> update(String id, String name) => _apiClient.patch(
        '/periods/$id',
        data: <String, String>{'nama': name.trim()},
      );

  Future<void> activate(String id) => _apiClient.post('/periods/$id/activate');

  Future<void> delete(String id) => _apiClient.delete('/periods/$id');
}
