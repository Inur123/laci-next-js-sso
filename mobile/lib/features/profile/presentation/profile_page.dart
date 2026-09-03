import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/app_layout.dart';
import '../../../shared/widgets/app_user_avatar.dart';
import '../../auth/domain/app_user.dart';
import '../../periods/application/period_controller.dart';

typedef SsoProfileLauncher = Future<bool> Function(Uri uri);

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({
    required this.user,
    this.embedded = false,
    this.profileLauncher,
    super.key,
  });

  final AppUser user;
  final bool embedded;
  final SsoProfileLauncher? profileLauncher;

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  bool _openingSso = false;

  Future<void> _openSsoProfile() async {
    if (_openingSso) return;
    setState(() => _openingSso = true);
    try {
      ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
      final Uri uri = Uri.parse(ref.read(appConfigProvider).ssoProfileUrl);
      final bool opened = await (widget.profileLauncher ?? _launchSsoProfile)(
        uri,
      );
      if (!opened && mounted) {
        _showMessage('Halaman profil SSO tidak dapat dibuka.');
      }
    } on Object {
      if (mounted) _showMessage('Halaman profil SSO tidak dapat dibuka.');
    } finally {
      if (mounted) setState(() => _openingSso = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _logout() async {
    final bool confirmed = await showDialog<bool>(
          context: context,
          builder: (BuildContext dialogContext) => AlertDialog(
            icon: const Icon(Icons.logout_rounded),
            title: const Text('Keluar dari aplikasi?'),
            content: const Text(
              'Sesi pada perangkat ini akan diakhiri. Anda perlu masuk dengan SSO lagi.',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Keluar'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    if (!widget.embedded) {
      Navigator.of(context).popUntil((Route<dynamic> route) => route.isFirst);
    }
    await ref.read(authControllerProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    final PeriodState periods = ref.watch(periodControllerProvider);
    final String activePeriod = periods.activePeriod?.name ??
        (widget.user.activePeriodId == null ? 'Belum ada' : 'Memuat…');
    final Color accent = AppColors.forRole(widget.user.role);
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        title: Text(widget.embedded ? 'Akun' : 'Profil'),
      ),
      body: AppConstrainedContent(
        maxWidth: 720,
        child: ListView(
          key: const PageStorageKey<String>('profile-scroll'),
          primary: false,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: <Widget>[
            Container(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: AppColors.gradientForRole(widget.user.role),
                ),
                borderRadius: BorderRadius.circular(AppRadii.card),
              ),
              child: Column(
                children: <Widget>[
                  AppUserAvatar(
                    user: widget.user,
                    radius: 43,
                    backgroundColor: Colors.white,
                    foregroundColor: accent,
                    textStyle: const TextStyle(fontSize: 25),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    widget.user.name,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.user.email,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withOpacity(.78),
                        ),
                  ),
                  const SizedBox(height: 13),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 7,
                    runSpacing: 7,
                    children: <Widget>[
                      _AccountBadge(
                        label: widget.user.role.shortLabel,
                        icon: Icons.badge_outlined,
                        color: accent,
                      ),
                      _AccountBadge(
                        label: widget.user.emailVerified
                            ? 'Terverifikasi'
                            : 'Belum terverifikasi',
                        icon: widget.user.emailVerified
                            ? Icons.verified_rounded
                            : Icons.warning_amber_rounded,
                        color: widget.user.emailVerified
                            ? AppColors.pac
                            : AppColors.warning,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E7),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(Icons.info_outline_rounded, color: AppColors.warning),
                  SizedBox(width: 11),
                  Expanded(
                    child: Text(
                      'Data identitas berasal dari SSO dan tidak dapat diubah melalui aplikasi ini.',
                      style:
                          TextStyle(fontWeight: FontWeight.w600, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Text('Informasi akun',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            Card(
              child: Column(
                children: <Widget>[
                  _ProfileInfoTile(
                    icon: Icons.person_outline_rounded,
                    label: 'Nama',
                    value: widget.user.name,
                  ),
                  const Divider(indent: 58),
                  _ProfileInfoTile(
                    icon: Icons.alternate_email_rounded,
                    label: 'Email SSO',
                    value: widget.user.email,
                  ),
                  const Divider(indent: 58),
                  _ProfileInfoTile(
                    icon: Icons.account_tree_outlined,
                    label: 'Peran',
                    value: widget.user.isCabang
                        ? 'Sekretaris Cabang'
                        : 'Sekretaris PAC',
                  ),
                  const Divider(indent: 58),
                  _ProfileInfoTile(
                    icon: Icons.calendar_month_outlined,
                    label: 'Periode aktif',
                    value: activePeriod,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _openingSso ? null : _openSsoProfile,
              icon: _openingSso
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.open_in_new_rounded),
              label: const Text('Kelola profil di SSO'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _logout,
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Keluar dari aplikasi'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<bool> _launchSsoProfile(Uri uri) => launchUrl(
      uri,
      // Custom Tabs/Safari View memakai penyimpanan cookie browser yang sama
      // dengan login OAuth mobile (preferEphemeral: false). Dengan begitu
      // sesi SSO yang baru dipakai login dapat langsung membuka profil.
      mode: LaunchMode.inAppBrowserView,
      browserConfiguration: const BrowserConfiguration(showTitle: true),
    );

class _AccountBadge extends StatelessWidget {
  const _AccountBadge({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 15, color: color),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      );
}

class _ProfileInfoTile extends StatelessWidget {
  const _ProfileInfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
        leading: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppColors.canvas,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: AppColors.muted, size: 20),
        ),
        title: Text(label, style: Theme.of(context).textTheme.bodySmall),
        subtitle: Text(
          value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
      );
}
