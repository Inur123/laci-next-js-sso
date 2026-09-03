import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_theme.dart';
import '../../../shared/models/json_value.dart';
import '../../../shared/widgets/app_layout.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/app_user_avatar.dart';
import '../../auth/domain/app_user.dart';
import '../../periods/domain/app_period.dart';
import '../../realtime/application/realtime_controller.dart';
import '../application/dashboard_controller.dart';

typedef DashboardDestinationCallback = void Function(String key);

class DashboardPage extends ConsumerWidget {
  const DashboardPage({
    required this.user,
    required this.onOpen,
    this.onProfile,
    this.activePeriod,
    this.viewPeriod,
    this.onSelectPeriod,
    this.realtimeConnection = RealtimeConnection.connecting,
    super.key,
  });

  final AppUser user;
  final DashboardDestinationCallback onOpen;
  final VoidCallback? onProfile;
  final AppPeriod? activePeriod;
  final AppPeriod? viewPeriod;
  final VoidCallback? onSelectPeriod;
  final RealtimeConnection realtimeConnection;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final DashboardState state = ref.watch(dashboardControllerProvider);
    final DashboardController controller =
        ref.read(dashboardControllerProvider.notifier);
    final JsonMap personal = jsonMap(state.data['personal']);
    final JsonMap monitoring = jsonMap(state.data['monitoring']);
    final List<_DashboardMetric> metrics = _metrics(user, personal);
    return RefreshIndicator(
      onRefresh: controller.load,
      child: CustomScrollView(
        key: const PageStorageKey<String>('dashboard-scroll'),
        primary: false,
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: _MobileHeader(
              user: user,
              activePeriod: activePeriod,
              viewPeriod: viewPeriod,
              onSelectPeriod: onSelectPeriod,
              onProfile: onProfile,
              realtimeConnection: realtimeConnection,
            ),
          ),
          if (!user.emailVerified)
            const SliverPadding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
              sliver: SliverToBoxAdapter(child: _VerificationNotice()),
            ),
          if (state.loading && state.data.isEmpty)
            const SliverToBoxAdapter(
              child: SizedBox(height: 380, child: AppLoadingList(items: 3)),
            )
          else if (state.error != null && state.data.isEmpty)
            SliverToBoxAdapter(
              child: SizedBox(
                height: 380,
                child: AppErrorState(
                  message: state.error!,
                  onRetry: controller.load,
                ),
              ),
            )
          else ...<Widget>[
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
              sliver: SliverToBoxAdapter(
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        'Akses cepat',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    TextButton(
                      onPressed: () => onOpen('activity'),
                      child: const Text('Aktivitas'),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
              sliver: SliverToBoxAdapter(
                child: _MetricsGrid(
                  metrics: metrics,
                  onOpen: onOpen,
                  enabled: user.emailVerified,
                ),
              ),
            ),
            if (jsonMapList(personal['trend']).isNotEmpty)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: _TrendCard(items: jsonMapList(personal['trend'])),
                ),
              ),
            if (user.isCabang && monitoring.isNotEmpty)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: _MonitoringSection(data: monitoring),
                ),
              ),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }

  List<_DashboardMetric> _metrics(AppUser user, JsonMap data) {
    final List<_DashboardMetric> common = <_DashboardMetric>[
      _DashboardMetric('Anggota', intValue(data['anggota']),
          Icons.groups_2_outlined, 'anggota'),
      _DashboardMetric('Arsip surat', intValue(data['surat']),
          Icons.inventory_2_outlined, 'arsip'),
      _DashboardMetric('Pengajuan', intValue(data['pengajuan']),
          Icons.outbox_outlined, 'pengajuan-berkas'),
      _DashboardMetric('Berkas pimpinan', intValue(data['berkasPimpinan']),
          Icons.folder_copy_outlined, 'berkas-pimpinan'),
      _DashboardMetric('Presensi', intValue(data['presensi']),
          Icons.qr_code_2_rounded, 'presensi'),
      _DashboardMetric('Periode', intValue(data['periode']),
          Icons.calendar_month_outlined, 'periods'),
    ];
    if (user.isCabang) {
      common.insertAll(3, <_DashboardMetric>[
        _DashboardMetric('PAC aktif', intValue(data['userCount']),
            Icons.account_tree_outlined, 'users'),
        _DashboardMetric('Berkas SP', intValue(data['berkasSP']),
            Icons.verified_outlined, 'berkas-sp'),
        _DashboardMetric('Agenda', intValue(data['kegiatan']),
            Icons.event_note_outlined, 'agenda-kegiatan'),
      ]);
    }
    return common;
  }
}

class _MobileHeader extends StatelessWidget {
  const _MobileHeader({
    required this.user,
    required this.activePeriod,
    required this.viewPeriod,
    required this.onSelectPeriod,
    required this.onProfile,
    required this.realtimeConnection,
  });

  final AppUser user;
  final AppPeriod? activePeriod;
  final AppPeriod? viewPeriod;
  final VoidCallback? onSelectPeriod;
  final VoidCallback? onProfile;
  final RealtimeConnection realtimeConnection;

  @override
  Widget build(BuildContext context) {
    final Color accent = AppColors.forRole(user.role);
    final Color dark = AppColors.darkForRole(user.role);
    final Color bright = AppColors.brightForRole(user.role);
    final String periodName = viewPeriod?.name ??
        activePeriod?.name ??
        (user.emailVerified ? 'Belum ada periode' : 'Akses terbatas');
    final bool connected = realtimeConnection == RealtimeConnection.connected;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: <Color>[dark, accent, bright],
          stops: const <double>[0, .62, 1],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(32),
        ),
      ),
      child: Stack(
        children: <Widget>[
          const Positioned(
            right: -22,
            bottom: 12,
            child: _DrawerMotif(),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              MediaQuery.paddingOf(context).top + 16,
              20,
              24,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    const Text(
                      'LACI DIGITAL',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.4,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: connected
                            ? const Color(0xFF8FF0AE)
                            : AppColors.gold,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const Spacer(),
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: onProfile,
                      child: AppUserAvatar(
                        user: user,
                        radius: 21,
                        backgroundColor: Colors.white.withOpacity(0.16),
                        foregroundColor: Colors.white,
                        textStyle: const TextStyle(
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 26),
                const Text(
                  'Selamat datang,',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(
                  user.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 25,
                    height: 1.1,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.6,
                  ),
                ),
                const SizedBox(height: 17),
                Row(
                  children: <Widget>[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.14),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        user.role.shortLabel,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(13),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(13),
                          onTap: onSelectPeriod,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 9,
                            ),
                            child: Row(
                              children: <Widget>[
                                Icon(
                                  Icons.calendar_today_rounded,
                                  size: 15,
                                  color: accent,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    periodName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.ink,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                if (onSelectPeriod != null)
                                  const Icon(
                                    Icons.expand_more_rounded,
                                    size: 18,
                                    color: AppColors.muted,
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DrawerMotif extends StatelessWidget {
  const _DrawerMotif();

  @override
  Widget build(BuildContext context) => Opacity(
        opacity: 0.12,
        child: SizedBox(
          width: 150,
          height: 94,
          child: Stack(
            alignment: Alignment.center,
            children: <Widget>[
              for (final double top in <double>[0, 28, 56])
                Positioned(
                  top: top,
                  child: Container(
                    width: 132,
                    height: 22,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white, width: 2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: Container(
                      width: 30,
                      height: 3,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
}

class _VerificationNotice extends StatelessWidget {
  const _VerificationNotice();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBEB),
          border: Border.all(color: const Color(0xFFFDE68A)),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(Icons.lock_outline_rounded,
                color: Color(0xFFB45309), size: 21),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Akses fitur dibatasi sampai identitas email Anda terverifikasi.',
                style: TextStyle(
                  color: Color(0xFF92400E),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
}

class _DashboardMetric {
  const _DashboardMetric(this.label, this.value, this.icon, this.destination);

  final String label;
  final int value;
  final IconData icon;
  final String? destination;
}

class _MetricsGrid extends StatelessWidget {
  const _MetricsGrid({
    required this.metrics,
    required this.onOpen,
    required this.enabled,
  });

  final List<_DashboardMetric> metrics;
  final ValueChanged<String> onOpen;
  final bool enabled;

  @override
  Widget build(BuildContext context) => AppAdaptiveGrid(
        minItemWidth: 150,
        maxColumns: 3,
        children: metrics
            .map<Widget>(
              (_DashboardMetric metric) => SizedBox(
                height: 96,
                child: _MetricCard(
                  metric: metric,
                  onTap: enabled && metric.destination != null
                      ? () => onOpen(metric.destination!)
                      : null,
                ),
              ),
            )
            .toList(growable: false),
      );
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric, this.onTap});

  final _DashboardMetric metric;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Color accent = switch (metric.destination) {
      'anggota' || 'users' => AppColors.cabang,
      'arsip' || 'berkas-pimpinan' => AppColors.purple,
      'pengajuan-berkas' || 'berkas-sp' => AppColors.pac,
      'presensi' => AppColors.aqua,
      'periods' || 'agenda-kegiatan' => AppColors.warning,
      _ => Theme.of(context).colorScheme.primary,
    };
    return Card(
      color: Color.alphaBlend(accent.withOpacity(.055), Colors.white),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(metric.icon, size: 19, color: Colors.white),
                  ),
                  const Spacer(),
                  Text(
                    metric.value.toString(),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w900,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                  ),
                  if (onTap != null) ...<Widget>[
                    const SizedBox(width: 2),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 17,
                      color: AppColors.muted,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Text(
                metric.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppColors.muted,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrendCard extends StatelessWidget {
  const _TrendCard({required this.items});

  final List<JsonMap> items;

  @override
  Widget build(BuildContext context) {
    final Color color = Theme.of(context).colorScheme.primary;
    final List<FlSpot> spots = <FlSpot>[
      for (int index = 0; index < items.length; index++)
        FlSpot(index.toDouble(), intValue(items[index]['value']).toDouble()),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('Arsip enam bulan',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('Aktivitas surat pada periode tampilan',
                style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 18),
            SizedBox(
              height: 150,
              child: LineChart(
                LineChartData(
                  minY: 0,
                  gridData: const FlGridData(show: false),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles: const AxisTitles(),
                    topTitles: const AxisTitles(),
                    rightTitles: const AxisTitles(),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 26,
                        getTitlesWidget: (double value, TitleMeta meta) {
                          final int index = value.round();
                          if (index < 0 || index >= items.length) {
                            return const SizedBox.shrink();
                          }
                          return Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              stringValue(items[index]['name']),
                              style: const TextStyle(
                                  fontSize: 10, color: AppColors.muted),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  lineBarsData: <LineChartBarData>[
                    LineChartBarData(
                      spots: spots,
                      isCurved: true,
                      color: color,
                      barWidth: 3,
                      dotData: const FlDotData(show: true),
                      belowBarData: BarAreaData(
                        show: true,
                        color: color.withOpacity(0.08),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MonitoringSection extends StatelessWidget {
  const _MonitoringSection({required this.data});

  final JsonMap data;

  @override
  Widget build(BuildContext context) {
    final JsonMap global = jsonMap(data['global']);
    final List<JsonMap> leaderboard = jsonMapList(data['leaderboard']);
    final JsonMap perkaderan = jsonMap(global['perkaderan']);
    final JsonMap pendidikan = jsonMap(global['pendidikan']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('Monitoring Cabang',
            style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: _CompactStatsGrid(
              items: <_CompactStat>[
                _CompactStat('Anggota', intValue(global['totalAnggota'])),
                _CompactStat('Administrasi', intValue(global['totalSurat'])),
                _CompactStat('PAC aktif', intValue(global['totalPAC'])),
                _CompactStat(
                  'Verifikasi',
                  intValue(global['verifikasiPending']),
                ),
              ],
            ),
          ),
        ),
        if (perkaderan.isNotEmpty) ...<Widget>[
          const SizedBox(height: 12),
          _BreakdownCard(
            title: 'Perkaderan aktif',
            icon: Icons.school_outlined,
            values: perkaderan,
          ),
        ],
        if (pendidikan.isNotEmpty) ...<Widget>[
          const SizedBox(height: 12),
          _BreakdownCard(
            title: 'Pendidikan anggota',
            icon: Icons.account_balance_outlined,
            values: pendidikan,
          ),
        ],
        if (leaderboard.isNotEmpty) ...<Widget>[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('PAC teraktif',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 10),
                  for (int index = 0;
                      index < leaderboard.take(5).length;
                      index++)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: AppColors.softBlue,
                        child: Text('${index + 1}'),
                      ),
                      title: Text(stringValue(leaderboard[index]['name'])),
                      subtitle: Builder(builder: (BuildContext context) {
                        final JsonMap stats =
                            jsonMap(leaderboard[index]['stats']);
                        return Text(
                          'Anggota ${intValue(stats['anggotas'])} · Arsip ${intValue(stats['arsipSurats'])} · Pengajuan ${intValue(stats['pengajuanBerkass'])}',
                        );
                      }),
                      trailing: Text(
                        intValue(leaderboard[index]['score']).toString(),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _BreakdownCard extends StatelessWidget {
  const _BreakdownCard({
    required this.title,
    required this.icon,
    required this.values,
  });

  final String title;
  final IconData icon;
  final JsonMap values;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Icon(icon,
                      size: 20, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                ],
              ),
              const SizedBox(height: 12),
              AppAdaptiveGrid(
                minItemWidth: 130,
                maxColumns: 3,
                spacing: 8,
                runSpacing: 8,
                children: values.entries
                    .map<Widget>(
                      (MapEntry<String, dynamic> entry) => Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .primary
                              .withOpacity(0.07),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Row(
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                entry.key,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${intValue(entry.value)}',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelLarge
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(growable: false),
              ),
            ],
          ),
        ),
      );
}

class _CompactStatsGrid extends StatelessWidget {
  const _CompactStatsGrid({required this.items});

  final List<_CompactStat> items;

  @override
  Widget build(BuildContext context) => AppAdaptiveGrid(
        minItemWidth: 145,
        maxColumns: 4,
        children: items,
      );
}

class _CompactStat extends StatelessWidget {
  const _CompactStat(this.label, this.value);

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary.withOpacity(.055),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              '$value',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      );
}
