import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/errors/app_exception.dart';
import '../../../shared/models/json_value.dart';
import '../../../shared/widgets/app_layout.dart';
import '../../../shared/widgets/app_select_field.dart';
import '../../../shared/widgets/app_states.dart';
import '../data/admin_repository.dart';
import 'admin_widgets.dart';

class EmailLogsPage extends ConsumerStatefulWidget {
  const EmailLogsPage({super.key});

  @override
  ConsumerState<EmailLogsPage> createState() => _EmailLogsPageState();
}

class _EmailLogsPageState extends ConsumerState<EmailLogsPage> {
  final TextEditingController _searchController = TextEditingController();
  List<JsonMap> _items = <JsonMap>[];
  JsonMap _stats = <String, dynamic>{};
  int _page = 1;
  int _totalPages = 1;
  String _type = 'ALL';
  String _status = 'ALL';
  String _sortKey = 'createdAt';
  String _sortDir = 'desc';
  DateTime? _dateFrom;
  DateTime? _dateTo;
  String? _retryingId;
  String? _error;
  bool _loading = true;

  AdminRepository get _repository => ref.read(adminRepositoryProvider);

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({int? page}) async {
    final int targetPage = page ?? _page;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final List<JsonMap> results =
          await Future.wait<JsonMap>(<Future<JsonMap>>[
        _repository.emailLogs(
          page: targetPage,
          search: _searchController.text,
          type: _type,
          status: _status,
          sortKey: _sortKey,
          sortDir: _sortDir,
          dateFrom: _dateFrom == null ? null : _apiDate(_dateFrom!),
          dateTo: _dateTo == null ? null : _apiDate(_dateTo!),
        ),
        _repository.emailStats(),
      ]);
      final JsonMap pagination = jsonMap(results[0]['pagination']);
      if (!mounted) return;
      setState(() {
        _items = jsonMapList(results[0]['data']);
        _stats = jsonMap(results[1]['data']);
        _page = intValue(pagination['page'], targetPage);
        _totalPages = intValue(pagination['totalPages'], 1);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = AppException.messageOf(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(realtimeControllerProvider, (previous, next) {
      if (previous != null && next.revision > previous.revision && !_loading) {
        unawaited(_load());
      }
    });
    return Scaffold(
      appBar: AppBar(
        title: const Text('Log Email'),
        actions: <Widget>[
          IconButton(
            onPressed: _loading ? null : _load,
            tooltip: 'Muat ulang',
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading && _items.isEmpty
          ? const AppLoadingList()
          : _error != null && _items.isEmpty
              ? AppErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: AppConstrainedContent(
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                      children: <Widget>[
                        AdminSummaryGrid(
                          items: <AdminSummaryItem>[
                            AdminSummaryItem(
                                'Semua email',
                                intValue(_stats['totalAll']),
                                Icons.mark_email_read_outlined,
                                AppColors.cabang),
                            AdminSummaryItem(
                                'Hari ini',
                                intValue(_stats['totalToday']),
                                Icons.today_outlined,
                                AppColors.warning),
                            AdminSummaryItem(
                                'Terkirim',
                                intValue(_stats['totalSent']),
                                Icons.check_circle_outline_rounded,
                                AppColors.pac),
                            AdminSummaryItem(
                                'Gagal',
                                intValue(_stats['totalFailed']),
                                Icons.error_outline_rounded,
                                AppColors.danger),
                          ],
                        ),
                        if (jsonMap(_stats['byType']).isNotEmpty) ...<Widget>[
                          const SizedBox(height: 12),
                          Card(
                            child: ExpansionTile(
                              leading: const Icon(Icons.donut_small_rounded),
                              title: const Text('Rincian jenis email'),
                              subtitle: const Text(
                                'Lihat distribusi pengiriman',
                              ),
                              childrenPadding:
                                  const EdgeInsets.fromLTRB(16, 0, 16, 16),
                              children: <Widget>[
                                AppAdaptiveGrid(
                                  key: const ValueKey<String>(
                                    'email-type-distribution',
                                  ),
                                  minItemWidth: 150,
                                  maxColumns: 2,
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: jsonMap(_stats['byType'])
                                      .entries
                                      .map<Widget>(
                                    (MapEntry<String, dynamic> item) {
                                      final Color color =
                                          _emailTypeColor(item.key);
                                      return Container(
                                        key: ValueKey<String>(
                                          'email-type-${item.key}',
                                        ),
                                        height: 58,
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                        ),
                                        decoration: BoxDecoration(
                                          color: color.withOpacity(.055),
                                          borderRadius:
                                              BorderRadius.circular(14),
                                          border: Border.all(
                                            color: color.withOpacity(.16),
                                          ),
                                        ),
                                        child: Row(
                                          children: <Widget>[
                                            Expanded(
                                              child: Text(
                                                _emailTypeLabel(item.key),
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .labelMedium
                                                    ?.copyWith(
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                              '${intValue(item.value)}',
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .titleMedium
                                                  ?.copyWith(
                                                    color: color,
                                                    fontWeight: FontWeight.w900,
                                                  ),
                                            ),
                                          ],
                                        ),
                                      );
                                    },
                                  ).toList(growable: false),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 18),
                        AdminSearchField(
                          controller: _searchController,
                          hint: 'Cari penerima atau subjek…',
                          onSubmitted: (_) => _load(page: 1),
                        ),
                        const SizedBox(height: 10),
                        Card(
                          child: ExpansionTile(
                            leading: Badge(
                              isLabelVisible: _activeFilterCount > 0,
                              label: Text('$_activeFilterCount'),
                              child: const Icon(Icons.tune_rounded),
                            ),
                            title: const Text('Filter dan pengurutan'),
                            subtitle: Text(
                              _activeFilterCount == 0
                                  ? 'Menampilkan semua log terbaru'
                                  : '$_activeFilterCount filter aktif',
                            ),
                            childrenPadding:
                                const EdgeInsets.fromLTRB(14, 2, 14, 14),
                            children: <Widget>[
                              AppResponsiveFields(
                                children: <Widget>[
                                  AppSelectField<String>(
                                    value: _type,
                                    label: 'Jenis',
                                    options: const <AppSelectOption<String>>[
                                      AppSelectOption<String>(
                                          value: 'ALL', label: 'Semua jenis'),
                                      AppSelectOption<String>(
                                          value: 'VERIFICATION',
                                          label: 'Verifikasi'),
                                      AppSelectOption<String>(
                                          value: 'VERIFIED_SUCCESS',
                                          label: 'Verifikasi sukses'),
                                      AppSelectOption<String>(
                                          value: 'PENGAJUAN_USER',
                                          label: 'Pengajuan PAC'),
                                      AppSelectOption<String>(
                                          value: 'PENGAJUAN_ADMIN',
                                          label: 'Pengajuan admin'),
                                      AppSelectOption<String>(
                                          value: 'PENGAJUAN_STATUS',
                                          label: 'Status pengajuan'),
                                    ],
                                    onChanged: (String? value) {
                                      setState(() => _type = value ?? 'ALL');
                                      unawaited(_load(page: 1));
                                    },
                                  ),
                                  AppSelectField<String>(
                                    value: _status,
                                    label: 'Status',
                                    options: const <AppSelectOption<String>>[
                                      AppSelectOption<String>(
                                          value: 'ALL', label: 'Semua'),
                                      AppSelectOption<String>(
                                          value: 'PENDING', label: 'Menunggu'),
                                      AppSelectOption<String>(
                                          value: 'SENT', label: 'Terkirim'),
                                      AppSelectOption<String>(
                                          value: 'FAILED', label: 'Gagal'),
                                    ],
                                    onChanged: (String? value) {
                                      setState(() => _status = value ?? 'ALL');
                                      unawaited(_load(page: 1));
                                    },
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              AppResponsiveFields(
                                children: <Widget>[
                                  OutlinedButton.icon(
                                    onPressed: _pickDateRange,
                                    icon: const Icon(Icons.date_range_outlined),
                                    label: Text(_dateRangeLabel),
                                  ),
                                  Row(
                                    children: <Widget>[
                                      Expanded(
                                        child: AppSelectField<String>(
                                          value: _sortKey,
                                          label: 'Urutkan',
                                          options: const <AppSelectOption<
                                              String>>[
                                            AppSelectOption<String>(
                                                value: 'createdAt',
                                                label: 'Waktu'),
                                            AppSelectOption<String>(
                                                value: 'to', label: 'Penerima'),
                                            AppSelectOption<String>(
                                                value: 'subject',
                                                label: 'Subjek'),
                                            AppSelectOption<String>(
                                                value: 'type', label: 'Jenis'),
                                            AppSelectOption<String>(
                                                value: 'status',
                                                label: 'Status'),
                                          ],
                                          onChanged: (String? value) {
                                            setState(() => _sortKey =
                                                value ?? 'createdAt');
                                            unawaited(_load(page: 1));
                                          },
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      IconButton.outlined(
                                        onPressed: () {
                                          setState(() => _sortDir =
                                              _sortDir == 'asc'
                                                  ? 'desc'
                                                  : 'asc');
                                          unawaited(_load(page: 1));
                                        },
                                        tooltip: _sortDir == 'asc'
                                            ? 'Urutan naik'
                                            : 'Urutan turun',
                                        icon: Icon(_sortDir == 'asc'
                                            ? Icons.arrow_upward_rounded
                                            : Icons.arrow_downward_rounded),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              if (_activeFilterCount > 0)
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton.icon(
                                    onPressed: _resetFilters,
                                    icon: const Icon(Icons.restart_alt_rounded),
                                    label: const Text('Reset filter'),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(_error!,
                                style:
                                    const TextStyle(color: AppColors.danger)),
                          ),
                        if (_items.isEmpty)
                          const AppEmptyState(
                            icon: Icons.email_outlined,
                            title: 'Belum ada log email',
                            message:
                                'Pengiriman email sistem akan tercatat di sini.',
                          )
                        else
                          ..._items.map<Widget>(_buildItem),
                        if (_items.isNotEmpty) ...<Widget>[
                          const SizedBox(height: 12),
                          AdminPagination(
                            page: _page,
                            totalPages: _totalPages,
                            onPage: (int value) => _load(page: value),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
    );
  }

  String get _dateRangeLabel {
    if (_dateFrom == null) return 'Rentang tanggal';
    final String start = _displayDate(_dateFrom!);
    final String end = _displayDate(_dateTo ?? _dateFrom!);
    return start == end ? start : '$start – $end';
  }

  int get _activeFilterCount => <bool>[
        _type != 'ALL',
        _status != 'ALL',
        _dateFrom != null,
        _sortKey != 'createdAt' || _sortDir != 'desc',
      ].where((bool active) => active).length;

  Future<void> _pickDateRange() async {
    final DateTime today = DateUtils.dateOnly(DateTime.now());
    final DateTimeRange? range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: today,
      initialDateRange: _dateFrom == null
          ? null
          : DateTimeRange(
              start: _dateFrom!,
              end: _dateTo ?? _dateFrom!,
            ),
      helpText: 'Pilih rentang log email',
    );
    if (range == null || !mounted) return;
    setState(() {
      _dateFrom = DateUtils.dateOnly(range.start);
      _dateTo = DateUtils.dateOnly(range.end);
    });
    await _load(page: 1);
  }

  void _resetFilters() {
    setState(() {
      _type = 'ALL';
      _status = 'ALL';
      _dateFrom = null;
      _dateTo = null;
      _sortKey = 'createdAt';
      _sortDir = 'desc';
    });
    unawaited(_load(page: 1));
  }

  String _emailTypeLabel(String type) => switch (type) {
        'VERIFICATION' => 'Verifikasi',
        'VERIFIED_SUCCESS' => 'Verifikasi sukses',
        'PENGAJUAN_USER' => 'Pengajuan PAC',
        'PENGAJUAN_ADMIN' => 'Pengajuan admin',
        'PENGAJUAN_STATUS' => 'Status pengajuan',
        _ => type.replaceAll('_', ' '),
      };

  Color _emailTypeColor(String type) => switch (type) {
        'VERIFICATION' || 'VERIFIED_SUCCESS' => AppColors.pac,
        'PENGAJUAN_STATUS' => AppColors.cabang,
        'PENGAJUAN_ADMIN' => AppColors.warning,
        'PENGAJUAN_USER' => AppColors.purple,
        _ => AppColors.aqua,
      };

  String _apiDate(DateTime date) => '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  String _displayDate(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/'
      '${date.month.toString().padLeft(2, '0')}/${date.year}';

  Widget _buildItem(JsonMap item) {
    final String id = stringValue(item['id']);
    final String status = stringValue(item['status']);
    final bool failed = status == 'FAILED';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _showDetail(item),
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                CircleAvatar(
                  backgroundColor: _statusColor(status).withOpacity(0.1),
                  child: Icon(_statusIcon(status), color: _statusColor(status)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        stringValue(item['subject'], 'Email sistem'),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(stringValue(item['to']),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 7),
                      Row(
                        children: <Widget>[
                          _EmailStatus(
                              label: _statusLabel(status),
                              color: _statusColor(status)),
                          const SizedBox(width: 8),
                          Expanded(
                              child: Text(formatAdminDate(item['createdAt']),
                                  textAlign: TextAlign.end,
                                  style:
                                      Theme.of(context).textTheme.bodySmall)),
                        ],
                      ),
                    ],
                  ),
                ),
                if (failed)
                  IconButton(
                    tooltip: 'Kirim ulang',
                    onPressed: _retryingId == null ? () => _retry(id) : null,
                    icon: _retryingId == id
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.replay_rounded),
                  )
                else
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Icon(Icons.chevron_right_rounded,
                        color: AppColors.muted),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _retry(String id) async {
    setState(() => _retryingId = id);
    String message;
    try {
      message = await _repository.retryEmail(id);
    } catch (error) {
      message = AppException.messageOf(error);
    }
    if (!mounted) return;
    showAdminMessage(context, message);
    // Retry yang gagal tetap mengubah retryCount/errorMessage di backend.
    // Selalu muat ulang agar UI mencerminkan hasil percobaan terakhir.
    await _load();
    if (mounted) setState(() => _retryingId = null);
  }

  Future<void> _showDetail(JsonMap item) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (BuildContext sheetContext) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.68,
          maxChildSize: 0.92,
          builder: (BuildContext context, ScrollController controller) =>
              ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: <Widget>[
              Text('Detail email',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              AdminLabelValue(
                  label: 'Penerima', value: stringValue(item['to'])),
              AdminLabelValue(
                  label: 'Subjek', value: stringValue(item['subject'])),
              AdminLabelValue(label: 'Jenis', value: stringValue(item['type'])),
              AdminLabelValue(
                  label: 'Status', value: stringValue(item['status'])),
              AdminLabelValue(
                  label: 'Percobaan ulang',
                  value: intValue(item['retryCount']).toString()),
              AdminLabelValue(
                  label: 'Dibuat', value: formatAdminDate(item['createdAt'])),
              AdminLabelValue(
                  label: 'Diperbarui',
                  value: formatAdminDate(item['updatedAt'])),
              if (stringValue(item['errorMessage']).isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 14),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(stringValue(item['errorMessage']),
                      style: const TextStyle(color: AppColors.danger)),
                ),
            ],
          ),
        ),
      );

  String _statusLabel(String status) => switch (status) {
        'SENT' => 'Terkirim',
        'FAILED' => 'Gagal',
        _ => 'Menunggu',
      };

  Color _statusColor(String status) => switch (status) {
        'SENT' => AppColors.pac,
        'FAILED' => AppColors.danger,
        _ => AppColors.warning,
      };

  IconData _statusIcon(String status) => switch (status) {
        'SENT' => Icons.mark_email_read_outlined,
        'FAILED' => Icons.error_outline_rounded,
        _ => Icons.schedule_rounded,
      };
}

class _EmailStatus extends StatelessWidget {
  const _EmailStatus({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(
                color: color, fontSize: 10, fontWeight: FontWeight.w800)),
      );
}
