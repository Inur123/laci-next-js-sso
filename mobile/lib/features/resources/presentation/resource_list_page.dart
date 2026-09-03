import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_theme.dart';
import '../../../core/errors/app_exception.dart';
import '../../../shared/widgets/app_layout.dart';
import '../../../shared/widgets/app_select_field.dart';
import '../../auth/domain/app_user.dart';
import '../../periods/application/period_controller.dart';
import '../../periods/presentation/periods_page.dart';
import '../application/resource_controller.dart';
import '../data/resource_spreadsheet_service.dart';
import '../domain/resource_definition.dart';
import '../domain/resource_models.dart';
import 'resource_detail_page.dart';
import 'resource_form_page.dart';
import 'widgets/agenda_calendar_card.dart';
import 'widgets/member_period_copy_dialog.dart';
import 'widgets/resource_widgets.dart';

class ResourceListPage extends ConsumerStatefulWidget {
  const ResourceListPage({
    required this.definition,
    required this.user,
    this.scope = ResourceScope.mine,
    this.title,
    this.initialFilters = const <String, String>{},
    super.key,
  });

  final ResourceDefinition definition;
  final AppUser user;
  final ResourceScope scope;
  final String? title;
  final Map<String, String> initialFilters;

  @override
  ConsumerState<ResourceListPage> createState() => _ResourceListPageState();
}

class _ResourceListPageState extends ConsumerState<ResourceListPage> {
  final TextEditingController _searchController = TextEditingController();
  final Set<String> _selectedIds = <String>{};
  final Map<String, String> _selectedWilayahTypes = <String, String>{};
  Timer? _searchDebounce;
  bool _spreadsheetBusy = false;

  ResourceControllerArgs get _arguments => ResourceControllerArgs(
        resourceKey: widget.definition.key,
        scope: widget.scope,
        initialFilters: widget.initialFilters,
      );

  bool _selectionEnabled(PeriodState periodState) =>
      widget.definition.supportsCopyToActivePeriod &&
      !widget.user.isCabang &&
      periodState.viewPeriod != null;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.definition.canAccess(widget.user)) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.title ?? widget.definition.title)),
        body: const ResourceMessageState(
          icon: Icons.lock_outline_rounded,
          title: 'Akses dibatasi',
          message: 'Menu ini tidak tersedia untuk role akun Anda.',
        ),
      );
    }
    final ResourceState state =
        ref.watch(resourceControllerProvider(_arguments));
    final ResourceController controller =
        ref.read(resourceControllerProvider(_arguments).notifier);
    final PeriodState periodState = ref.watch(periodControllerProvider);
    final Color accent = AppColors.forRole(widget.user.role);
    final int activeFilters = state.query.filters.keys
        .where(
          (String key) =>
              !widget.initialFilters.containsKey(key) &&
              !(widget.definition.key == 'anggota' && key == 'status'),
        )
        .length;
    final bool canFilterPacDirectory =
        widget.user.isCabang || widget.scope == ResourceScope.reference;
    final bool hasVisibleFilters = widget.definition.filters.any(
      (FilterDefinition filter) =>
          !widget.initialFilters.containsKey(filter.queryKey) &&
          !(widget.definition.key == 'anggota' &&
              filter.queryKey == 'status') &&
          (filter.source != ResourceFilterSource.pacDirectory ||
              canFilterPacDirectory),
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _selectedIds.isEmpty
              ? widget.title ?? _scopeTitle()
              : '${_selectedIds.length} dipilih',
        ),
        actions: <Widget>[
          if (_selectedIds.isNotEmpty) ...<Widget>[
            IconButton(
              tooltip: widget.definition.supportsCopyPeriod
                  ? 'Salin ke periode'
                  : 'Salin ke periode aktif',
              onPressed: state.isMutating ? null : _copySelected,
              icon: const Icon(Icons.drive_file_move_outline),
            ),
            IconButton(
              tooltip: 'Batal pilih',
              onPressed: _clearSelection,
              icon: const Icon(Icons.close_rounded),
            ),
          ] else ...<Widget>[
            if (widget.definition.supportsCopyPeriod)
              IconButton(
                tooltip: 'Masukkan anggota ke periode',
                onPressed: state.isMutating
                    ? null
                    : () => _copyMembersFromPeriod(periodState),
                icon: const Icon(Icons.copy_all_outlined),
              ),
            if (widget.definition.spreadsheet != null)
              PopupMenuButton<_SpreadsheetAction>(
                tooltip: 'Aksi Excel',
                enabled: !_spreadsheetBusy && !state.isMutating,
                icon: _spreadsheetBusy
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.table_view_outlined),
                onSelected: (_SpreadsheetAction action) =>
                    _spreadsheetAction(action, state),
                itemBuilder: (BuildContext context) =>
                    <PopupMenuEntry<_SpreadsheetAction>>[
                  if (widget.definition.spreadsheet!.supportsImport)
                    const PopupMenuItem<_SpreadsheetAction>(
                      value: _SpreadsheetAction.import,
                      child: _SpreadsheetMenuRow(
                        icon: Icons.upload_file_outlined,
                        label: 'Import Excel',
                      ),
                    ),
                  const PopupMenuItem<_SpreadsheetAction>(
                    value: _SpreadsheetAction.export,
                    child: _SpreadsheetMenuRow(
                      icon: Icons.download_outlined,
                      label: 'Export Excel',
                    ),
                  ),
                ],
              ),
            IconButton(
              tooltip: 'Muat ulang',
              onPressed:
                  state.phase == ResourceLoadPhase.loading || _spreadsheetBusy
                      ? null
                      : controller.refresh,
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ],
      ),
      body: AppConstrainedContent(
        child: Column(
          children: <Widget>[
            if (widget.definition.key == 'anggota')
              _MemberStatusTabs(
                value: state.query.filters['status'] ?? 'PENDING',
                onChanged: (String status) => controller.setFilter(
                  'status',
                  status,
                ),
              ),
            if (widget.definition.key == 'agenda-kegiatan' &&
                !state.isInitialLoading)
              AgendaCalendarCard(
                activities: state.items,
                repository: ref.read(resourceRepositoryProvider),
              ),
            if (state.stats != null && widget.definition.stats.isNotEmpty)
              if (widget.definition.key == 'anggota' &&
                  state.query.filters['status'] != 'DITERIMA')
                _MemberWorkflowSummary(
                  status: state.query.filters['status'] ?? 'PENDING',
                  count: state.pagination?.total ?? state.items.length,
                  accent: accent,
                )
              else
                _StatsRail(
                  definition: widget.definition,
                  stats: state.stats!,
                  accent: accent,
                ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: widget.definition.searchHint,
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _searchController.text.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Hapus pencarian',
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {});
                                  controller.setSearch('');
                                },
                                icon: const Icon(Icons.close_rounded),
                              ),
                      ),
                      onChanged: (String value) {
                        setState(() {});
                        _searchDebounce?.cancel();
                        _searchDebounce = Timer(
                          const Duration(milliseconds: 450),
                          () => controller.setSearch(value),
                        );
                      },
                      onSubmitted: (String value) {
                        _searchDebounce?.cancel();
                        controller.setSearch(value);
                      },
                    ),
                  ),
                  if (hasVisibleFilters) ...<Widget>[
                    const SizedBox(width: 8),
                    Badge(
                      isLabelVisible: activeFilters > 0,
                      label: Text('$activeFilters'),
                      child: IconButton.outlined(
                        tooltip: 'Filter',
                        onPressed: () => _showFilters(state),
                        icon: const Icon(Icons.tune_rounded),
                      ),
                    ),
                  ],
                  if (widget.definition.sorts.isNotEmpty) ...<Widget>[
                    const SizedBox(width: 8),
                    PopupMenuButton<String>(
                      tooltip: 'Urutkan',
                      icon: const Icon(Icons.sort_rounded),
                      onSelected: (String key) {
                        final bool same = state.query.sortKey == key;
                        controller.setSort(
                          key,
                          ascending: same ? !state.query.sortAscending : true,
                        );
                      },
                      itemBuilder: (BuildContext context) =>
                          widget.definition.sorts
                              .map<PopupMenuEntry<String>>(
                                (SortDefinition sort) => PopupMenuItem<String>(
                                  value: sort.key,
                                  child: Row(
                                    children: <Widget>[
                                      Expanded(child: Text(sort.label)),
                                      if (state.query.sortKey == sort.key)
                                        Icon(
                                          state.query.sortAscending
                                              ? Icons.arrow_upward_rounded
                                              : Icons.arrow_downward_rounded,
                                          size: 18,
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
            if (state.isRefreshing) const LinearProgressIndicator(minHeight: 2),
            Expanded(child: _body(state, controller, accent, periodState)),
          ],
        ),
      ),
      floatingActionButton: periodState.activePeriod != null &&
              widget.definition.canCreate(widget.user, widget.scope)
          ? FloatingActionButton(
              onPressed: state.isMutating ? null : _create,
              tooltip: 'Tambah ${widget.definition.singular}',
              child: const Icon(Icons.add_rounded),
            )
          : null,
    );
  }

  Widget _body(
    ResourceState state,
    ResourceController controller,
    Color accent,
    PeriodState periodState,
  ) {
    if (!periodState.loading && periodState.activePeriod == null) {
      return ResourceMessageState(
        icon: Icons.event_busy_outlined,
        title: 'Periode aktif diperlukan',
        message:
            'Aktifkan satu periode kepengurusan sebelum mengelola ${widget.definition.title.toLowerCase()}.',
        actionLabel: 'Kelola periode',
        actionIcon: Icons.calendar_month_outlined,
        onAction: _openPeriods,
      );
    }
    if (state.isInitialLoading) return const ResourceLoadingList();
    if (state.phase == ResourceLoadPhase.failure && state.items.isEmpty) {
      return ResourceMessageState(
        icon: Icons.cloud_off_outlined,
        title: 'Data tidak dapat dimuat',
        message: state.errorMessage ?? 'Periksa koneksi lalu coba lagi.',
        actionLabel: 'Coba lagi',
        onAction: controller.load,
      );
    }
    if (state.items.isEmpty) {
      final bool filtered = state.query.search.isNotEmpty ||
          state.query.filters.keys.any(
            (String key) =>
                !widget.initialFilters.containsKey(key) &&
                !(widget.definition.key == 'anggota' && key == 'status'),
          );
      return ResourceMessageState(
        icon: filtered ? Icons.search_off_rounded : Icons.inventory_2_outlined,
        title: filtered ? 'Tidak ada hasil' : 'Belum ada data',
        message: filtered
            ? 'Ubah kata pencarian atau bersihkan filter.'
            : widget.definition.emptyMessage,
        actionLabel: filtered ? 'Bersihkan filter' : null,
        onAction: filtered
            ? () {
                _searchController.clear();
                controller.replaceFilters(
                  widget.definition.key == 'anggota'
                      ? <String, String>{
                          'status': state.query.filters['status'] ?? 'PENDING',
                        }
                      : const <String, String>{},
                );
                controller.setSearch('');
              }
            : null,
      );
    }
    return RefreshIndicator(
      onRefresh: controller.refresh,
      child: ListView.separated(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(16, 2, 16, 108),
        itemCount: state.items.length + 1,
        separatorBuilder: (BuildContext context, int index) =>
            const SizedBox(height: 10),
        itemBuilder: (BuildContext context, int index) {
          if (index == state.items.length) {
            return _PaginationBar(
              pagination: state.pagination,
              loading: state.phase == ResourceLoadPhase.loading,
              onPage: controller.goToPage,
            );
          }
          final ResourceItem item = state.items[index];
          return ResourceCard(
            definition: widget.definition,
            item: item,
            accent: _itemAccent(item, accent),
            selectable: _selectionEnabled(periodState),
            selected: _selectedIds.contains(item.id),
            leading: widget.definition.key == 'anggota'
                ? _MemberPhotoAvatar(item: item)
                : null,
            onSelected: (bool selected) => setState(() {
              if (selected) {
                _selectedIds.add(item.id);
                _selectedWilayahTypes[item.id] = item.text('jenis', '');
              } else {
                _selectedIds.remove(item.id);
                _selectedWilayahTypes.remove(item.id);
              }
            }),
            onTap: () => _openDetail(item),
            menu: PopupMenuButton<_ItemMenuAction>(
              tooltip: 'Aksi',
              onSelected: (_ItemMenuAction action) => _itemAction(action, item),
              itemBuilder: (BuildContext context) =>
                  <PopupMenuEntry<_ItemMenuAction>>[
                const PopupMenuItem<_ItemMenuAction>(
                  value: _ItemMenuAction.detail,
                  child: Text('Lihat detail'),
                ),
                if (widget.definition
                    .canEdit(widget.user, widget.scope, item.data))
                  const PopupMenuItem<_ItemMenuAction>(
                    value: _ItemMenuAction.edit,
                    child: Text('Edit'),
                  ),
                if (widget.definition
                    .canDelete(widget.user, widget.scope, item.data))
                  const PopupMenuItem<_ItemMenuAction>(
                    value: _ItemMenuAction.delete,
                    child: Text('Hapus'),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _scopeTitle() => switch (widget.scope) {
        ResourceScope.mine => widget.definition.title,
        ResourceScope.review => 'Verifikasi ${widget.definition.title}',
        ResourceScope.reference => 'Referensi ${widget.definition.title}',
      };

  Color _itemAccent(ResourceItem item, Color fallback) {
    final String agendaColor = item.text('warna', '');
    if (agendaColor.startsWith('#')) {
      final int? color = int.tryParse(
        'FF${agendaColor.substring(1)}',
        radix: 16,
      );
      if (color != null) return Color(color);
    }
    return resourceStatusColor(item['status'] ?? item['isActive'], fallback);
  }

  Future<void> _create() async {
    final PeriodState periodState = ref.read(periodControllerProvider);
    final Object? message = await Navigator.of(context).push<Object>(
      MaterialPageRoute<Object>(
        builder: (BuildContext context) => ResourceFormPage(
          definition: widget.definition,
          user: widget.user,
          controllerArgs: _arguments,
          activePeriod: periodState.activePeriod,
          viewPeriod: periodState.viewPeriod,
        ),
      ),
    );
    if (message != null && mounted) _showSuccess(message.toString());
  }

  Future<void> _openDetail(ResourceItem item) async {
    final PeriodState periodState = ref.read(periodControllerProvider);
    final Object? message = await Navigator.of(context).push<Object>(
      MaterialPageRoute<Object>(
        builder: (BuildContext context) => ResourceDetailPage(
          definition: widget.definition,
          user: widget.user,
          itemId: item.id,
          controllerArgs: _arguments,
          scope: widget.scope,
          activePeriod: periodState.activePeriod,
          viewPeriod: periodState.viewPeriod,
        ),
      ),
    );
    if (message != null && mounted) {
      _showSuccess(message.toString());
      ref.read(resourceControllerProvider(_arguments).notifier).refresh();
    }
  }

  Future<void> _itemAction(_ItemMenuAction action, ResourceItem item) async {
    switch (action) {
      case _ItemMenuAction.detail:
        await _openDetail(item);
      case _ItemMenuAction.edit:
        final PeriodState periodState = ref.read(periodControllerProvider);
        final Object? message = await Navigator.of(context).push<Object>(
          MaterialPageRoute<Object>(
            builder: (BuildContext context) => ResourceFormPage(
              definition: widget.definition,
              user: widget.user,
              controllerArgs: _arguments,
              item: item,
              activePeriod: periodState.activePeriod,
              viewPeriod: periodState.viewPeriod,
            ),
          ),
        );
        if (message != null && mounted) _showSuccess(message.toString());
      case _ItemMenuAction.delete:
        await _delete(item);
    }
  }

  Future<void> _delete(ResourceItem item) async {
    final bool confirmed = await showDialog<bool>(
          context: context,
          builder: (BuildContext context) => AlertDialog(
            title: Text('Hapus ${widget.definition.singular}?'),
            content: const Text(
              'Data dan file terkait akan dihapus permanen dari server.',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Batal'),
              ),
              FilledButton(
                style:
                    FilledButton.styleFrom(backgroundColor: AppColors.danger),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Hapus'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    try {
      final String message = await ref
          .read(resourceControllerProvider(_arguments).notifier)
          .delete(item.id);
      if (mounted) _showSuccess(message);
    } on AppException catch (error) {
      _showError(error.message);
    } on Object {
      _showError('Data tidak dapat dihapus. Coba lagi.');
    }
  }

  Future<void> _spreadsheetAction(
    _SpreadsheetAction action,
    ResourceState state,
  ) async {
    if (_spreadsheetBusy) return;
    setState(() => _spreadsheetBusy = true);
    try {
      switch (action) {
        case _SpreadsheetAction.import:
          await _importSpreadsheet();
        case _SpreadsheetAction.export:
          await _exportSpreadsheet(state);
      }
    } on AppException catch (error) {
      if (mounted) _showError(error.message);
    } on Object {
      if (mounted) {
        _showError('Proses Excel gagal. Periksa file lalu coba lagi.');
      }
    } finally {
      if (mounted) setState(() => _spreadsheetBusy = false);
    }
  }

  Future<void> _importSpreadsheet() async {
    final FilePickerResult? picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ResourceSpreadsheetService.supportedImportExtensions,
      allowMultiple: false,
      withData: true,
    );
    if (picked == null || picked.files.isEmpty) return;
    final PlatformFile file = picked.files.single;
    final Uint8List bytes;
    if (file.bytes != null) {
      bytes = file.bytes!;
    } else if (file.path != null) {
      bytes = await File(file.path!).readAsBytes();
    } else {
      throw const AppException(
        code: 'FILE_READ_FAILED',
        message: 'File Excel tidak dapat dibaca.',
      );
    }
    final ResourceSpreadsheetService service =
        ref.read(resourceSpreadsheetServiceProvider);
    final List<Map<String, dynamic>> rows =
        service.parseImport(widget.definition, bytes);
    if (!mounted) return;
    final bool confirmed =
        await _confirmSpreadsheetImport(file.name, rows.length);
    if (!confirmed || !mounted) return;
    final SpreadsheetImportResult result = await ref
        .read(resourceRepositoryProvider)
        .importSpreadsheet(widget.definition, rows, file.name);
    await ref.read(resourceControllerProvider(_arguments).notifier).refresh();
    if (!mounted) return;
    await _showSpreadsheetImportResult(result);
  }

  Future<void> _exportSpreadsheet(ResourceState state) async {
    final List<ResourceItem> items = await ref
        .read(resourceRepositoryProvider)
        .listForExport(widget.definition, state.query);
    final String? qualifier = await _spreadsheetQualifier(state);
    final ResourceSpreadsheetDocument document =
        ref.read(resourceSpreadsheetServiceProvider).buildExport(
              widget.definition,
              items,
              widget.user,
              qualifier: qualifier,
            );
    final DownloadedResourceFile file =
        await ref.read(resourceSpreadsheetFileActionsProvider).save(document);
    unawaited(_logSpreadsheetExportBestEffort(document.name));
    if (!mounted) return;
    _showSuccess('${items.length} data berhasil diexport.');
    await _showSavedSpreadsheet(file, 'Export ${widget.definition.title}');
  }

  Future<void> _logSpreadsheetExportBestEffort(String fileName) async {
    try {
      await ref
          .read(resourceRepositoryProvider)
          .logSpreadsheetExport(widget.definition, fileName);
    } on Object catch (error, stackTrace) {
      debugPrint('Pencatatan audit export gagal: $error\n$stackTrace');
    }
  }

  Future<String?> _spreadsheetQualifier(ResourceState state) async {
    if (widget.definition.spreadsheet?.qualifyWithPacFilter != true) {
      return null;
    }
    final String userId = state.query.filters['userId'] ?? '';
    if (userId.isEmpty || userId == 'ALL') return 'All';
    final List<ResourceDirectoryUser> users =
        await ref.read(resourceRepositoryProvider).pacDirectory();
    for (final ResourceDirectoryUser user in users) {
      if (user.id == userId) return user.name;
    }
    return 'PAC';
  }

  Future<bool> _confirmSpreadsheetImport(String fileName, int rows) async =>
      await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: const Text('Import data Excel?'),
          content: Text(
            '$rows baris dari “$fileName” akan ditambahkan ke periode aktif. '
            'Baris yang tidak valid akan dilewati oleh server.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            FilledButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: const Icon(Icons.upload_file_outlined),
              label: const Text('Import'),
            ),
          ],
        ),
      ) ??
      false;

  Future<void> _showSpreadsheetImportResult(
    SpreadsheetImportResult result,
  ) =>
      showDialog<void>(
        context: context,
        builder: (BuildContext context) {
          final List<String> visibleErrors =
              result.errors.take(20).toList(growable: false);
          return AlertDialog(
            title:
                Text(result.failed == 0 ? 'Import berhasil' : 'Import selesai'),
            content: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 420),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      '${result.success} berhasil · ${result.failed} gagal',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(result.message),
                    if (visibleErrors.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 16),
                      Text(
                        'Detail baris gagal',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 6),
                      ...visibleErrors.map<Widget>(
                        (String error) => Padding(
                          padding: const EdgeInsets.only(bottom: 5),
                          child: Text('• $error'),
                        ),
                      ),
                      if (result.errors.length > visibleErrors.length)
                        Text(
                          '…dan ${result.errors.length - visibleErrors.length} kegagalan lainnya.',
                        ),
                    ],
                  ],
                ),
              ),
            ),
            actions: <Widget>[
              FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Selesai'),
              ),
            ],
          );
        },
      );

  Future<void> _showSavedSpreadsheet(
    DownloadedResourceFile file,
    String subject,
  ) async {
    final _SavedSpreadsheetAction? action =
        await showModalBottomSheet<_SavedSpreadsheetAction>(
      context: context,
      useSafeArea: true,
      builder: (BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const Icon(Icons.task_alt_rounded, size: 42, color: AppColors.pac),
            const SizedBox(height: 10),
            Text(
              'File berhasil disimpan',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 5),
            Text(
              file.name,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: () => Navigator.pop(
                context,
                _SavedSpreadsheetAction.open,
              ),
              icon: const Icon(Icons.open_in_new_rounded),
              label: const Text('Buka file'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => Navigator.pop(
                context,
                _SavedSpreadsheetAction.share,
              ),
              icon: const Icon(Icons.share_outlined),
              label: const Text('Bagikan'),
            ),
          ],
        ),
      ),
    );
    if (action == null) return;
    final ResourceSpreadsheetFileActions fileActions =
        ref.read(resourceSpreadsheetFileActionsProvider);
    switch (action) {
      case _SavedSpreadsheetAction.open:
        await fileActions.open(file);
      case _SavedSpreadsheetAction.share:
        await fileActions.share(file, subject: subject);
    }
  }

  Future<void> _showFilters(ResourceState state) async {
    final Map<String, String>? result =
        await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (BuildContext context) => ResourceFilterSheet(
        definition: widget.definition,
        current: state.query.filters,
        lockedKeys: <String>{
          ...widget.initialFilters.keys,
          if (widget.definition.key == 'anggota') 'status',
        },
        showPacDirectory:
            widget.user.isCabang || widget.scope == ResourceScope.reference,
      ),
    );
    if (result != null && mounted) {
      final Map<String, String> filters = <String, String>{...result};
      if (widget.definition.key == 'anggota') {
        filters['status'] = state.query.filters['status'] ?? 'PENDING';
      }
      ref
          .read(resourceControllerProvider(_arguments).notifier)
          .replaceFilters(filters);
    }
  }

  Future<void> _copySelected() async {
    if (_selectedIds.isEmpty) return;
    try {
      final ResourceController controller =
          ref.read(resourceControllerProvider(_arguments).notifier);
      final bool confirmed = await _confirmCopyWilayah(_selectedIds.length);
      if (!confirmed || !mounted) return;
      final Map<String, List<String>> byType = <String, List<String>>{};
      for (final String id in _selectedIds) {
        final String? type = _selectedWilayahTypes[id];
        if (type == null || type.isEmpty) continue;
        byType.putIfAbsent(type, () => <String>[]).add(id);
      }
      if (byType.isEmpty) {
        _showError('Jenis wilayah yang dipilih tidak valid. Pilih ulang data.');
        return;
      }
      final List<String> messages = <String>[];
      for (final MapEntry<String, List<String>> entry in byType.entries) {
        messages.add(
          await controller.copyWilayah(ids: entry.value, type: entry.key),
        );
      }
      if (!mounted) return;
      _clearSelection();
      _showSuccess(messages.join(' '));
    } on AppException catch (error) {
      _showError(error.message);
    } on Object {
      _showError('Data tidak dapat disalin. Coba lagi.');
    }
  }

  Future<void> _copyMembersFromPeriod(PeriodState periodState) async {
    List<ResourcePeriodRef> periods;
    try {
      periods = await ref.read(resourceRepositoryProvider).periods();
    } on Object {
      _showError('Daftar periode tidak dapat dimuat.');
      return;
    }
    if (!mounted || periods.length < 2) {
      if (mounted) {
        _showError('Minimal dua periode diperlukan untuk menyalin data.');
      }
      return;
    }
    final String? result = await showDialog<String>(
      context: context,
      builder: (BuildContext context) => MemberPeriodCopyDialog(
        periods: periods,
        currentPeriodId:
            periodState.viewPeriodId ?? periodState.activePeriod?.id,
        repository: ref.read(resourceRepositoryProvider),
        onCopy: ({
          required List<String> ids,
          required String sourcePeriodId,
          required String targetPeriodId,
        }) =>
            ref
                .read(resourceControllerProvider(_arguments).notifier)
                .copyMembers(
                  ids: ids,
                  sourcePeriodId: sourcePeriodId,
                  targetPeriodId: targetPeriodId,
                ),
      ),
    );
    if (result != null && mounted) _showSuccess(result);
  }

  Future<void> _openPeriods() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
          builder: (BuildContext context) => const PeriodsPage()),
    );
    if (!mounted) return;
    await ref.read(periodControllerProvider.notifier).load();
    if (!mounted) return;
    ref.invalidate(resourceControllerProvider(_arguments));
  }

  Future<bool> _confirmCopyWilayah(int count) async =>
      await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: const Text('Salin wilayah?'),
          content: Text(
            '$count wilayah akan disalin dari periode yang sedang dilihat ke periode aktif.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Salin'),
            ),
          ],
        ),
      ) ??
      false;

  void _clearSelection() {
    if (!mounted) return;
    setState(() {
      _selectedIds.clear();
      _selectedWilayahTypes.clear();
    });
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.pac),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.danger),
    );
  }
}

enum _ItemMenuAction { detail, edit, delete }

enum _SpreadsheetAction { import, export }

enum _SavedSpreadsheetAction { open, share }

class _SpreadsheetMenuRow extends StatelessWidget {
  const _SpreadsheetMenuRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        children: <Widget>[
          Icon(icon, size: 19),
          const SizedBox(width: 10),
          Text(label),
        ],
      );
}

class _MemberPhotoAvatar extends ConsumerStatefulWidget {
  const _MemberPhotoAvatar({required this.item});

  final ResourceItem item;

  @override
  ConsumerState<_MemberPhotoAvatar> createState() => _MemberPhotoAvatarState();
}

class _MemberPhotoAvatarState extends ConsumerState<_MemberPhotoAvatar> {
  Future<Uint8List>? _image;

  @override
  void initState() {
    super.initState();
    if (widget.item.text('foto', '').isNotEmpty) {
      _image = ref.read(resourceRepositoryProvider).memberImage(widget.item.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final String name = widget.item.text('namaLengkap', '?');
    final String fallback = name.isEmpty ? '?' : name[0].toUpperCase();
    final Future<Uint8List>? image = _image;
    if (image == null) return CircleAvatar(child: Text(fallback));
    return FutureBuilder<Uint8List>(
      future: image,
      builder: (BuildContext context, AsyncSnapshot<Uint8List> snapshot) =>
          CircleAvatar(
        backgroundImage: snapshot.hasData ? MemoryImage(snapshot.data!) : null,
        child: snapshot.hasData ? null : Text(fallback),
      ),
    );
  }
}

class _MemberWorkflowSummary extends StatelessWidget {
  const _MemberWorkflowSummary({
    required this.status,
    required this.count,
    required this.accent,
  });

  final String status;
  final int count;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final (String label, IconData icon) = switch (status) {
      'DITOLAK' => ('Anggota ditolak', Icons.cancel_outlined),
      _ => ('Menunggu verifikasi', Icons.hourglass_top_rounded),
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: accent.withOpacity(.07),
          border: Border.all(color: accent.withOpacity(.18)),
          borderRadius: BorderRadius.circular(17),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: accent,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: Colors.white, size: 21),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(label, style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 2),
                  Text(
                    '$count data pada tab ini',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Text(
              '$count',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w900,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatsRail extends StatelessWidget {
  const _StatsRail({
    required this.definition,
    required this.stats,
    required this.accent,
  });

  final ResourceDefinition definition;
  final ResourceStats stats;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    if (definition.stats.length <= 4) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
        child: AppAdaptiveGrid(
          minItemWidth: 78,
          maxColumns: 4,
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            for (final StatDefinition stat in definition.stats)
              SizedBox(
                height: 68,
                child: _StatCard(
                  stat: stat,
                  value: stats.count(stat.key),
                  accent: accent,
                ),
              ),
          ],
        ),
      );
    }
    return SizedBox(
      height: 82,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
        itemCount: definition.stats.length,
        separatorBuilder: (BuildContext context, int index) =>
            const SizedBox(width: 8),
        itemBuilder: (BuildContext context, int index) {
          final StatDefinition stat = definition.stats[index];
          return SizedBox(
            width: 104,
            child: _StatCard(
              stat: stat,
              value: stats.count(stat.key),
              accent: accent,
            ),
          );
        },
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.stat,
    required this.value,
    required this.accent,
  });

  final StatDefinition stat;
  final int value;
  final Color accent;

  @override
  Widget build(BuildContext context) => Container(
        key: ValueKey<String>('resource-stat-${stat.key}'),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              '$value',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            Text(
              stat.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      );
}

class _PaginationBar extends StatelessWidget {
  const _PaginationBar({
    required this.pagination,
    required this.loading,
    required this.onPage,
  });

  final ResourcePagination? pagination;
  final bool loading;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    final ResourcePagination? value = pagination;
    if (value == null) return const SizedBox.shrink();
    return AppPagination(
      page: value.page,
      totalPages: value.totalPages,
      loading: loading,
      onPage: onPage,
    );
  }
}

class _MemberStatusTabs extends StatelessWidget {
  const _MemberStatusTabs({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
        child: SegmentedButton<String>(
          segments: const <ButtonSegment<String>>[
            ButtonSegment<String>(
              value: 'PENDING',
              label: Text('Menunggu'),
              icon: Icon(Icons.schedule_rounded),
            ),
            ButtonSegment<String>(
              value: 'DITERIMA',
              label: Text('Diterima'),
              icon: Icon(Icons.check_circle_outline_rounded),
            ),
            ButtonSegment<String>(
              value: 'DITOLAK',
              label: Text('Ditolak'),
              icon: Icon(Icons.cancel_outlined),
            ),
          ],
          selected: <String>{
            const <String>{'PENDING', 'DITERIMA', 'DITOLAK'}.contains(value)
                ? value
                : 'PENDING',
          },
          onSelectionChanged: (Set<String> selection) {
            if (selection.isNotEmpty) onChanged(selection.first);
          },
        ),
      );
}

class ResourceFilterSheet extends ConsumerStatefulWidget {
  const ResourceFilterSheet({
    required this.definition,
    required this.current,
    required this.showPacDirectory,
    this.lockedKeys = const <String>{},
    super.key,
  });

  final ResourceDefinition definition;
  final Map<String, String> current;
  final bool showPacDirectory;
  final Set<String> lockedKeys;

  @override
  ConsumerState<ResourceFilterSheet> createState() =>
      _ResourceFilterSheetState();
}

class _ResourceFilterSheetState extends ConsumerState<ResourceFilterSheet> {
  late final Map<String, String> _values =
      Map<String, String>.from(widget.current);

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<ResourceDirectoryUser>> directory =
        ref.watch(resourcePacDirectoryProvider);
    final List<FilterDefinition> filters = widget.definition.filters
        .where(
          (FilterDefinition filter) =>
              !widget.lockedKeys.contains(filter.queryKey) &&
              (filter.source != ResourceFilterSource.pacDirectory ||
                  widget.showPacDirectory),
        )
        .toList(growable: false);
    final double initialSize =
        ((156 + filters.length * 74) / MediaQuery.sizeOf(context).height)
            .clamp(.38, .82);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: initialSize,
      minChildSize: .35,
      maxChildSize: .92,
      builder: (BuildContext context, ScrollController scrollController) =>
          Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          16 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text('Filter data', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Expanded(
              child: ListView(
                controller: scrollController,
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: filters.map<Widget>((FilterDefinition filter) {
                  final List<ResourceOption> options =
                      filter.source == ResourceFilterSource.pacDirectory
                          ? directory.maybeWhen(
                              data: (List<ResourceDirectoryUser> users) => users
                                  .map<ResourceOption>(
                                    (ResourceDirectoryUser user) =>
                                        ResourceOption(user.id, user.name),
                                  )
                                  .toList(growable: false),
                              orElse: () => const <ResourceOption>[],
                            )
                          : filter.options;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: AppSelectField<String>(
                      value: _values[filter.queryKey] ?? 'ALL',
                      label: filter.label,
                      options: <AppSelectOption<String>>[
                        const AppSelectOption<String>(
                          value: 'ALL',
                          label: 'Semua',
                        ),
                        ...options.map<AppSelectOption<String>>(
                          (ResourceOption option) => AppSelectOption<String>(
                            value: option.value,
                            label: option.label,
                          ),
                        ),
                      ],
                      onChanged: (String? value) => setState(
                        () => _values[filter.queryKey] = value ?? 'ALL',
                      ),
                    ),
                  );
                }).toList(growable: false),
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, <String, String>{}),
                    child: const Text('Bersihkan'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context, _values),
                    child: const Text('Terapkan'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
