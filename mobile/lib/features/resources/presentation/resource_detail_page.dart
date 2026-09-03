import 'dart:async';
import 'dart:typed_data';

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
import '../../periods/domain/app_period.dart';
import '../../realtime/application/realtime_controller.dart';
import '../application/presensi_participants_controller.dart';
import '../application/resource_controller.dart';
import '../domain/resource_definition.dart';
import '../domain/resource_models.dart';
import 'resource_form_page.dart';
import 'widgets/presensi_qr_card.dart';
import 'widgets/resource_widgets.dart';

class ResourceDetailPage extends ConsumerStatefulWidget {
  const ResourceDetailPage({
    required this.definition,
    required this.user,
    required this.itemId,
    required this.controllerArgs,
    this.scope = ResourceScope.mine,
    this.activePeriod,
    this.viewPeriod,
    super.key,
  });

  final ResourceDefinition definition;
  final AppUser user;
  final String itemId;
  final ResourceControllerArgs controllerArgs;
  final ResourceScope scope;
  final AppPeriod? activePeriod;
  final AppPeriod? viewPeriod;

  @override
  ConsumerState<ResourceDetailPage> createState() => _ResourceDetailPageState();
}

class _ResourceDetailPageState extends ConsumerState<ResourceDetailPage> {
  late Future<ResourceItem> _detail;
  ProviderSubscription<RealtimeState>? _realtimeSubscription;
  bool _acting = false;

  @override
  void initState() {
    super.initState();
    _reload();
    _realtimeSubscription = ref.listenManual<RealtimeState>(
      realtimeControllerProvider,
      (RealtimeState? previous, RealtimeState next) {
        if (previous == null ||
            next.revision <= previous.revision ||
            !mounted) {
          return;
        }
        setState(_reload);
      },
    );
  }

  @override
  void dispose() {
    _realtimeSubscription?.close();
    super.dispose();
  }

  void _reload() {
    _detail = ref.read(resourceRepositoryProvider).detail(
          widget.definition,
          widget.itemId,
          scope: widget.scope,
        );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text('Detail ${widget.definition.singular}'),
          actions: <Widget>[
            FutureBuilder<ResourceItem>(
              future: _detail,
              builder: (
                BuildContext context,
                AsyncSnapshot<ResourceItem> snapshot,
              ) {
                if (!snapshot.hasData) return const SizedBox.shrink();
                final ResourceItem item = snapshot.data!;
                final List<_DetailMenuAction> actions =
                    _detailMenuActions(item);
                if (actions.isEmpty) return const SizedBox.shrink();
                return PopupMenuButton<String>(
                  key: const ValueKey<String>('resource-detail-menu'),
                  enabled: !_acting,
                  tooltip: 'Aksi data',
                  icon: const Icon(Icons.more_vert_rounded),
                  onSelected: (String value) =>
                      unawaited(_handleDetailMenu(value, item)),
                  itemBuilder: (BuildContext context) => actions
                      .map<PopupMenuEntry<String>>(
                        (_DetailMenuAction action) => PopupMenuItem<String>(
                          value: action.value,
                          child: Row(
                            children: <Widget>[
                              Icon(action.icon, color: action.color, size: 21),
                              const SizedBox(width: 12),
                              Text(
                                action.label,
                                style: TextStyle(
                                  color: action.color,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                      .toList(growable: false),
                );
              },
            ),
          ],
        ),
        body: AppConstrainedContent(
          maxWidth: 820,
          child: FutureBuilder<ResourceItem>(
            future: _detail,
            builder: (
              BuildContext context,
              AsyncSnapshot<ResourceItem> snapshot,
            ) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const AppLoadingDetail();
              }
              if (snapshot.hasError || !snapshot.hasData) {
                return ResourceMessageState(
                  icon: Icons.cloud_off_outlined,
                  title: 'Detail tidak dapat dibuka',
                  message: _errorMessage(snapshot.error),
                  actionLabel: 'Coba lagi',
                  onAction: () => setState(_reload),
                );
              }
              return _content(snapshot.data!);
            },
          ),
        ),
      );

  Widget _content(ResourceItem item) {
    final Color accent = AppColors.forRole(widget.user.role);
    final List<FieldDefinition> visibleDetailFields =
        widget.definition.detailFields
            .where(
              (FieldDefinition field) =>
                  field.key != widget.definition.primaryField &&
                  field.kind != ResourceFieldKind.file &&
                  !const <String>{
                    'periode',
                    'periodePac',
                    'periodeCabang',
                  }.contains(field.key) &&
                  _hasDetailValue(item[field.key]),
            )
            .toList(growable: false);
    final bool canDownload =
        widget.definition.canDownload(widget.user, widget.scope, item.data);

    return Stack(
      children: <Widget>[
        Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: <Widget>[
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: <Color>[
                          accent.withOpacity(.13),
                          AppColors.brightForRole(widget.user.role)
                              .withOpacity(.07),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: accent.withOpacity(.2)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        if (widget.definition.key == 'anggota')
                          _MemberDetailAvatar(item: item, accent: accent)
                        else
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: accent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.inventory_2_outlined,
                              color: Colors.white,
                            ),
                          ),
                        const SizedBox(width: 13),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                widget.definition.singular.toUpperCase(),
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                    ?.copyWith(
                                      color: accent,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1.1,
                                    ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                item.text(widget.definition.primaryField),
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (visibleDetailFields.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        child: Column(
                          children: _detailRows(visibleDetailFields, item),
                        ),
                      ),
                    ),
                  ],
                  if (widget.definition.supportsParticipants) ...<Widget>[
                    const SizedBox(height: 16),
                    PresensiQrCard(
                      uri: ref
                          .read(appConfigProvider)
                          .publicAttendanceUri(item.id),
                      activityName: item.text(widget.definition.primaryField),
                    ),
                    const SizedBox(height: 16),
                    _ParticipantsCard(presensi: item, user: widget.user),
                  ],
                  if (canDownload) ...<Widget>[
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text('File lampiran',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 6),
                            Text(
                              'File diambil dengan token sementara dan hanya disimpan di folder sementara perangkat.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 14),
                            Row(
                              children: <Widget>[
                                Expanded(
                                  child: _FileActionTile(
                                    label: 'Unduh',
                                    icon: Icons.download_rounded,
                                    onTap: _acting
                                        ? null
                                        : () => _downloadFile(item),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _FileActionTile(
                                    label: 'Buka',
                                    icon: Icons.open_in_new_rounded,
                                    onTap:
                                        _acting ? null : () => _openFile(item),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _FileActionTile(
                                    label: 'Bagikan',
                                    icon: Icons.ios_share_rounded,
                                    onTap:
                                        _acting ? null : () => _shareFile(item),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        if (_acting)
          const Positioned.fill(
            child: ColoredBox(
              color: Color(0x22000000),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
      ],
    );
  }

  List<_DetailMenuAction> _detailMenuActions(ResourceItem item) {
    final bool pending = item['status'] == 'PENDING';
    final bool canEdit =
        widget.definition.canEdit(widget.user, widget.scope, item.data);
    final bool canDelete =
        widget.definition.canDelete(widget.user, widget.scope, item.data);
    final bool canReview =
        widget.definition.canReviewStatus(widget.user, widget.scope) && pending;
    final bool canVerify =
        widget.definition.canVerifyMember(widget.user) && pending;
    return <_DetailMenuAction>[
      if (canEdit) const _DetailMenuAction('edit', 'Edit', Icons.edit_outlined),
      if (widget.definition.key == 'presensi' && canEdit)
        _DetailMenuAction(
          'toggle-presensi',
          item['isActive'] == true
              ? 'Tutup sesi presensi'
              : 'Aktifkan mode otomatis',
          item['isActive'] == true
              ? Icons.lock_outline_rounded
              : Icons.lock_open_rounded,
        ),
      if (canReview || canVerify)
        const _DetailMenuAction(
          'accept',
          'Terima',
          Icons.check_circle_outline_rounded,
          AppColors.pac,
        ),
      if (canReview || canVerify)
        const _DetailMenuAction(
          'reject',
          'Tolak',
          Icons.cancel_outlined,
          AppColors.danger,
        ),
      if (canDelete)
        const _DetailMenuAction(
          'delete',
          'Hapus',
          Icons.delete_outline_rounded,
          AppColors.danger,
        ),
    ];
  }

  Future<void> _handleDetailMenu(String value, ResourceItem item) {
    switch (value) {
      case 'edit':
        return _edit(item);
      case 'delete':
        return _delete(item);
      case 'accept':
        return _changeStatus(item, 'DITERIMA');
      case 'reject':
        return _changeStatus(item, 'DITOLAK');
      case 'toggle-presensi':
        return _togglePresensi(item);
    }
    return Future<void>.value();
  }

  List<Widget> _detailRows(
    List<FieldDefinition> fields,
    ResourceItem item,
  ) {
    final List<Widget> rows = <Widget>[];
    for (int index = 0; index < fields.length; index++) {
      final FieldDefinition field = fields[index];
      rows.add(_DetailRow(field: field, value: item[field.key]));
      if (index < fields.length - 1) {
        rows.add(const Divider());
      }
    }
    return rows;
  }

  bool _hasDetailValue(Object? value) {
    if (value == null) return false;
    if (value is String) return value.trim().isNotEmpty;
    if (value is Iterable<Object?>) return value.isNotEmpty;
    if (value is Map<Object?, Object?>) return value.isNotEmpty;
    return true;
  }

  Future<void> _edit(ResourceItem item) async {
    final Object? result = await Navigator.of(context).push<Object>(
      MaterialPageRoute<Object>(
        builder: (BuildContext context) => ResourceFormPage(
          definition: widget.definition,
          user: widget.user,
          controllerArgs: widget.controllerArgs,
          item: item,
          activePeriod: widget.activePeriod,
          viewPeriod: widget.viewPeriod,
        ),
      ),
    );
    if (!mounted || result == null) return;
    _showSuccess(result.toString());
    setState(_reload);
  }

  Future<void> _delete(ResourceItem item) async {
    final bool confirmed = await _confirm(
      title: 'Hapus ${widget.definition.singular}?',
      message: 'Data dan file terkait akan dihapus permanen dari server.',
      confirmationLabel: 'Hapus',
      dangerous: true,
    );
    if (!confirmed || !mounted) return;
    await _perform(() async {
      final String message = await ref
          .read(resourceControllerProvider(widget.controllerArgs).notifier)
          .delete(item.id);
      if (!mounted) return;
      Navigator.pop(context, message);
    });
  }

  Future<void> _changeStatus(ResourceItem item, String status) async {
    String reason = '';
    if (status == 'DITOLAK') {
      final String? value = await _reasonDialog();
      if (value == null || !mounted) return;
      reason = value;
    } else {
      final bool confirmed = await _confirm(
        title: 'Terima data ini?',
        message:
            'Status akan berubah menjadi diterima dan tidak dapat diproses ulang.',
        confirmationLabel: 'Terima',
      );
      if (!confirmed || !mounted) return;
    }
    await _perform(() async {
      final ResourceController controller =
          ref.read(resourceControllerProvider(widget.controllerArgs).notifier);
      final String message = widget.definition.supportsMemberVerification
          ? await controller.verifyMember(item.id, status, reason: reason)
          : await controller.reviewApplication(item.id, status, reason: reason);
      if (!mounted) return;
      _showSuccess(message);
      setState(_reload);
    });
  }

  Future<void> _togglePresensi(ResourceItem item) async {
    final bool currentlyActive = item['isActive'] == true;
    final bool confirmed = await _confirm(
      title: currentlyActive
          ? 'Tutup sesi presensi?'
          : 'Kembali ke mode otomatis?',
      message: currentlyActive
          ? 'Peserta tidak dapat mengisi presensi setelah sesi ditutup.'
          : 'Sesi akan mengikuti tanggal dan jam yang telah ditentukan.',
      confirmationLabel: currentlyActive ? 'Tutup sesi' : 'Aktifkan otomatis',
    );
    if (!confirmed || !mounted) return;
    await _perform(() async {
      final JsonMap values = currentlyActive
          ? <String, dynamic>{'isActive': false}
          : <String, dynamic>{
              'isActive': true,
              'isForcedOpen': false,
              'forcedOpenAt': null,
            };
      await ref
          .read(resourceControllerProvider(widget.controllerArgs).notifier)
          .update(item.id, ResourceDraft(values: values));
      if (!mounted) return;
      _showSuccess('Status presensi berhasil diperbarui.');
      setState(_reload);
    });
  }

  Future<void> _openFile(ResourceItem item) => _perform(() async {
        await ref
            .read(resourceFileActionsProvider)
            .open(widget.definition, item, scope: widget.scope);
      });

  Future<void> _downloadFile(ResourceItem item) => _perform(() async {
        final String? path = await ref
            .read(resourceFileActionsProvider)
            .saveToUserSelectedLocation(
              widget.definition,
              item,
              scope: widget.scope,
            );
        if (mounted && path != null) {
          _showSuccess('File berhasil disimpan ke lokasi yang dipilih.');
        }
      });

  Future<void> _shareFile(ResourceItem item) => _perform(() async {
        await ref
            .read(resourceFileActionsProvider)
            .share(widget.definition, item, scope: widget.scope);
      });

  Future<void> _perform(Future<void> Function() action) async {
    if (_acting) return;
    setState(() => _acting = true);
    try {
      await action();
    } on AppException catch (error) {
      _showError(error.message);
    } on Object {
      _showError('Aksi tidak dapat diselesaikan. Coba lagi.');
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required String confirmationLabel,
    bool dangerous = false,
  }) async =>
      await showDialog<bool>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            FilledButton(
              style: dangerous
                  ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
                  : null,
              onPressed: () => Navigator.pop(context, true),
              child: Text(confirmationLabel),
            ),
          ],
        ),
      ) ??
      false;

  Future<String?> _reasonDialog() async {
    final TextEditingController controller = TextEditingController();
    final GlobalKey<FormState> formKey = GlobalKey<FormState>();
    final String? result = await showDialog<String>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Alasan penolakan'),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: controller,
            autofocus: true,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Jelaskan hal yang perlu diperbaiki',
            ),
            validator: (String? value) => value == null || value.trim().isEmpty
                ? 'Alasan penolakan wajib diisi.'
                : null,
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.pop(context, controller.text.trim());
              }
            },
            child: const Text('Tolak'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.pac),
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.danger),
    );
  }

  String _errorMessage(Object? error) =>
      error is AppException ? error.message : 'Detail data tidak tersedia.';
}

class _DetailMenuAction {
  const _DetailMenuAction(
    this.value,
    this.label,
    this.icon, [
    this.color = AppColors.ink,
  ]);

  final String value;
  final String label;
  final IconData icon;
  final Color color;
}

class _FileActionTile extends StatelessWidget {
  const _FileActionTile({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Color accent = Theme.of(context).colorScheme.primary;
    final Color contentColor = onTap == null ? AppColors.muted : accent;
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      child: Material(
        color: Color.alphaBlend(accent.withOpacity(.055), AppColors.surface),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: accent.withOpacity(.16)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: SizedBox(
            height: 76,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Icon(icon, color: contentColor, size: 23),
                const SizedBox(height: 6),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: contentColor,
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MemberDetailAvatar extends ConsumerStatefulWidget {
  const _MemberDetailAvatar({required this.item, required this.accent});

  final ResourceItem item;
  final Color accent;

  @override
  ConsumerState<_MemberDetailAvatar> createState() =>
      _MemberDetailAvatarState();
}

class _MemberDetailAvatarState extends ConsumerState<_MemberDetailAvatar> {
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
    return FutureBuilder<Uint8List>(
      future: image,
      builder: (BuildContext context, AsyncSnapshot<Uint8List> snapshot) =>
          CircleAvatar(
        radius: 28,
        backgroundColor: widget.accent.withOpacity(0.15),
        backgroundImage: snapshot.hasData ? MemoryImage(snapshot.data!) : null,
        child: snapshot.hasData
            ? null
            : Text(
                fallback,
                style: TextStyle(
                  color: widget.accent,
                  fontWeight: FontWeight.w900,
                ),
              ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.field, required this.value});

  final FieldDefinition field;
  final Object? value;

  @override
  Widget build(BuildContext context) {
    if (value is List) return _listValue(context, value! as List<dynamic>);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 122,
            child: Text(
              field.label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              resourceValueLabel(field, value),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _listValue(BuildContext context, List<dynamic> rows) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              field.label,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            if (rows.isEmpty)
              Text('Belum ada', style: Theme.of(context).textTheme.bodySmall)
            else
              ...rows.map<Widget>((dynamic row) {
                final JsonMap data = jsonMap(row);
                final String summary = data.entries
                    .where(
                      (MapEntry<String, dynamic> entry) =>
                          !entry.key.endsWith('Id') &&
                          entry.key != 'id' &&
                          !entry.key.endsWith('At'),
                    )
                    .map<String>(
                      (MapEntry<String, dynamic> entry) =>
                          entry.value?.toString() ?? '',
                    )
                    .where((String item) => item.isNotEmpty)
                    .join(' · ');
                return Container(
                  margin: const EdgeInsets.only(bottom: 7),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.canvas,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(summary.isEmpty ? 'Entri' : summary),
                );
              }),
          ],
        ),
      );
}

class _ParticipantsCard extends ConsumerStatefulWidget {
  const _ParticipantsCard({required this.presensi, required this.user});

  final ResourceItem presensi;
  final AppUser user;

  @override
  ConsumerState<_ParticipantsCard> createState() => _ParticipantsCardState();
}

class _ParticipantsCardState extends ConsumerState<_ParticipantsCard>
    with WidgetsBindingObserver {
  static const Duration _pollInterval = Duration(seconds: 30);
  static const Duration _realtimeDebounce = Duration(milliseconds: 450);

  ProviderSubscription<RealtimeState>? _realtimeSubscription;
  Timer? _pollTimer;
  Timer? _realtimeTimer;
  final TextEditingController _searchController = TextEditingController();
  bool _appResumed = true;
  bool _exporting = false;
  PresensiParticipantSortKey _sortKey = PresensiParticipantSortKey.createdAt;
  bool _sortAscending = false;
  int _page = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _appResumed = WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    _realtimeSubscription = ref.listenManual<RealtimeState>(
      realtimeControllerProvider,
      _onRealtime,
    );
    _startPolling();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appResumed = state == AppLifecycleState.resumed;
    if (_appResumed) {
      _startPolling();
      unawaited(_controller.refresh());
    } else {
      _pollTimer?.cancel();
      _pollTimer = null;
    }
  }

  PresensiParticipantsController get _controller =>
      ref.read(presensiParticipantsProvider(widget.presensi.id).notifier);

  void _startPolling() {
    _pollTimer?.cancel();
    if (!_appResumed) return;
    _pollTimer = Timer.periodic(
      _pollInterval,
      (_) => unawaited(_controller.refresh()),
    );
  }

  void _onRealtime(RealtimeState? previous, RealtimeState next) {
    if (previous == null || next.revision <= previous.revision) return;
    if (!realtimeBatchTargetsPresensiParticipants(
      next.batchEvents,
      next.lastEvent,
      widget.presensi.id,
    )) {
      return;
    }
    _realtimeTimer?.cancel();
    _realtimeTimer = Timer(
      _realtimeDebounce,
      () {
        if (mounted && _appResumed) unawaited(_controller.refresh());
      },
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _realtimeSubscription?.close();
    _pollTimer?.cancel();
    _realtimeTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final PresensiParticipantsState state =
        ref.watch(presensiParticipantsProvider(widget.presensi.id));
    final List<PresensiParticipant> participants = state.items;
    final List<PresensiParticipant> filteredParticipants =
        filterAndSortPresensiParticipants(
      participants,
      search: _searchController.text,
      sortKey: _sortKey,
      ascending: _sortAscending,
    );
    final int totalPages =
        presensiParticipantPageCount(filteredParticipants.length);
    final int currentPage = totalPages == 0 ? 1 : _page.clamp(1, totalPages);
    final List<PresensiParticipant> visibleParticipants =
        paginatePresensiParticipants(
      filteredParticipants,
      page: currentPage,
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    'Peserta (${participants.length})',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  tooltip: 'Muat ulang peserta',
                  onPressed: state.loading
                      ? null
                      : () => unawaited(_controller.refresh()),
                  icon: const Icon(Icons.refresh_rounded),
                ),
                IconButton(
                  tooltip: 'Tampilan penuh',
                  onPressed: participants.isEmpty ? null : _openFullscreen,
                  icon: const Icon(Icons.fullscreen_rounded),
                ),
                IconButton(
                  tooltip: 'Export peserta',
                  onPressed: participants.isEmpty || _exporting
                      ? null
                      : _exportParticipants,
                  icon: _exporting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.table_view_outlined),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (participants.isNotEmpty) ...<Widget>[
              TextField(
                key: const ValueKey<String>('presensi-participant-search'),
                controller: _searchController,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  labelText: 'Cari peserta',
                  hintText: 'Nama, organisasi, jabatan, instansi, atau tingkat',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _searchController.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Bersihkan pencarian peserta',
                          onPressed: () => setState(() {
                            _searchController.clear();
                            _page = 1;
                          }),
                          icon: const Icon(Icons.close_rounded),
                        ),
                ),
                onChanged: (_) => setState(() => _page = 1),
              ),
              const SizedBox(height: 10),
              Row(
                children: <Widget>[
                  Expanded(
                    child: AppSelectField<PresensiParticipantSortKey>(
                      key: const ValueKey<String>(
                        'presensi-participant-sort',
                      ),
                      value: _sortKey,
                      label: 'Urutkan peserta',
                      prefixIcon: Icons.sort_rounded,
                      options: PresensiParticipantSortKey.values
                          .map<AppSelectOption<PresensiParticipantSortKey>>(
                            (PresensiParticipantSortKey key) =>
                                AppSelectOption<PresensiParticipantSortKey>(
                              value: key,
                              label: key.label,
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (PresensiParticipantSortKey? value) {
                        if (value == null) return;
                        setState(() {
                          if (value != _sortKey) {
                            _sortKey = value;
                            _sortAscending = true;
                          }
                          _page = 1;
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.outlined(
                    tooltip: _sortAscending
                        ? 'Urutan naik; ketuk untuk urutan turun'
                        : 'Urutan turun; ketuk untuk urutan naik',
                    onPressed: () => setState(() {
                      _sortAscending = !_sortAscending;
                      _page = 1;
                    }),
                    icon: Icon(
                      _sortAscending
                          ? Icons.arrow_upward_rounded
                          : Icons.arrow_downward_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
            if (state.loading) const LinearProgressIndicator(),
            if (state.errorMessage != null && participants.isEmpty)
              ResourceMessageState(
                icon: Icons.cloud_off_outlined,
                title: 'Peserta tidak dapat dimuat',
                message: state.errorMessage!,
                actionLabel: 'Coba lagi',
                onAction: () => unawaited(_controller.refresh()),
              )
            else if (participants.isEmpty && !state.loading)
              Text(
                'Belum ada peserta yang mengisi presensi.',
                style: Theme.of(context).textTheme.bodySmall,
              )
            else if (visibleParticipants.isEmpty)
              const ResourceMessageState(
                icon: Icons.search_off_rounded,
                title: 'Peserta tidak ditemukan',
                message: 'Ubah kata pencarian untuk melihat peserta lain.',
              )
            else
              ...visibleParticipants.map<Widget>(
                (PresensiParticipant participant) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    child: Text(
                      participant.name.isEmpty
                          ? '?'
                          : participant.name[0].toUpperCase(),
                    ),
                  ),
                  title: Text(participant.name),
                  subtitle: Text(
                    <String>[
                      participant.organization,
                      participant.level,
                      participant.institution.isNotEmpty
                          ? participant.institution
                          : participant.position,
                    ].where((String value) => value.isNotEmpty).join(' · '),
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => _showParticipant(participant),
                ),
              ),
            if (visibleParticipants.isNotEmpty) ...<Widget>[
              const Divider(height: 1),
              _ParticipantPaginationBar(
                page: currentPage,
                totalPages: totalPages,
                totalItems: filteredParticipants.length,
                onPage: (int value) => setState(() => _page = value),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _exportParticipants() async {
    setState(() => _exporting = true);
    try {
      final List<PresensiParticipant> participants =
          ref.read(presensiParticipantsProvider(widget.presensi.id)).items;
      final ResourceSpreadsheetDocument document =
          ref.read(resourceSpreadsheetServiceProvider).buildParticipantExport(
                widget.presensi,
                participants,
                widget.user,
              );
      final DownloadedResourceFile file =
          await ref.read(resourceSpreadsheetFileActionsProvider).save(document);
      unawaited(_logParticipantExportBestEffort(document.name));
      await ref.read(resourceSpreadsheetFileActionsProvider).open(file);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${file.name} berhasil disimpan.'),
            backgroundColor: AppColors.pac,
          ),
        );
      }
    } on AppException catch (error) {
      if (mounted) _showParticipantError(error.message);
    } on Object {
      if (mounted) _showParticipantError('Export peserta tidak dapat dibuat.');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _logParticipantExportBestEffort(String fileName) async {
    try {
      await ref
          .read(resourceRepositoryProvider)
          .logExport('PRESENSI', fileName);
    } on Object catch (error, stackTrace) {
      debugPrint('Pencatatan audit export peserta gagal: $error\n$stackTrace');
    }
  }

  Future<void> _openFullscreen() => Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          fullscreenDialog: true,
          builder: (BuildContext context) => _PresensiFullscreenPage(
            presensi: widget.presensi,
            attendanceUri: ref
                .read(appConfigProvider)
                .publicAttendanceUri(widget.presensi.id),
          ),
        ),
      );

  Future<void> _showParticipant(PresensiParticipant participant) =>
      showDialog<void>(
        context: context,
        builder: (BuildContext context) => AlertDialog(
          title: Text(participant.name),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                _ParticipantInfo('Organisasi', participant.organization),
                _ParticipantInfo('Tingkat', participant.level),
                _ParticipantInfo('Instansi', participant.institution),
                _ParticipantInfo('Jabatan', participant.position),
                _ParticipantInfo('Email', participant.email),
                _ParticipantInfo('Nomor HP', participant.phone),
                _ParticipantInfo(
                  'Waktu absen',
                  participant.createdAt?.toLocal().toString() ?? '-',
                ),
              ],
            ),
          ),
          actions: <Widget>[
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Tutup'),
            ),
          ],
        ),
      );

  void _showParticipantError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.danger),
    );
  }
}

class _ParticipantPaginationBar extends StatelessWidget {
  const _ParticipantPaginationBar({
    required this.page,
    required this.totalPages,
    required this.totalItems,
    required this.onPage,
  });

  final int page;
  final int totalPages;
  final int totalItems;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    final int start = (page - 1) * presensiParticipantsPerPage + 1;
    final int requestedEnd = page * presensiParticipantsPerPage;
    final int end = requestedEnd < totalItems ? requestedEnd : totalItems;
    return Column(
      children: <Widget>[
        const SizedBox(height: 10),
        Text(
          '$start–$end dari $totalItems peserta',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        AppPagination(
          page: page,
          totalPages: totalPages,
          onPage: onPage,
          padding: const EdgeInsets.only(top: 4),
        ),
      ],
    );
  }
}

class _ParticipantInfo extends StatelessWidget {
  const _ParticipantInfo(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SizedBox(
              width: 92,
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
            Expanded(child: Text(value.trim().isEmpty ? '-' : value)),
          ],
        ),
      );
}

class _PresensiFullscreenPage extends ConsumerWidget {
  const _PresensiFullscreenPage({
    required this.presensi,
    required this.attendanceUri,
  });

  final ResourceItem presensi;
  final Uri attendanceUri;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final PresensiParticipantsState state =
        ref.watch(presensiParticipantsProvider(presensi.id));
    final List<PresensiParticipant> participants = state.items;
    return Scaffold(
      appBar: AppBar(
        title: Text(presensi.text('namaKegiatan')),
        actions: <Widget>[
          Center(
            child: Text(
              '${participants.length} peserta',
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ),
          IconButton(
            tooltip: 'Muat ulang peserta',
            onPressed: state.loading
                ? null
                : () => ref
                    .read(
                      presensiParticipantsProvider(presensi.id).notifier,
                    )
                    .refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 16),
              child: ResourceStatusBadge(
                label: presensiIsOpen(presensi) ? 'Terbuka' : 'Tertutup',
                color:
                    presensiIsOpen(presensi) ? AppColors.pac : AppColors.danger,
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        children: <Widget>[
          LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final Widget roster = _LiveParticipantRoster(
                state: state,
                onRetry: () => ref
                    .read(
                      presensiParticipantsProvider(presensi.id).notifier,
                    )
                    .refresh(),
              );
              if (constraints.maxWidth < 700) {
                return Column(
                  children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: PresensiQrCard(
                        uri: attendanceUri,
                        activityName: presensi.text('namaKegiatan'),
                      ),
                    ),
                    Expanded(child: roster),
                  ],
                );
              }
              return Row(
                children: <Widget>[
                  SizedBox(
                    width: 390,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: PresensiQrCard(
                        uri: attendanceUri,
                        activityName: presensi.text('namaKegiatan'),
                      ),
                    ),
                  ),
                  const VerticalDivider(width: 1),
                  Expanded(child: roster),
                ],
              );
            },
          ),
          if (state.isRefreshing)
            const Positioned(
              left: 0,
              right: 0,
              top: 0,
              child: LinearProgressIndicator(minHeight: 2),
            ),
        ],
      ),
    );
  }
}

class _LiveParticipantRoster extends StatefulWidget {
  const _LiveParticipantRoster({
    required this.state,
    required this.onRetry,
  });

  final PresensiParticipantsState state;
  final VoidCallback onRetry;

  @override
  State<_LiveParticipantRoster> createState() => _LiveParticipantRosterState();
}

class _LiveParticipantRosterState extends State<_LiveParticipantRoster> {
  final TextEditingController _searchController = TextEditingController();
  PresensiParticipantSortKey _sortKey = PresensiParticipantSortKey.createdAt;
  bool _sortAscending = false;
  int _page = 1;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final PresensiParticipantsState state = widget.state;
    if (state.isInitialLoading) {
      return const SizedBox(height: 260, child: AppLoadingList(items: 2));
    }
    if (state.errorMessage != null && state.items.isEmpty) {
      return ResourceMessageState(
        icon: Icons.cloud_off_outlined,
        title: 'Peserta tidak dapat dimuat',
        message: state.errorMessage!,
        actionLabel: 'Coba lagi',
        onAction: widget.onRetry,
      );
    }
    if (state.items.isEmpty) {
      return const ResourceMessageState(
        icon: Icons.people_outline_rounded,
        title: 'Belum ada peserta',
        message: 'Daftar ini diperbarui otomatis saat peserta melakukan absen.',
      );
    }
    final List<PresensiParticipant> filteredParticipants =
        filterAndSortPresensiParticipants(
      state.items,
      search: _searchController.text,
      sortKey: _sortKey,
      ascending: _sortAscending,
    );
    final int totalPages =
        presensiParticipantPageCount(filteredParticipants.length);
    final int currentPage = totalPages == 0 ? 1 : _page.clamp(1, totalPages);
    final List<PresensiParticipant> visibleParticipants =
        paginatePresensiParticipants(
      filteredParticipants,
      page: currentPage,
    );
    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            children: <Widget>[
              TextField(
                key: const ValueKey<String>(
                  'presensi-fullscreen-participant-search',
                ),
                controller: _searchController,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  labelText: 'Cari peserta',
                  hintText: 'Nama, organisasi, jabatan, instansi, atau tingkat',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _searchController.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Bersihkan pencarian peserta',
                          onPressed: () => setState(() {
                            _searchController.clear();
                            _page = 1;
                          }),
                          icon: const Icon(Icons.close_rounded),
                        ),
                ),
                onChanged: (_) => setState(() => _page = 1),
              ),
              const SizedBox(height: 8),
              Row(
                children: <Widget>[
                  Expanded(
                    child: AppSelectField<PresensiParticipantSortKey>(
                      key: const ValueKey<String>(
                        'presensi-fullscreen-participant-sort',
                      ),
                      value: _sortKey,
                      label: 'Urutkan peserta',
                      prefixIcon: Icons.sort_rounded,
                      options: PresensiParticipantSortKey.values
                          .map<AppSelectOption<PresensiParticipantSortKey>>(
                            (PresensiParticipantSortKey key) =>
                                AppSelectOption<PresensiParticipantSortKey>(
                              value: key,
                              label: key.label,
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (PresensiParticipantSortKey? value) {
                        if (value == null) return;
                        setState(() {
                          if (value != _sortKey) {
                            _sortKey = value;
                            _sortAscending = true;
                          }
                          _page = 1;
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.outlined(
                    tooltip: _sortAscending
                        ? 'Urutan naik; ketuk untuk urutan turun'
                        : 'Urutan turun; ketuk untuk urutan naik',
                    onPressed: () => setState(() {
                      _sortAscending = !_sortAscending;
                      _page = 1;
                    }),
                    icon: Icon(
                      _sortAscending
                          ? Icons.arrow_upward_rounded
                          : Icons.arrow_downward_rounded,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (visibleParticipants.isEmpty)
          const Expanded(
            child: ResourceMessageState(
              icon: Icons.search_off_rounded,
              title: 'Peserta tidak ditemukan',
              message: 'Ubah kata pencarian untuk melihat peserta lain.',
            ),
          )
        else
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: visibleParticipants.length,
              separatorBuilder: (BuildContext context, int index) =>
                  const Divider(height: 1),
              itemBuilder: (BuildContext context, int index) {
                final PresensiParticipant participant =
                    visibleParticipants[index];
                final int number =
                    (currentPage - 1) * presensiParticipantsPerPage + index + 1;
                return ListTile(
                  leading: CircleAvatar(child: Text('$number')),
                  title: Text(participant.name),
                  subtitle: Text(
                    <String>[
                      participant.organization,
                      participant.level,
                      participant.institution.isNotEmpty
                          ? participant.institution
                          : participant.position,
                    ].where((String value) => value.isNotEmpty).join(' · '),
                  ),
                );
              },
            ),
          ),
        if (visibleParticipants.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: _ParticipantPaginationBar(
              page: currentPage,
              totalPages: totalPages,
              totalItems: filteredParticipants.length,
              onPage: (int value) => setState(() => _page = value),
            ),
          ),
      ],
    );
  }
}
