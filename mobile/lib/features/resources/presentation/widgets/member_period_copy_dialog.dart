import 'package:flutter/material.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../shared/widgets/app_select_field.dart';
import '../../../../shared/widgets/app_states.dart';
import '../../data/resource_repository.dart';
import '../../domain/resource_models.dart';

class MemberPeriodCopyDialog extends StatefulWidget {
  const MemberPeriodCopyDialog({
    required this.periods,
    required this.currentPeriodId,
    required this.repository,
    required this.onCopy,
    super.key,
  });

  final List<ResourcePeriodRef> periods;
  final String? currentPeriodId;
  final ResourceDataSource repository;
  final Future<String> Function({
    required List<String> ids,
    required String sourcePeriodId,
    required String targetPeriodId,
  }) onCopy;

  @override
  State<MemberPeriodCopyDialog> createState() => _MemberPeriodCopyDialogState();
}

class _MemberPeriodCopyDialogState extends State<MemberPeriodCopyDialog> {
  final TextEditingController _searchController = TextEditingController();
  final Set<String> _selected = <String>{};
  late String _sourcePeriodId;
  String? _targetPeriodId;
  late Future<List<ResourceItem>> _members;
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _sourcePeriodId = widget.currentPeriodId ??
        widget.periods
            .where((ResourcePeriodRef period) => period.isActive)
            .map<String>((ResourcePeriodRef period) => period.id)
            .firstOrNull ??
        widget.periods.first.id;
    _members = widget.repository.membersForPeriod(_sourcePeriodId);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Masukkan anggota ke periode'),
        content: SizedBox(
          width: 560,
          height: MediaQuery.sizeOf(context).height * 0.62,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'Pilih anggota dari periode sumber. Data lama tetap tersimpan.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 14),
              AppSelectField<String>(
                value: _sourcePeriodId,
                label: 'Periode sumber',
                options: _periodOptions(),
                onChanged: _submitting
                    ? null
                    : (String? value) {
                        if (value == null || value == _sourcePeriodId) return;
                        setState(() {
                          _sourcePeriodId = value;
                          if (_targetPeriodId == value) _targetPeriodId = null;
                          _selected.clear();
                          _error = null;
                          _members = widget.repository.membersForPeriod(value);
                        });
                      },
              ),
              const SizedBox(height: 10),
              AppSelectField<String>(
                value: _targetPeriodId,
                label: 'Periode tujuan',
                options: _periodOptions(except: _sourcePeriodId),
                onChanged: _submitting
                    ? null
                    : (String? value) =>
                        setState(() => _targetPeriodId = value),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _searchController,
                decoration: const InputDecoration(
                  hintText: 'Cari nama atau NIK...',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 8),
              Expanded(
                child: FutureBuilder<List<ResourceItem>>(
                  future: _members,
                  builder: (
                    BuildContext context,
                    AsyncSnapshot<List<ResourceItem>> snapshot,
                  ) {
                    if (snapshot.connectionState != ConnectionState.done) {
                      return const AppLoadingList(items: 3);
                    }
                    if (snapshot.hasError) {
                      return const Center(
                        child: Text('Anggota periode ini tidak dapat dimuat.'),
                      );
                    }
                    final List<ResourceItem> visible =
                        _visible(snapshot.data ?? const <ResourceItem>[]);
                    if (visible.isEmpty) {
                      return const Center(
                        child: Text('Tidak ada anggota yang sesuai.'),
                      );
                    }
                    final bool allSelected = visible.every(
                      (ResourceItem member) => _selected.contains(member.id),
                    );
                    return Column(
                      children: <Widget>[
                        CheckboxListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          value: allSelected,
                          title: Text(
                            'Pilih semua yang tampil (${visible.length})',
                          ),
                          onChanged: _submitting
                              ? null
                              : (_) => setState(() {
                                    if (allSelected) {
                                      _selected.removeAll(
                                        visible.map<String>(
                                          (ResourceItem item) => item.id,
                                        ),
                                      );
                                    } else {
                                      _selected.addAll(
                                        visible.map<String>(
                                          (ResourceItem item) => item.id,
                                        ),
                                      );
                                    }
                                  }),
                        ),
                        const Divider(height: 1),
                        Expanded(
                          child: ListView.builder(
                            itemCount: visible.length,
                            itemBuilder: (BuildContext context, int index) {
                              final ResourceItem member = visible[index];
                              return CheckboxListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                value: _selected.contains(member.id),
                                title: Text(member.text('namaLengkap')),
                                subtitle: member.text('nik', '').isEmpty
                                    ? null
                                    : Text('NIK: ${member.text('nik')}'),
                                onChanged: _submitting
                                    ? null
                                    : (bool? selected) => setState(() {
                                          selected == true
                                              ? _selected.add(member.id)
                                              : _selected.remove(member.id);
                                        }),
                              );
                            },
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: _submitting ? null : () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton.icon(
            onPressed:
                _submitting || _targetPeriodId == null || _selected.isEmpty
                    ? null
                    : _submit,
            icon: _submitting
                ? const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.copy_all_outlined),
            label: Text('Masukkan ${_selected.length} anggota'),
          ),
        ],
      );

  List<AppSelectOption<String>> _periodOptions({String? except}) =>
      widget.periods
          .where((ResourcePeriodRef period) => period.id != except)
          .map<AppSelectOption<String>>(
            (ResourcePeriodRef period) => AppSelectOption<String>(
              value: period.id,
              label: period.name,
              note: period.isActive ? 'Periode aktif' : null,
            ),
          )
          .toList(growable: false);

  List<ResourceItem> _visible(List<ResourceItem> members) {
    final String term = _searchController.text.trim().toLowerCase();
    if (term.isEmpty) return members;
    return members
        .where(
          (ResourceItem member) =>
              '${member.text('namaLengkap', '')} ${member.text('nik', '')}'
                  .toLowerCase()
                  .contains(term),
        )
        .toList(growable: false);
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final String message = await widget.onCopy(
        ids: _selected.toList(growable: false),
        sourcePeriodId: _sourcePeriodId,
        targetPeriodId: _targetPeriodId!,
      );
      if (mounted) Navigator.pop(context, message);
    } on AppException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } on Object {
      if (mounted) {
        setState(() => _error = 'Anggota tidak dapat disalin. Coba lagi.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull {
    final Iterator<T> iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}
