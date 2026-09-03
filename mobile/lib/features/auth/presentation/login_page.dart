import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../app/theme/app_theme.dart';
import '../application/auth_controller.dart';

class LoginPage extends ConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);
    final AuthController controller = ref.read(authControllerProvider.notifier);
    final bool loading = auth.status == AuthStatus.authenticating;
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) =>
            SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Column(
              children: <Widget>[
                _LoginHero(height: constraints.maxHeight * 0.38),
                Transform.translate(
                  offset: const Offset(0, -28),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 520),
                      child: Container(
                        width: double.infinity,
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: <BoxShadow>[
                            BoxShadow(
                              color: AppColors.ink.withOpacity(0.07),
                              blurRadius: 26,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            Text(
                              'Masuk ke\nLaci Digital',
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(fontSize: 27),
                            ),
                            const SizedBox(height: 9),
                            Text(
                              'Gunakan akun SSO IPNU IPPNU untuk mengakses layanan administrasi.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: AppColors.muted),
                            ),
                            if (auth.message != null) ...<Widget>[
                              const SizedBox(height: 16),
                              _LoginNotice(
                                message: auth.message!,
                                onOpenSettings:
                                    auth.errorCode == 'LOCATION_DENIED_FOREVER'
                                        ? controller.openLocationSettings
                                        : null,
                              ),
                            ],
                            const SizedBox(height: 24),
                            FilledButton(
                              onPressed: loading ? null : controller.login,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: <Widget>[
                                  if (loading)
                                    const SizedBox.square(
                                      dimension: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.4,
                                        color: Colors.white,
                                      ),
                                    )
                                  else
                                    Container(
                                      width: 31,
                                      height: 31,
                                      padding: const EdgeInsets.all(4),
                                      decoration: const BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Image.asset(
                                        'assets/images/logo_sso.webp',
                                        fit: BoxFit.contain,
                                      ),
                                    ),
                                  const SizedBox(width: 11),
                                  Text(loading
                                      ? 'Menghubungkan SSO…'
                                      : 'Masuk dengan SSO'),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: <Widget>[
                                Icon(
                                  Icons.location_on_outlined,
                                  size: 17,
                                  color: AppColors.muted,
                                ),
                                SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    'Lokasi dicatat untuk keamanan aktivitas.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Transform.translate(
                  offset: const Offset(0, -12),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 520),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        child: _LoginAssurance(
                          minHeight:
                              (constraints.maxHeight * .245).clamp(180, 250),
                        ),
                      ),
                    ),
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

class _LoginHero extends StatelessWidget {
  const _LoginHero({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        height: height.clamp(250, 340),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: <Color>[
              AppColors.pacDark,
              AppColors.pac,
              AppColors.pacBright,
            ],
            stops: <double>[0, .65, 1],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: Stack(
            children: <Widget>[
              Positioned(
                right: -38,
                top: 38,
                child: Container(
                  width: 190,
                  height: 190,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withOpacity(0.1),
                      width: 28,
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 26, 24, 58),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: <Widget>[
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: const Icon(
                        Icons.inventory_2_outlined,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(height: 15),
                    const Text(
                      'Administrasi organisasi\ndalam genggaman.',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        height: 1.18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}

class _LoginNotice extends StatelessWidget {
  const _LoginNotice({required this.message, this.onOpenSettings});

  final String message;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7E8),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Icon(
                  Icons.info_outline_rounded,
                  size: 20,
                  color: AppColors.warning,
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    message,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF875707),
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
              ],
            ),
            if (onOpenSettings != null) ...<Widget>[
              const SizedBox(height: 7),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onOpenSettings,
                  icon: const Icon(Icons.settings_outlined, size: 18),
                  label: const Text('Buka pengaturan'),
                ),
              ),
            ],
          ],
        ),
      );
}

class _LoginAssurance extends StatelessWidget {
  const _LoginAssurance({required this.minHeight});

  final double minHeight;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        constraints: BoxConstraints(minHeight: minHeight),
        padding: const EdgeInsets.fromLTRB(18, 17, 18, 18),
        decoration: BoxDecoration(
          color: AppColors.pac.withOpacity(.055),
          border: Border.all(color: AppColors.pac.withOpacity(.13)),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Satu akun, seluruh administrasi',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 5),
                Text(
                  'Masuk sekali dan sesi tetap tersimpan sampai Anda memilih logout.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 15),
                const Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    _AssuranceChip(
                      icon: Icons.shield_outlined,
                      label: 'Sesi aman',
                    ),
                    _AssuranceChip(
                      icon: Icons.sync_rounded,
                      label: 'Data tersinkron',
                    ),
                    _AssuranceChip(
                      icon: Icons.badge_outlined,
                      label: 'Sesuai peran',
                    ),
                  ],
                ),
              ],
            ),
            const Padding(
              padding: EdgeInsets.only(top: 22),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Icon(
                    Icons.lock_outline_rounded,
                    size: 16,
                    color: AppColors.pac,
                  ),
                  SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      'Terhubung aman ke SSO IPNU IPPNU',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

class _AssuranceChip extends StatelessWidget {
  const _AssuranceChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(13),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 17, color: AppColors.pac),
            const SizedBox(width: 6),
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      );
}
