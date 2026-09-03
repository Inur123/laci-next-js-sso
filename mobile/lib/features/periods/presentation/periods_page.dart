import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/app_layout.dart';
import '../../../shared/widgets/app_states.dart';
import '../application/period_controller.dart';
import '../domain/app_period.dart';

class PeriodsPage extends ConsumerWidget {
  const PeriodsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final PeriodState state = ref.watch(periodControllerProvider);
    final PeriodController controller =
        ref.read(periodControllerProvider.notifier);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Periode'),
        actions: <Widget>[
          IconButton(
            onPressed: state.loading ? null : controller.load,
            tooltip: 'Muat ulang',
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: 'Tambah periode',
        onPressed: state.mutating
            ? null
            : () => _showPeriodForm(context, controller: controller),
        child: const Icon(Icons.add_rounded),
      ),
      body: switch ((state.loading, state.error, state.periods.isEmpty)) {
        (true, _, true) => const AppLoadingList(),
        (false, final String error, _) => AppErrorState(
            message: error,
            onRetry: controller.load,
          ),
        (false, _, true) => const AppEmptyState(
            icon: Icons.calendar_month_outlined,
            title: 'Belum ada periode',
            message:
                'Tambahkan periode kepengurusan pertama untuk mulai mengelola data.',
          ),
        _ => RefreshIndicator(
            onRefresh: controller.load,
            child: AppConstrainedContent(
              maxWidth: 760,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 96),
                itemCount: state.periods.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (BuildContext context, int index) {
                  final AppPeriod period = state.periods[index];
                  final bool viewing = state.viewPeriodId == period.id ||
                      (state.viewPeriodId == null && period.isActive);
                  return _PeriodCard(
                    period: period,
                    viewing: viewing,
                    busy: state.mutating,
                    onView: () => controller.setViewPeriod(
                      period.isActive ? null : period.id,
                    ),
                    onActivate: period.isActive
                        ? null
                        : () async {
                            final String? message =
                                await controller.activate(period.id);
                            if (context.mounted && message != null) {
                              _showMessage(context, message);
                            }
                          },
                    onEdit: () => _showPeriodForm(
                      context,
                      controller: controller,
                      period: period,
                    ),
                    onDelete: period.isActive
                        ? null
                        : () => _confirmDelete(context, controller, period),
                  );
                },
              ),
            ),
          ),
      },
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    PeriodController controller,
    AppPeriod period,
  ) async {
    final bool confirmed = await showDialog<bool>(
          context: context,
          builder: (BuildContext dialogContext) => AlertDialog(
            title: const Text('Hapus periode?'),
            content: Text(
              'Periode “${period.name}” beserta data terkait akan dihapus sesuai aturan backend.',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Batal'),
              ),
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
    if (!confirmed) return;
    final String? message = await controller.delete(period.id);
    if (context.mounted && message != null) _showMessage(context, message);
  }

  Future<void> _showPeriodForm(
    BuildContext context, {
    required PeriodController controller,
    AppPeriod? period,
  }) async {
    final TextEditingController name =
        TextEditingController(text: period?.name);
    final GlobalKey<FormState> formKey = GlobalKey<FormState>();
    final String? message = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (BuildContext sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          22,
          20,
          MediaQuery.viewInsetsOf(sheetContext).bottom + 20,
        ),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                period == null ? 'Tambah periode' : 'Ubah periode',
                style: Theme.of(sheetContext).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                'Gunakan nama periode yang sama dengan struktur organisasi terkait.',
                style: Theme.of(sheetContext).textTheme.bodySmall,
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: name,
                autofocus: true,
                textInputAction: TextInputAction.done,
                decoration: const InputDecoration(
                  labelText: 'Nama periode',
                  hintText: 'Contoh: Masa Khidmat 2026–2028',
                ),
                validator: (String? value) =>
                    value == null || value.trim().isEmpty
                        ? 'Nama periode wajib diisi'
                        : null,
                onFieldSubmitted: (_) => _submitPeriodForm(
                  sheetContext,
                  formKey,
                  controller,
                  name.text,
                  period,
                ),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () => _submitPeriodForm(
                  sheetContext,
                  formKey,
                  controller,
                  name.text,
                  period,
                ),
                child: Text(
                    period == null ? 'Simpan periode' : 'Simpan perubahan'),
              ),
            ],
          ),
        ),
      ),
    );
    name.dispose();
    if (context.mounted && message != null) _showMessage(context, message);
  }

  Future<void> _submitPeriodForm(
    BuildContext context,
    GlobalKey<FormState> formKey,
    PeriodController controller,
    String name,
    AppPeriod? period,
  ) async {
    if (!(formKey.currentState?.validate() ?? false)) return;
    final String? message = period == null
        ? await controller.create(name)
        : await controller.update(period.id, name);
    if (context.mounted && message != null) Navigator.pop(context, message);
  }

  void _showMessage(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({
    required this.period,
    required this.viewing,
    required this.busy,
    required this.onView,
    required this.onActivate,
    required this.onEdit,
    required this.onDelete,
  });

  final AppPeriod period;
  final bool viewing;
  final bool busy;
  final VoidCallback onView;
  final VoidCallback? onActivate;
  final VoidCallback onEdit;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) => Card(
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
                      color: Theme.of(context)
                          .colorScheme
                          .primary
                          .withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.calendar_month_outlined,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(period.name,
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 3),
                        Text(
                          period.isActive
                              ? 'Periode resmi yang sedang aktif'
                              : viewing
                                  ? 'Sedang digunakan untuk tampilan data'
                                  : 'Periode tidak aktif',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        if (period.createdAt != null) ...<Widget>[
                          const SizedBox(height: 2),
                          Text(
                            'Dibuat ${DateFormat('d MMM yyyy', 'id_ID').format(period.createdAt!.toLocal())}',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppColors.muted,
                                    ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    enabled: !busy,
                    onSelected: (String value) {
                      if (value == 'edit') onEdit();
                      if (value == 'delete') onDelete?.call();
                    },
                    itemBuilder: (_) => <PopupMenuEntry<String>>[
                      const PopupMenuItem<String>(
                        value: 'edit',
                        child: Text('Ubah nama'),
                      ),
                      if (onDelete != null)
                        const PopupMenuItem<String>(
                          value: 'delete',
                          child: Text('Hapus'),
                        ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: <Widget>[
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: busy || viewing ? null : onView,
                      icon: Icon(viewing
                          ? Icons.visibility
                          : Icons.visibility_outlined),
                      label: Text(viewing ? 'Ditampilkan' : 'Tampilkan'),
                    ),
                  ),
                  if (onActivate != null) ...<Widget>[
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: busy ? null : onActivate,
                        child: const Text('Aktifkan'),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      );
}
