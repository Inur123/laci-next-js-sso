import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/errors/app_exception.dart';
import '../../../shared/models/json_value.dart';
import '../../../shared/widgets/app_layout.dart';
import '../../../shared/widgets/app_states.dart';
import '../data/admin_repository.dart';
import 'admin_widgets.dart';

class BackupsPage extends ConsumerStatefulWidget {
  const BackupsPage({super.key});

  @override
  ConsumerState<BackupsPage> createState() => _BackupsPageState();
}

class _BackupsPageState extends ConsumerState<BackupsPage> {
  List<JsonMap> _items = <JsonMap>[];
  String? _error;
  String? _busyKey;
  bool _loading = true;
  bool _creating = false;

  AdminRepository get _repository => ref.read(adminRepositoryProvider);

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final List<JsonMap> items = await _repository.backups();
      items.sort((JsonMap a, JsonMap b) {
        final DateTime first =
            dateTimeValue(a['lastModified']) ?? DateTime(1970);
        final DateTime second =
            dateTimeValue(b['lastModified']) ?? DateTime(1970);
        return second.compareTo(first);
      });
      if (!mounted) return;
      setState(() {
        _items = items;
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
      if (previous != null &&
          next.revision > previous.revision &&
          !_loading &&
          !_creating) {
        unawaited(_load());
      }
    });
    return Scaffold(
      appBar: AppBar(
        title: const Text('Backup Database'),
        actions: <Widget>[
          IconButton(
            onPressed: _loading || _creating ? null : _load,
            tooltip: 'Muat ulang',
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: 'Buat backup',
        onPressed: _creating ? null : _create,
        child: _creating
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.add_to_drive_outlined),
      ),
      body: _loading && _items.isEmpty
          ? const AppLoadingList()
          : _error != null && _items.isEmpty
              ? AppErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: AppConstrainedContent(
                    maxWidth: 760,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                      children: <Widget>[
                        Container(
                          padding: const EdgeInsets.all(15),
                          decoration: BoxDecoration(
                            color: AppColors.cabang.withOpacity(0.07),
                            border: Border.all(
                                color: AppColors.cabang.withOpacity(0.2)),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Icon(Icons.shield_outlined,
                                  color: AppColors.cabang),
                              SizedBox(width: 11),
                              Expanded(
                                child: Text(
                                  'Backup disimpan sebagai objek privat di penyimpanan backend. Tautan unduhan hanya berlaku 10 menit dan maksimum 10 backup terbaru dipertahankan.',
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
                            icon: Icons.cloud_off_outlined,
                            title: 'Belum ada backup',
                            message:
                                'Buat backup pertama setelah penyimpanan R2 backend dikonfigurasi.',
                          )
                        else
                          ..._items.map<Widget>(_buildItem),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildItem(JsonMap item) {
    final String key = stringValue(item['key']);
    final String fileName = key.split('/').last;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            children: <Widget>[
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.cabang.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child:
                    const Icon(Icons.storage_rounded, color: AppColors.cabang),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(fileName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                        '${_formatBytes(intValue(item['size']))} · ${formatAdminDate(item['lastModified'])}',
                        style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              if (_busyKey == key)
                const Padding(
                  padding: EdgeInsets.all(10),
                  child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2)),
                )
              else
                PopupMenuButton<String>(
                  tooltip: 'Aksi backup',
                  onSelected: (String value) {
                    if (value == 'download') {
                      unawaited(_download(key));
                    } else {
                      unawaited(_delete(key, fileName));
                    }
                  },
                  itemBuilder: (BuildContext context) =>
                      const <PopupMenuEntry<String>>[
                    PopupMenuItem<String>(
                      value: 'download',
                      child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(Icons.download_rounded),
                          title: Text('Unduh')),
                    ),
                    PopupMenuItem<String>(
                      value: 'delete',
                      child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(Icons.delete_outline_rounded,
                              color: AppColors.danger),
                          title: Text('Hapus',
                              style: TextStyle(color: AppColors.danger))),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _create() async {
    final bool confirmed = await showDialog<bool>(
          context: context,
          builder: (BuildContext dialogContext) => AlertDialog(
            title: const Text('Buat backup baru?'),
            content: const Text(
                'Proses dapat memerlukan beberapa menit. Jangan tutup aplikasi sampai selesai.'),
            actions: <Widget>[
              TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Batal')),
              FilledButton(
                  onPressed: () => Navigator.pop(dialogContext, true),
                  child: const Text('Buat backup')),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    setState(() => _creating = true);
    try {
      final String message = await _repository.createBackup();
      if (!mounted) return;
      showAdminMessage(context, message);
      await _load();
    } catch (error) {
      if (mounted) {
        showAdminMessage(context, AppException.messageOf(error));
        // The server may have completed after the client timed out. Reconcile
        // before allowing another create to avoid accidental duplicate backup.
        await _load();
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _download(String key) async {
    setState(() => _busyKey = key);
    try {
      final Uri uri = await _repository.backupUrl(key);
      final bool opened =
          await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened) {
        throw const AppException(message: 'Tautan backup tidak dapat dibuka');
      }
    } catch (error) {
      if (mounted) showAdminMessage(context, AppException.messageOf(error));
    } finally {
      if (mounted) setState(() => _busyKey = null);
    }
  }

  Future<void> _delete(String key, String fileName) async {
    final bool confirmed = await showDialog<bool>(
          context: context,
          builder: (BuildContext dialogContext) => AlertDialog(
            title: const Text('Hapus backup?'),
            content: Text('$fileName akan dihapus permanen dari penyimpanan.'),
            actions: <Widget>[
              TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Batal')),
              FilledButton(
                style:
                    FilledButton.styleFrom(backgroundColor: AppColors.danger),
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Hapus'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    setState(() => _busyKey = key);
    try {
      final String message = await _repository.deleteBackup(key);
      if (!mounted) return;
      showAdminMessage(context, message);
      await _load();
    } catch (error) {
      if (mounted) showAdminMessage(context, AppException.messageOf(error));
    } finally {
      if (mounted) setState(() => _busyKey = null);
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
