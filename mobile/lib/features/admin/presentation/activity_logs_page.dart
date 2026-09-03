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
import '../../auth/domain/app_user.dart';
import '../data/admin_repository.dart';
import 'admin_widgets.dart';

class ActivityLogsPage extends ConsumerStatefulWidget {
  const ActivityLogsPage({required this.user, super.key});

  final AppUser user;

  @override
  ConsumerState<ActivityLogsPage> createState() => _ActivityLogsPageState();
}

class _ActivityLogsPageState extends ConsumerState<ActivityLogsPage> {
  final TextEditingController _searchController = TextEditingController();
  List<JsonMap> _items = <JsonMap>[];
  List<JsonMap> _pacUsers = <JsonMap>[];
  JsonMap _stats = <String, dynamic>{};
  JsonMap _monitoring = <String, dynamic>{};
  int _page = 1;
  int _totalPages = 1;
  String _scope = 'personal';
  String _action = 'ALL';
  String _module = 'ALL';
  String _userId = 'ALL';
  String _sortKey = 'createdAt';
  String _sortDir = 'desc';
  DateTime? _startDate;
  DateTime? _endDate;
  String? _error;
  bool _loading = true;

  AdminRepository get _repository => ref.read(adminRepositoryProvider);

  @override
  void initState() {
    super.initState();
    if (widget.user.isCabang) unawaited(_loadPacUsers());
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
        _repository.activityLogs(
          page: targetPage,
          scope: _scope,
          search: _searchController.text,
          action: _action,
          module: _module,
          userId: _scope == 'global' ? _userId : 'ALL',
          startDate: _startDate == null ? null : _apiDate(_startDate!),
          endDate: _endDate == null ? null : _apiDate(_endDate!),
          sortKey: _sortKey,
          sortDir: _sortDir,
        ),
        _repository.activityStats(
          scope: _scope,
          userId: _scope == 'global' ? _userId : 'ALL',
        ),
        if (widget.user.isCabang && _scope == 'global')
          _repository.activityMonitoring(userId: _userId),
      ]);
      final JsonMap pagination = jsonMap(results[0]['pagination']);
      if (!mounted) return;
      setState(() {
        _items = jsonMapList(results[0]['data']);
        _stats = jsonMap(results[1]['data']);
        _monitoring = results.length > 2
            ? jsonMap(results[2]['data'])
            : <String, dynamic>{};
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

  Future<void> _loadPacUsers() async {
    try {
      final List<JsonMap> users = await _repository.pacUsers();
      if (mounted) setState(() => _pacUsers = users);
    } on Object {
      // The global log remains usable without the optional PAC selector.
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(realtimeControllerProvider, (previous, next) {
      if (previous != null && next.revision > previous.revision && !_loading) {
        unawaited(_load());
        if (widget.user.isCabang) unawaited(_loadPacUsers());
      }
    });
    return Scaffold(
      appBar: AppBar(
        title: const Text('Riwayat Aktivitas'),
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
                        if (widget.user.isCabang) ...<Widget>[
                          _ActivityScopeCard(
                            scope: _scope,
                            userId: _userId,
                            pacUsers: _pacUsers,
                            onScopeChanged: (String value) {
                              _scope = value;
                              if (_scope != 'global') _userId = 'ALL';
                              unawaited(_load(page: 1));
                            },
                            onUserChanged: (String value) {
                              _userId = value;
                              unawaited(_load(page: 1));
                            },
                          ),
                          const SizedBox(height: 16),
                        ],
                        _ActivitySummaryPanel(
                          items: _activitySummaryItems(context),
                        ),
                        if (_monitoring.isNotEmpty) ...<Widget>[
                          const SizedBox(height: 18),
                          _MonitoringPreview(data: _monitoring),
                        ],
                        const SizedBox(height: 18),
                        AdminSearchField(
                          controller: _searchController,
                          hint: 'Cari pengguna atau deskripsi…',
                          onSubmitted: (_) => _load(page: 1),
                        ),
                        const SizedBox(height: 10),
                        AppResponsiveFields(
                          children: <Widget>[
                            AppSelectField<String>(
                              value: _action,
                              label: 'Aksi',
                              options: const <AppSelectOption<String>>[
                                AppSelectOption<String>(
                                    value: 'ALL', label: 'Semua aksi'),
                                AppSelectOption<String>(
                                    value: 'CREATE', label: 'Tambah'),
                                AppSelectOption<String>(
                                    value: 'UPDATE', label: 'Ubah'),
                                AppSelectOption<String>(
                                    value: 'DELETE', label: 'Hapus'),
                                AppSelectOption<String>(
                                    value: 'IMPORT', label: 'Impor'),
                                AppSelectOption<String>(
                                    value: 'EXPORT', label: 'Ekspor'),
                                AppSelectOption<String>(
                                    value: 'APPROVE', label: 'Terima'),
                                AppSelectOption<String>(
                                    value: 'REJECT', label: 'Tolak'),
                                AppSelectOption<String>(
                                    value: 'LOGIN', label: 'Login'),
                                AppSelectOption<String>(
                                    value: 'LOGOUT', label: 'Logout'),
                              ],
                              onChanged: (String? value) {
                                _action = value ?? 'ALL';
                                unawaited(_load(page: 1));
                              },
                            ),
                            AppSelectField<String>(
                              value: _module,
                              label: 'Modul',
                              options: const <AppSelectOption<String>>[
                                AppSelectOption<String>(
                                    value: 'ALL', label: 'Semua modul'),
                                AppSelectOption<String>(
                                    value: 'ANGGOTA', label: 'Anggota'),
                                AppSelectOption<String>(
                                    value: 'ARSIP_SURAT', label: 'Arsip'),
                                AppSelectOption<String>(
                                    value: 'BERKAS_PIMPINAN',
                                    label: 'Berkas pimpinan'),
                                AppSelectOption<String>(
                                    value: 'BERKAS_SP', label: 'Berkas SP'),
                                AppSelectOption<String>(
                                    value: 'AGENDA_KEGIATAN', label: 'Agenda'),
                                AppSelectOption<String>(
                                    value: 'PENGAJUAN_BERKAS',
                                    label: 'Pengajuan'),
                                AppSelectOption<String>(
                                    value: 'PRESENSI', label: 'Presensi'),
                                AppSelectOption<String>(
                                    value: 'USER', label: 'Pengguna'),
                                AppSelectOption<String>(
                                    value: 'PERIODE', label: 'Periode'),
                                AppSelectOption<String>(
                                    value: 'AUTH', label: 'Autentikasi'),
                                AppSelectOption<String>(
                                    value: 'WILAYAH', label: 'Wilayah'),
                              ],
                              onChanged: (String? value) {
                                _module = value ?? 'ALL';
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
                                    options: const <AppSelectOption<String>>[
                                      AppSelectOption<String>(
                                          value: 'createdAt', label: 'Waktu'),
                                      AppSelectOption<String>(
                                          value: 'action', label: 'Aksi'),
                                      AppSelectOption<String>(
                                          value: 'module', label: 'Modul'),
                                      AppSelectOption<String>(
                                          value: 'description',
                                          label: 'Deskripsi'),
                                      AppSelectOption<String>(
                                          value: 'user', label: 'Pengguna'),
                                    ],
                                    onChanged: (String? value) {
                                      _sortKey = value ?? 'createdAt';
                                      unawaited(_load(page: 1));
                                    },
                                  ),
                                ),
                                const SizedBox(width: 8),
                                IconButton.outlined(
                                  onPressed: () {
                                    _sortDir =
                                        _sortDir == 'asc' ? 'desc' : 'asc';
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
                        if (_hasExtraFilters)
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton.icon(
                              onPressed: _resetFilters,
                              icon: const Icon(Icons.restart_alt_rounded),
                              label: const Text('Reset filter'),
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
                            icon: Icons.history_toggle_off_rounded,
                            title: 'Belum ada aktivitas',
                            message:
                                'Aktivitas yang sesuai filter akan tampil di sini.',
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

  bool get _hasExtraFilters =>
      _startDate != null ||
      _endDate != null ||
      _sortKey != 'createdAt' ||
      _sortDir != 'desc' ||
      _userId != 'ALL';

  String get _dateRangeLabel {
    if (_startDate == null) return 'Rentang tanggal';
    final String start = _displayDate(_startDate!);
    final String end = _displayDate(_endDate ?? _startDate!);
    return start == end ? start : '$start – $end';
  }

  Future<void> _pickDateRange() async {
    final DateTime today = DateUtils.dateOnly(DateTime.now());
    final DateTimeRange? range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: today,
      initialDateRange: _startDate == null
          ? null
          : DateTimeRange(
              start: _startDate!,
              end: _endDate ?? _startDate!,
            ),
      helpText: 'Pilih rentang aktivitas',
    );
    if (range == null || !mounted) return;
    setState(() {
      _startDate = DateUtils.dateOnly(range.start);
      _endDate = DateUtils.dateOnly(range.end);
    });
    await _load(page: 1);
  }

  void _resetFilters() {
    setState(() {
      _startDate = null;
      _endDate = null;
      _sortKey = 'createdAt';
      _sortDir = 'desc';
      _userId = 'ALL';
    });
    unawaited(_load(page: 1));
  }

  String _apiDate(DateTime date) => '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  String _displayDate(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/'
      '${date.month.toString().padLeft(2, '0')}/${date.year}';

  Widget _buildItem(JsonMap item) {
    final JsonMap user = jsonMap(item['user']);
    final String action = stringValue(item['action']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _showDetail(stringValue(item['id'])),
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                CircleAvatar(
                  radius: 20,
                  backgroundColor: _actionColor(action).withOpacity(0.1),
                  child: Icon(_actionIcon(action),
                      color: _actionColor(action), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        stringValue(item['description'], 'Aktivitas'),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${stringValue(user['name'], 'Pengguna')} · ${stringValue(item['module'])}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 3),
                      Text(formatAdminDate(item['createdAt']),
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showDetail(String id) async {
    if (id.isEmpty) return;
    try {
      final JsonMap response = await _repository.activityLog(id);
      if (!mounted) return;
      final JsonMap item = jsonMap(response['data']);
      final JsonMap user = jsonMap(item['user']);
      final JsonMap periode = jsonMap(item['periode']);
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (BuildContext sheetContext) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.72,
          maxChildSize: 0.94,
          builder: (BuildContext context, ScrollController controller) =>
              ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: <Widget>[
              Text('Detail aktivitas',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              AdminLabelValue(
                  label: 'Deskripsi', value: stringValue(item['description'])),
              AdminLabelValue(
                  label: 'Aksi', value: stringValue(item['action'])),
              AdminLabelValue(
                  label: 'Modul', value: stringValue(item['module'])),
              AdminLabelValue(
                  label: 'Entity ID', value: stringValue(item['entityId'])),
              AdminLabelValue(
                  label: 'Periode', value: stringValue(periode['nama'])),
              AdminLabelValue(
                  label: 'Pengguna', value: stringValue(user['name'])),
              AdminLabelValue(
                  label: 'Email', value: stringValue(user['email'])),
              AdminLabelValue(
                  label: 'Role',
                  value: stringValue(user['role']).replaceAll('_', ' ')),
              AdminLabelValue(
                  label: 'Waktu', value: formatAdminDate(item['createdAt'])),
              AdminLabelValue(
                  label: 'Perangkat', value: stringValue(item['device'])),
              AdminLabelValue(
                  label: 'Browser', value: stringValue(item['browser'])),
              AdminLabelValue(
                  label: 'IP', value: stringValue(item['ipAddress'])),
              AdminLabelValue(
                  label: 'Lokasi', value: stringValue(item['location'])),
              AdminLabelValue(
                  label: 'User agent', value: stringValue(item['userAgent'])),
            ],
          ),
        ),
      );
    } catch (error) {
      if (mounted) showAdminMessage(context, AppException.messageOf(error));
    }
  }

  List<AdminSummaryItem> _activitySummaryItems(BuildContext context) {
    final List<_ActivityModuleSummary> modules =
        widget.user.isCabang ? _cabangActivityModules : _pacActivityModules;
    return modules
        .map<AdminSummaryItem>(
          (_ActivityModuleSummary module) => AdminSummaryItem(
            module.label,
            intValue(_stats[module.key]),
            module.icon,
            module.key == 'TOTAL'
                ? Theme.of(context).colorScheme.primary
                : module.color,
          ),
        )
        .toList(growable: false);
  }

  Color _actionColor(String value) => switch (value) {
        'CREATE' => AppColors.pac,
        'DELETE' => AppColors.danger,
        'LOGIN' || 'LOGOUT' => AppColors.cabang,
        _ => AppColors.warning,
      };

  IconData _actionIcon(String value) => switch (value) {
        'CREATE' => Icons.add_rounded,
        'DELETE' => Icons.delete_outline_rounded,
        'LOGIN' => Icons.login_rounded,
        'LOGOUT' => Icons.logout_rounded,
        _ => Icons.edit_outlined,
      };
}

class _ActivityScopeCard extends StatelessWidget {
  const _ActivityScopeCard({
    required this.scope,
    required this.userId,
    required this.pacUsers,
    required this.onScopeChanged,
    required this.onUserChanged,
  });

  final String scope;
  final String userId;
  final List<JsonMap> pacUsers;
  final ValueChanged<String> onScopeChanged;
  final ValueChanged<String> onUserChanged;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppColors.cabang.withOpacity(.1),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Icon(
                      Icons.manage_search_rounded,
                      color: AppColors.cabang,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          'Cakupan aktivitas',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          scope == 'global'
                              ? 'Pantau seluruh PAC atau pilih satu akun.'
                              : 'Aktivitas akun Cabang yang sedang digunakan.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<String>(
                  expandedInsets: EdgeInsets.zero,
                  showSelectedIcon: false,
                  segments: const <ButtonSegment<String>>[
                    ButtonSegment<String>(
                      value: 'personal',
                      label: Text('Aktivitas saya'),
                    ),
                    ButtonSegment<String>(
                      value: 'global',
                      label: Text('Semua PAC'),
                    ),
                  ],
                  selected: <String>{scope},
                  onSelectionChanged: (Set<String> value) =>
                      onScopeChanged(value.first),
                ),
              ),
              if (scope == 'global') ...<Widget>[
                const SizedBox(height: 14),
                AppSelectField<String>(
                  value: userId,
                  label: 'PAC yang dipantau',
                  prefixIcon: Icons.account_tree_outlined,
                  searchHint: 'Cari nama PAC…',
                  options: <AppSelectOption<String>>[
                    const AppSelectOption<String>(
                      value: 'ALL',
                      label: 'Semua pengguna PAC',
                    ),
                    ...pacUsers.map<AppSelectOption<String>>(
                      (JsonMap user) => AppSelectOption<String>(
                        value: stringValue(user['id']),
                        label: stringValue(user['name']),
                        note: stringValue(user['email']).isEmpty
                            ? null
                            : stringValue(user['email']),
                      ),
                    ),
                  ],
                  onChanged: (String? value) => onUserChanged(value ?? 'ALL'),
                ),
              ],
            ],
          ),
        ),
      );
}

class _ActivitySummaryPanel extends StatelessWidget {
  const _ActivitySummaryPanel({required this.items});

  final List<AdminSummaryItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final AdminSummaryItem total = items.first;
    final List<AdminSummaryItem> modules =
        items.skip(1).toList(growable: false);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: total.color.withOpacity(.12),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(total.icon, color: total.color),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    total.label,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Text(
                  '${total.value}',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: total.color,
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ],
            ),
            if (modules.isNotEmpty) ...<Widget>[
              const SizedBox(height: 14),
              AppAdaptiveGrid(
                minItemWidth: 140,
                maxColumns: 3,
                spacing: 8,
                runSpacing: 8,
                children: modules
                    .map<Widget>(
                      (AdminSummaryItem item) => Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          color: item.color.withOpacity(.055),
                          borderRadius: BorderRadius.circular(11),
                          border: Border.all(
                            color: item.color.withOpacity(.14),
                          ),
                        ),
                        child: Row(
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                item.label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${item.value}',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelLarge
                                  ?.copyWith(
                                    color: item.color,
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(growable: false),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ActivityModuleSummary {
  const _ActivityModuleSummary(this.key, this.label, this.icon, this.color);

  final String key;
  final String label;
  final IconData icon;
  final Color color;
}

const List<_ActivityModuleSummary> _cabangActivityModules =
    <_ActivityModuleSummary>[
  _ActivityModuleSummary(
      'TOTAL', 'Semua aktivitas', Icons.history_rounded, AppColors.muted),
  _ActivityModuleSummary('ARSIP_SURAT', 'Arsip surat',
      Icons.inventory_2_outlined, AppColors.cabang),
  _ActivityModuleSummary(
      'ANGGOTA', 'Anggota', Icons.groups_2_outlined, AppColors.pac),
  _ActivityModuleSummary('BERKAS_PIMPINAN', 'Berkas pimpinan',
      Icons.folder_copy_outlined, AppColors.warning),
  _ActivityModuleSummary(
      'BERKAS_SP', 'Berkas SP', Icons.gavel_outlined, AppColors.cabang),
  _ActivityModuleSummary('AGENDA_KEGIATAN', 'Kegiatan',
      Icons.calendar_month_outlined, AppColors.warning),
  _ActivityModuleSummary('PENGAJUAN_BERKAS', 'Pengajuan PAC',
      Icons.outbox_outlined, AppColors.danger),
  _ActivityModuleSummary(
      'PERIODE', 'Periode', Icons.layers_outlined, AppColors.cabang),
  _ActivityModuleSummary('USER', 'Pengguna & profil',
      Icons.manage_accounts_outlined, AppColors.cabang),
  _ActivityModuleSummary(
      'AUTH', 'Autentikasi', Icons.lock_outline_rounded, AppColors.muted),
  _ActivityModuleSummary(
      'WILAYAH', 'Wilayah', Icons.map_outlined, AppColors.pac),
  _ActivityModuleSummary(
      'PRESENSI', 'Presensi', Icons.how_to_reg_outlined, AppColors.pac),
];

const List<_ActivityModuleSummary> _pacActivityModules =
    <_ActivityModuleSummary>[
  _ActivityModuleSummary(
      'TOTAL', 'Semua aktivitas', Icons.history_rounded, AppColors.muted),
  _ActivityModuleSummary('ARSIP_SURAT', 'Arsip surat',
      Icons.inventory_2_outlined, AppColors.cabang),
  _ActivityModuleSummary('BERKAS_PIMPINAN', 'Berkas pimpinan',
      Icons.folder_copy_outlined, AppColors.warning),
  _ActivityModuleSummary('PENGAJUAN_BERKAS', 'Pengajuan PAC',
      Icons.outbox_outlined, AppColors.danger),
  _ActivityModuleSummary(
      'ANGGOTA', 'Anggota', Icons.groups_2_outlined, AppColors.pac),
  _ActivityModuleSummary(
      'PERIODE', 'Periode', Icons.layers_outlined, AppColors.cabang),
  _ActivityModuleSummary('USER', 'Pengguna & profil',
      Icons.manage_accounts_outlined, AppColors.cabang),
  _ActivityModuleSummary(
      'AUTH', 'Autentikasi', Icons.lock_outline_rounded, AppColors.muted),
  _ActivityModuleSummary(
      'WILAYAH', 'Wilayah', Icons.map_outlined, AppColors.pac),
  _ActivityModuleSummary(
      'PRESENSI', 'Presensi', Icons.how_to_reg_outlined, AppColors.pac),
];

class _MonitoringPreview extends StatelessWidget {
  const _MonitoringPreview({required this.data});

  final JsonMap data;

  @override
  Widget build(BuildContext context) {
    final List<JsonMap> leaderboard = jsonMapList(data['leaderboard']);
    final List<JsonMap> distribution = jsonMapList(data['distribution']);
    final List<JsonMap> timeline = jsonMapList(data['timeline']);
    if (leaderboard.isEmpty && distribution.isEmpty && timeline.isEmpty) {
      return const SizedBox.shrink();
    }
    int maximumCount = 1;
    for (final JsonMap item in timeline) {
      final int count = intValue(item['count']);
      if (count > maximumCount) maximumCount = count;
    }
    final int leaderboardLimit = leaderboard.length.clamp(0, 5);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.cabang.withOpacity(.1),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: const Icon(
                    Icons.insights_rounded,
                    color: AppColors.cabang,
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Aktivitas 7 hari terakhir',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        'Ringkasan modul dan PAC yang paling aktif',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (distribution.isNotEmpty) ...<Widget>[
              const SizedBox(height: 14),
              AppAdaptiveGrid(
                key: const ValueKey<String>('monitoring-distribution-grid'),
                minItemWidth: 150,
                maxColumns: 2,
                spacing: 8,
                runSpacing: 8,
                children: distribution.map<Widget>(
                  (JsonMap item) {
                    final String key = stringValue(item['name']);
                    final Color color = _monitoringColor(key);
                    return Container(
                      key: ValueKey<String>('monitoring-metric-$key'),
                      height: 56,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: color.withOpacity(.055),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: color.withOpacity(.15)),
                      ),
                      child: Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              _monitoringLabel(key),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${intValue(item['value'])}',
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
            if (timeline.isNotEmpty) ...<Widget>[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSoft,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: SizedBox(
                  height: 104,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: timeline.map<Widget>((JsonMap item) {
                      final int count = intValue(item['count']);
                      final double barHeight = 8 + (count / maximumCount * 50);
                      return Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: <Widget>[
                            Text(
                              '$count',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              height: barHeight,
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.bottomCenter,
                                  end: Alignment.topCenter,
                                  colors: <Color>[
                                    AppColors.cabang,
                                    AppColors.cabangBright,
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(7),
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              stringValue(item['date']).split('-').last,
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ],
                        ),
                      );
                    }).toList(growable: false),
                  ),
                ),
              ),
            ],
            if (leaderboard.isNotEmpty) ...<Widget>[
              const SizedBox(height: 16),
              Text(
                'PAC paling aktif',
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              for (int index = 0; index < leaderboardLimit; index++)
                Container(
                  margin: EdgeInsets.only(
                    bottom: index == leaderboardLimit - 1 ? 0 : 7,
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
                  decoration: BoxDecoration(
                    color: index == 0
                        ? AppColors.pac.withOpacity(.065)
                        : AppColors.surfaceSoft,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Row(
                    children: <Widget>[
                      Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: index == 0
                              ? AppColors.pac.withOpacity(.14)
                              : AppColors.surface,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '${index + 1}',
                          style:
                              Theme.of(context).textTheme.labelMedium?.copyWith(
                                    fontWeight: FontWeight.w900,
                                  ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          stringValue(leaderboard[index]['name']),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        intValue(leaderboard[index]['count']).toString(),
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: AppColors.pac,
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  String _monitoringLabel(String value) => switch (value.toUpperCase()) {
        'AUTH' => 'Autentikasi',
        'ANGGOTA' => 'Anggota',
        'ARSIP_SURAT' => 'Arsip surat',
        'PENGAJUAN_BERKAS' => 'Pengajuan berkas',
        'BERKAS_SP' => 'Berkas SP',
        'BERKAS_PIMPINAN' => 'Berkas pimpinan',
        'PRESENSI' => 'Presensi',
        final String other => other
            .toLowerCase()
            .split('_')
            .map((String part) => part.isEmpty
                ? part
                : '${part[0].toUpperCase()}${part.substring(1)}')
            .join(' '),
      };

  Color _monitoringColor(String value) => switch (value.toUpperCase()) {
        'AUTH' => AppColors.muted,
        'ANGGOTA' || 'PRESENSI' => AppColors.pac,
        'PENGAJUAN_BERKAS' => AppColors.danger,
        'BERKAS_PIMPINAN' => AppColors.warning,
        _ => AppColors.cabang,
      };
}
