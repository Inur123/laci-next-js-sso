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

class UsersPage extends ConsumerStatefulWidget {
  const UsersPage({super.key});

  @override
  ConsumerState<UsersPage> createState() => _UsersPageState();
}

class _UsersPageState extends ConsumerState<UsersPage> {
  final TextEditingController _searchController = TextEditingController();
  List<JsonMap> _items = <JsonMap>[];
  JsonMap _stats = <String, dynamic>{};
  int _page = 1;
  int _totalPages = 1;
  String _status = 'ALL';
  String _emailStatus = 'ALL';
  String _sortKey = 'createdAt';
  String _sortDir = 'desc';
  String? _error;
  String? _mutatingId;
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
        _repository.users(
          page: targetPage,
          search: _searchController.text,
          status: _status,
          emailStatus: _emailStatus,
          sortKey: _sortKey,
          sortDir: _sortDir,
        ),
        _repository.userStats(),
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
        title: const Text('Manajemen User'),
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
                                'Total PAC',
                                intValue(_stats['total']),
                                Icons.groups_2_outlined,
                                AppColors.cabang),
                            AdminSummaryItem(
                                'Aktif',
                                intValue(_stats['aktif']),
                                Icons.check_circle_outline_rounded,
                                AppColors.pac),
                            AdminSummaryItem(
                                'Nonaktif',
                                intValue(_stats['nonaktif']),
                                Icons.block_rounded,
                                AppColors.danger),
                            AdminSummaryItem(
                                'Terverifikasi',
                                intValue(_stats['terverifikasi']),
                                Icons.verified_outlined,
                                AppColors.warning),
                            AdminSummaryItem(
                                'Belum verifikasi',
                                intValue(_stats['belumVerifikasi']),
                                Icons.mark_email_unread_outlined,
                                AppColors.danger),
                          ],
                        ),
                        const SizedBox(height: 18),
                        AdminSearchField(
                          controller: _searchController,
                          hint: 'Cari nama atau email PAC…',
                          onSubmitted: (_) => _load(page: 1),
                        ),
                        const SizedBox(height: 10),
                        AppResponsiveFields(
                          children: <Widget>[
                            AppSelectField<String>(
                              value: _status,
                              label: 'Status akun',
                              options: const <AppSelectOption<String>>[
                                AppSelectOption<String>(
                                    value: 'ALL', label: 'Semua'),
                                AppSelectOption<String>(
                                    value: 'ACTIVE', label: 'Aktif'),
                                AppSelectOption<String>(
                                    value: 'INACTIVE', label: 'Nonaktif'),
                              ],
                              onChanged: (String? value) {
                                _status = value ?? 'ALL';
                                unawaited(_load(page: 1));
                              },
                            ),
                            AppSelectField<String>(
                              value: _emailStatus,
                              label: 'Email',
                              options: const <AppSelectOption<String>>[
                                AppSelectOption<String>(
                                    value: 'ALL', label: 'Semua'),
                                AppSelectOption<String>(
                                    value: 'VERIFIED', label: 'Terverifikasi'),
                                AppSelectOption<String>(
                                    value: 'UNVERIFIED', label: 'Belum'),
                              ],
                              onChanged: (String? value) {
                                _emailStatus = value ?? 'ALL';
                                unawaited(_load(page: 1));
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: AppSelectField<String>(
                                value: _sortKey,
                                label: 'Urutkan',
                                options: const <AppSelectOption<String>>[
                                  AppSelectOption<String>(
                                      value: 'createdAt',
                                      label: 'Tanggal terdaftar'),
                                  AppSelectOption<String>(
                                      value: 'name', label: 'Nama'),
                                  AppSelectOption<String>(
                                      value: 'email', label: 'Email'),
                                  AppSelectOption<String>(
                                      value: 'isActive', label: 'Status akun'),
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
                                _sortDir = _sortDir == 'asc' ? 'desc' : 'asc';
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
                            icon: Icons.person_search_outlined,
                            title: 'Pengguna tidak ditemukan',
                            message:
                                'Ubah pencarian atau filter untuk melihat pengguna PAC.',
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

  Widget _buildItem(JsonMap item) {
    final String id = stringValue(item['id']);
    final String name = stringValue(item['name'], 'Sekretaris PAC');
    final bool active = boolValue(item['isActive']);
    final bool verified = boolValue(item['emailVerified']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: _mutatingId == null ? () => _showDetail(id) : null,
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(
              children: <Widget>[
                CircleAvatar(
                  backgroundColor:
                      Theme.of(context).colorScheme.primary.withOpacity(0.1),
                  child: Text(_initials(name),
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 3),
                      Text(stringValue(item['email']),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 7),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: <Widget>[
                          _MiniStatus(
                              label: active ? 'Aktif' : 'Nonaktif',
                              positive: active),
                          _MiniStatus(
                              label: verified ? 'Email valid' : 'Belum valid',
                              positive: verified),
                        ],
                      ),
                    ],
                  ),
                ),
                if (_mutatingId == id)
                  const SizedBox(
                      width: 26,
                      height: 26,
                      child: CircularProgressIndicator(strokeWidth: 2))
                else
                  PopupMenuButton<String>(
                    tooltip: 'Aksi pengguna',
                    onSelected: (String value) {
                      if (value == 'status') {
                        unawaited(_changeStatus(item, !active));
                      } else if (value == 'delete') {
                        unawaited(_delete(item));
                      }
                    },
                    itemBuilder: (BuildContext context) =>
                        <PopupMenuEntry<String>>[
                      PopupMenuItem<String>(
                        value: 'status',
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(active
                              ? Icons.block_rounded
                              : Icons.check_circle_outline_rounded),
                          title: Text(active ? 'Nonaktifkan' : 'Aktifkan'),
                        ),
                      ),
                      const PopupMenuItem<String>(
                        value: 'delete',
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(Icons.delete_outline_rounded,
                              color: AppColors.danger),
                          title: Text('Hapus pengguna',
                              style: TextStyle(color: AppColors.danger)),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showDetail(String id) async {
    try {
      final JsonMap response = await _repository.user(id);
      if (!mounted) return;
      final JsonMap item = jsonMap(response['data']);
      final JsonMap perkaderanCounts = jsonMap(item['perkaderanCounts']);
      final JsonMap pendidikanCounts = jsonMap(item['pendidikanCounts']);
      final List<JsonMap> perkaderans = jsonMapList(item['perkaderans']);
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (BuildContext sheetContext) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.78,
          maxChildSize: 0.95,
          builder: (BuildContext context, ScrollController controller) =>
              ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: <Widget>[
              Text('Detail pengguna PAC',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              AdminLabelValue(label: 'Nama', value: stringValue(item['name'])),
              AdminLabelValue(
                  label: 'Email', value: stringValue(item['email'])),
              AdminLabelValue(
                  label: 'Role',
                  value: stringValue(item['role']).replaceAll('_', ' ')),
              AdminLabelValue(
                  label: 'Status akun',
                  value: boolValue(item['isActive']) ? 'Aktif' : 'Nonaktif'),
              AdminLabelValue(
                  label: 'Status email',
                  value: boolValue(item['emailVerified'])
                      ? 'Terverifikasi'
                      : 'Belum terverifikasi'),
              AdminLabelValue(
                  label: 'Periode aktif',
                  value: stringValue(item['periodeAktif'])),
              AdminLabelValue(
                  label: 'Dibuat', value: formatAdminDate(item['createdAt'])),
              AdminLabelValue(
                  label: 'Login terakhir',
                  value: formatAdminDate(item['lastLoginAt'])),
              const SizedBox(height: 12),
              AdminSummaryGrid(
                items: <AdminSummaryItem>[
                  AdminSummaryItem('Anggota', intValue(item['totalAnggota']),
                      Icons.groups_2_outlined, AppColors.pac),
                  AdminSummaryItem('Arsip', intValue(item['totalArsip']),
                      Icons.inventory_2_outlined, AppColors.cabang),
                  AdminSummaryItem(
                      'Pengajuan',
                      intValue(item['totalPengajuan']),
                      Icons.outbox_outlined,
                      AppColors.warning),
                  AdminSummaryItem('Aktivitas', intValue(item['totalLog']),
                      Icons.history_rounded, AppColors.muted),
                  AdminSummaryItem(
                      'Berkas',
                      intValue(item['totalBerkasPimpinan']),
                      Icons.folder_copy_outlined,
                      AppColors.warning),
                ],
              ),
              const SizedBox(height: 20),
              Text('Statistik perkaderan',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              _CountWrap(data: perkaderanCounts),
              const SizedBox(height: 20),
              Text('Statistik pendidikan',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              _CountWrap(data: pendidikanCounts),
              if (perkaderans.isNotEmpty) ...<Widget>[
                const SizedBox(height: 20),
                Text('Riwayat perkaderan',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ...perkaderans.map<Widget>(
                  (JsonMap row) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.school_outlined),
                    title: Text(stringValue(row['namaPerkaderan'])),
                    subtitle: Text(
                      '${formatAdminDate(row['tanggal'])} · ${stringValue(row['tempat'], '—')}',
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    } catch (error) {
      if (mounted) showAdminMessage(context, AppException.messageOf(error));
    }
  }

  Future<void> _changeStatus(JsonMap item, bool active) async {
    final String id = stringValue(item['id']);
    final String name = stringValue(item['name'], 'pengguna ini');
    final bool confirmed = await _confirm(
      title: active ? 'Aktifkan pengguna?' : 'Nonaktifkan pengguna?',
      message: active
          ? '$name dapat kembali mengakses Laci Digital.'
          : '$name tidak dapat mengakses Laci Digital sampai diaktifkan kembali.',
      destructive: !active,
    );
    if (!confirmed || !mounted) return;
    setState(() => _mutatingId = id);
    try {
      final String message = await _repository.updateUserStatus(id, active);
      if (!mounted) return;
      showAdminMessage(context, message);
      await _load();
    } catch (error) {
      if (mounted) showAdminMessage(context, AppException.messageOf(error));
    } finally {
      if (mounted) setState(() => _mutatingId = null);
    }
  }

  Future<void> _delete(JsonMap item) async {
    final String id = stringValue(item['id']);
    final bool confirmed = await _confirm(
      title: 'Hapus pengguna?',
      message:
          'Akun ${stringValue(item['name'])} dan data terkait akan dihapus mengikuti aturan backend. Tindakan ini tidak dapat dibatalkan.',
      destructive: true,
    );
    if (!confirmed || !mounted) return;
    setState(() => _mutatingId = id);
    try {
      final String message = await _repository.deleteUser(id);
      if (!mounted) return;
      showAdminMessage(context, message);
      await _load(page: _items.length == 1 && _page > 1 ? _page - 1 : _page);
    } catch (error) {
      if (mounted) showAdminMessage(context, AppException.messageOf(error));
    } finally {
      if (mounted) setState(() => _mutatingId = null);
    }
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required bool destructive,
  }) async =>
      await showDialog<bool>(
        context: context,
        builder: (BuildContext dialogContext) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: <Widget>[
            TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Batal')),
            FilledButton(
              style: destructive
                  ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
                  : null,
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Lanjutkan'),
            ),
          ],
        ),
      ) ??
      false;

  String _initials(String name) {
    final List<String> words = name.trim().split(RegExp(r'\s+'));
    return words
        .where((String value) => value.isNotEmpty)
        .take(2)
        .map((String value) => value[0].toUpperCase())
        .join();
  }
}

class _CountWrap extends StatelessWidget {
  const _CountWrap({required this.data});

  final JsonMap data;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const Text('Belum ada data.');
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: data.entries
          .map<Widget>(
            (MapEntry<String, dynamic> entry) => Chip(
              visualDensity: VisualDensity.compact,
              label: Text('${entry.key} · ${intValue(entry.value)}'),
            ),
          )
          .toList(growable: false),
    );
  }
}

class _MiniStatus extends StatelessWidget {
  const _MiniStatus({required this.label, required this.positive});

  final String label;
  final bool positive;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: (positive ? AppColors.pac : AppColors.muted).withOpacity(0.1),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: positive ? AppColors.pacDark : AppColors.muted,
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
}
