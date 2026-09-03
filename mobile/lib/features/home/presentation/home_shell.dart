import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../admin/presentation/activity_logs_page.dart';
import '../../admin/presentation/backups_page.dart';
import '../../admin/presentation/email_logs_page.dart';
import '../../admin/presentation/users_page.dart';
import '../../auth/domain/app_user.dart';
import '../../dashboard/application/dashboard_controller.dart';
import '../../dashboard/presentation/dashboard_page.dart';
import '../../periods/application/period_controller.dart';
import '../../periods/domain/app_period.dart';
import '../../periods/presentation/periods_page.dart';
import '../../profile/presentation/profile_page.dart';
import '../../realtime/application/realtime_controller.dart';
import '../../resources/application/resource_controller.dart';
import '../../resources/domain/resource_definition.dart';
import '../../resources/domain/resource_definitions.dart';
import '../../resources/presentation/resource_list_page.dart';

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({required this.user, super.key});

  final AppUser user;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _tabIndex = 0;

  AppUser get user => widget.user;

  @override
  Widget build(BuildContext context) {
    final PeriodState periodState = user.emailVerified
        ? ref.watch(periodControllerProvider)
        : const PeriodState();
    final RealtimeState realtime = ref.watch(realtimeControllerProvider);
    ref.listen<RealtimeState>(
      realtimeControllerProvider,
      (RealtimeState? previous, RealtimeState next) {
        if (previous != null && next.revision > previous.revision) {
          unawaited(ref.read(dashboardControllerProvider.notifier).load());
          ref.invalidate(resourceControllerProvider);
          if (user.emailVerified && next.containsModule('PERIODE')) {
            unawaited(ref.read(periodControllerProvider.notifier).load());
          }
          if (next.containsModule('USER')) {
            unawaited(
              ref.read(authControllerProvider.notifier).revalidateSession(),
            );
          }
        }
      },
    );

    final Widget content = IndexedStack(
      index: _tabIndex,
      children: <Widget>[
        DashboardPage(
          user: user,
          onOpen: _openDestination,
          onProfile: () => _selectTab(2),
          activePeriod: periodState.activePeriod,
          viewPeriod: periodState.viewPeriod,
          onSelectPeriod: user.emailVerified
              ? () => _selectPeriod(context, periodState)
              : null,
          realtimeConnection: realtime.connection,
        ),
        _ServicesPage(
          user: user,
          onOpen: _openDestination,
        ),
        ProfilePage(user: user, embedded: true),
      ],
    );
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        if (constraints.maxWidth >= 720) {
          return Scaffold(
            body: Row(
              children: <Widget>[
                SafeArea(
                  child: NavigationRail(
                    selectedIndex: _tabIndex,
                    onDestinationSelected: _selectTab,
                    labelType: NavigationRailLabelType.all,
                    destinations: const <NavigationRailDestination>[
                      NavigationRailDestination(
                        icon: Icon(Icons.home_outlined),
                        selectedIcon: Icon(Icons.home_rounded),
                        label: Text('Beranda'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.grid_view_outlined),
                        selectedIcon: Icon(Icons.grid_view_rounded),
                        label: Text('Layanan'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.person_outline_rounded),
                        selectedIcon: Icon(Icons.person_rounded),
                        label: Text('Akun'),
                      ),
                    ],
                  ),
                ),
                const VerticalDivider(width: 1),
                Expanded(child: content),
              ],
            ),
          );
        }
        return Scaffold(
          body: content,
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tabIndex,
            onDestinationSelected: _selectTab,
            destinations: const <NavigationDestination>[
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Beranda',
              ),
              NavigationDestination(
                icon: Icon(Icons.grid_view_outlined),
                selectedIcon: Icon(Icons.grid_view_rounded),
                label: 'Layanan',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'Akun',
              ),
            ],
          ),
        );
      },
    );
  }

  void _selectTab(int index) {
    _clearTransientMessages();
    if (_tabIndex != index) setState(() => _tabIndex = index);
  }

  void _clearTransientMessages() {
    ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
  }

  Future<void> _openDestination(String key) async {
    _clearTransientMessages();
    if (!user.emailVerified) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Fitur ini tersedia setelah email SSO terverifikasi.',
            ),
          ),
        );
      return;
    }
    final Widget page = switch (key) {
      'periods' => const PeriodsPage(),
      'activity' => ActivityLogsPage(user: user),
      'users' => const UsersPage(),
      'email-logs' => const EmailLogsPage(),
      'backups' => const BackupsPage(),
      'wilayah-ranting' => ResourceListPage(
          definition: wilayahResource,
          user: user,
          title: 'Wilayah Ranting',
          initialFilters: const <String, String>{'jenis': 'RANTING'},
        ),
      'wilayah-pk' => ResourceListPage(
          definition: wilayahResource,
          user: user,
          title: 'Wilayah Komisariat',
          initialFilters: const <String, String>{'jenis': 'PK'},
        ),
      'pengajuan-reference' => ResourceListPage(
          definition: pengajuanResource,
          user: user,
          title: 'Referensi Pengajuan',
          scope: ResourceScope.reference,
        ),
      'pengajuan-berkas' => ResourceListPage(
          definition: pengajuanResource,
          user: user,
          title: user.isCabang ? 'Verifikasi Pengajuan' : null,
          scope: user.isCabang ? ResourceScope.review : ResourceScope.mine,
        ),
      _ => ResourceListPage(
          definition: resourceDefinitionFor(key),
          user: user,
        ),
    };
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (BuildContext context) => page),
    );
    if (mounted) _clearTransientMessages();
  }

  Future<void> _selectPeriod(BuildContext context, PeriodState state) async {
    if (state.loading && state.periods.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (BuildContext sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'Periode yang dilihat',
                style: Theme.of(sheetContext).textTheme.titleLarge,
              ),
              const SizedBox(height: 5),
              Text(
                'Pilihan ini hanya mengganti tampilan data. Periode aktif organisasi tidak berubah.',
                style: Theme.of(sheetContext).textTheme.bodySmall,
              ),
              const SizedBox(height: 14),
              if (state.periods.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text('Belum ada periode yang dapat dipilih.'),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: state.periods.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (BuildContext context, int index) {
                      final AppPeriod period = state.periods[index];
                      final String? selected =
                          state.viewPeriodId ?? state.activePeriod?.id;
                      final bool checked = selected == period.id;
                      return Material(
                        color: checked
                            ? AppColors.softForRole(user.role)
                            : AppColors.canvas,
                        borderRadius: BorderRadius.circular(16),
                        child: ListTile(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          title: Text(
                            period.name,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: period.isActive
                              ? const Text('Periode aktif')
                              : null,
                          trailing: Icon(
                            checked
                                ? Icons.check_circle_rounded
                                : Icons.circle_outlined,
                            color: checked
                                ? AppColors.forRole(user.role)
                                : AppColors.muted,
                          ),
                          onTap: () async {
                            await ref
                                .read(periodControllerProvider.notifier)
                                .setViewPeriod(
                                    period.isActive ? null : period.id);
                            ref.invalidate(resourceControllerProvider);
                            unawaited(
                              ref
                                  .read(dashboardControllerProvider.notifier)
                                  .load(),
                            );
                            if (sheetContext.mounted) {
                              Navigator.pop(sheetContext);
                            }
                          },
                        ),
                      );
                    },
                  ),
                ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(sheetContext);
                  unawaited(_openDestination('periods'));
                },
                icon: const Icon(Icons.calendar_month_outlined),
                label: const Text('Kelola periode'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServicesPage extends StatelessWidget {
  const _ServicesPage({required this.user, required this.onOpen});

  final AppUser user;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final List<_ServiceGroup> groups = _groups(user);
    return SafeArea(
      bottom: false,
      child: CustomScrollView(
        key: const PageStorageKey<String>('services-scroll'),
        primary: false,
        slivers: <Widget>[
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Layanan',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 5),
                  Text(
                    'Semua kebutuhan administrasi dalam satu tempat.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.muted,
                        ),
                  ),
                ],
              ),
            ),
          ),
          if (!user.emailVerified)
            const SliverPadding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
              sliver: SliverToBoxAdapter(child: _ServiceLockedNotice()),
            ),
          for (final _ServiceGroup group in groups)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
              sliver: SliverToBoxAdapter(
                child: _ServiceSection(
                  group: group,
                  enabled: user.emailVerified,
                  accent: AppColors.forRole(user.role),
                  onOpen: onOpen,
                ),
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 28)),
        ],
      ),
    );
  }

  List<_ServiceGroup> _groups(AppUser user) => <_ServiceGroup>[
        _ServiceGroup(
          'Administrasi',
          <_ServiceItem>[
            const _ServiceItem('anggota', 'Anggota', Icons.groups_2_outlined),
            const _ServiceItem('arsip', 'Arsip surat', Icons.archive_outlined),
            _ServiceItem(
              'pengajuan-berkas',
              user.isCabang ? 'Verifikasi' : 'Pengajuan',
              Icons.outbox_outlined,
            ),
            _ServiceItem(
              'berkas-pimpinan',
              user.isCabang ? 'Berkas Cabang' : 'Berkas PAC',
              Icons.folder_copy_outlined,
            ),
            if (user.isCabang)
              const _ServiceItem(
                'berkas-sp',
                'Berkas SP',
                Icons.verified_outlined,
              ),
            if (!user.isCabang)
              const _ServiceItem(
                'pengajuan-reference',
                'Referensi',
                Icons.library_books_outlined,
              ),
          ],
        ),
        _ServiceGroup(
          'Organisasi',
          <_ServiceItem>[
            const _ServiceItem(
              'wilayah-ranting',
              'Ranting',
              Icons.account_tree_outlined,
            ),
            const _ServiceItem(
              'wilayah-pk',
              'Komisariat',
              Icons.school_outlined,
            ),
            if (user.isCabang)
              const _ServiceItem(
                'agenda-kegiatan',
                'Agenda',
                Icons.event_note_outlined,
              ),
            const _ServiceItem(
              'presensi',
              'Presensi',
              Icons.qr_code_2_rounded,
            ),
            const _ServiceItem(
              'periods',
              'Periode',
              Icons.calendar_month_outlined,
            ),
            const _ServiceItem(
              'activity',
              'Aktivitas',
              Icons.history_rounded,
            ),
          ],
        ),
        if (user.isCabang)
          const _ServiceGroup(
            'Sistem Cabang',
            <_ServiceItem>[
              _ServiceItem('users', 'Pengguna', Icons.manage_accounts_outlined),
              _ServiceItem(
                'email-logs',
                'Log email',
                Icons.mark_email_read_outlined,
              ),
              _ServiceItem('backups', 'Backup', Icons.storage_rounded),
            ],
          ),
      ];
}

class _ServiceSection extends StatelessWidget {
  const _ServiceSection({
    required this.group,
    required this.enabled,
    required this.accent,
    required this.onOpen,
  });

  final _ServiceGroup group;
  final bool enabled;
  final Color accent;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(group.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              const double spacing = 10;
              const double minItemWidth = 74;
              final int columns =
                  ((constraints.maxWidth + spacing) / (minItemWidth + spacing))
                      .floor()
                      .clamp(1, 4);
              final double itemWidth =
                  (constraints.maxWidth - spacing * (columns - 1)) / columns;
              return Wrap(
                alignment: WrapAlignment.start,
                spacing: spacing,
                runSpacing: 14,
                children: group.items
                    .map<Widget>(
                      (_ServiceItem item) => SizedBox(
                        width: itemWidth,
                        height: 112,
                        child: _ServiceTile(
                          item: item,
                          accent: accent,
                          enabled: enabled,
                          onTap: () => onOpen(item.key),
                        ),
                      ),
                    )
                    .toList(growable: false),
              );
            },
          ),
        ],
      );
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.item,
    required this.accent,
    required this.enabled,
    required this.onTap,
  });

  final _ServiceItem item;
  final Color accent;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color tileColor =
        enabled ? _serviceColor(item.key, accent) : AppColors.muted;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 4),
          child: Column(
            children: <Widget>[
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: enabled
                      ? Color.alphaBlend(
                          tileColor.withOpacity(.1), Colors.white)
                      : AppColors.surfaceSoft,
                  border: Border.all(
                    color:
                        enabled ? tileColor.withOpacity(.16) : AppColors.border,
                  ),
                  borderRadius: BorderRadius.circular(19),
                  boxShadow: enabled
                      ? <BoxShadow>[
                          BoxShadow(
                            color: tileColor.withOpacity(.09),
                            blurRadius: 12,
                            offset: const Offset(0, 5),
                          ),
                        ]
                      : null,
                ),
                child: Icon(
                  item.icon,
                  color: enabled ? tileColor : AppColors.muted,
                  size: 26,
                ),
              ),
              const SizedBox(height: 9),
              Text(
                item.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: enabled ? AppColors.ink : AppColors.muted,
                      fontWeight: FontWeight.w800,
                      height: 1.15,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _serviceColor(String key, Color fallback) => switch (key) {
        'anggota' || 'users' => AppColors.cabang,
        'arsip' || 'berkas-pimpinan' || 'backups' => AppColors.purple,
        'pengajuan-berkas' || 'berkas-sp' => AppColors.pac,
        'presensi' || 'email-logs' => AppColors.aqua,
        'agenda-kegiatan' || 'periods' => AppColors.warning,
        'wilayah-ranting' || 'wilayah-pk' => AppColors.pacBright,
        _ => fallback,
      };
}

class _ServiceLockedNotice extends StatelessWidget {
  const _ServiceLockedNotice();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF8E7),
          borderRadius: BorderRadius.circular(18),
        ),
        child: const Row(
          children: <Widget>[
            Icon(Icons.lock_outline_rounded, color: AppColors.warning),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Verifikasi email SSO untuk membuka layanan operasional.',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
}

class _ServiceGroup {
  const _ServiceGroup(this.title, this.items);

  final String title;
  final List<_ServiceItem> items;
}

class _ServiceItem {
  const _ServiceItem(this.key, this.label, this.icon);

  final String key;
  final String label;
  final IconData icon;
}
