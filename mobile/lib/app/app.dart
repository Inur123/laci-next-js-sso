import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/application/auth_controller.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/home/presentation/home_shell.dart';
import '../features/periods/application/period_controller.dart';
import '../features/splash/presentation/splash_page.dart';
import 'providers.dart';
import 'theme/app_theme.dart';

class LaciApp extends ConsumerStatefulWidget {
  const LaciApp({super.key});

  @override
  ConsumerState<LaciApp> createState() => _LaciAppState();
}

class _LaciAppState extends ConsumerState<LaciApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final AuthState auth = ref.read(authControllerProvider);
    if (!auth.isAuthenticated) return;

    final bool foreground = state == AppLifecycleState.resumed;
    ref.read(realtimeControllerProvider.notifier).setForeground(foreground);
    if (!foreground) return;

    unawaited(
      ref.read(authControllerProvider.notifier).revalidateSession(),
    );
    if (auth.user!.emailVerified) {
      unawaited(ref.read(periodControllerProvider.notifier).load());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AuthState auth = ref.watch(authControllerProvider);
    final String authorizationEpoch = auth.user == null
        ? auth.status.name
        : <String>[
            'authenticated',
            auth.user!.id,
            auth.user!.role.name,
            auth.user!.emailVerified.toString(),
          ].join(':');
    return MaterialApp(
      key: ValueKey<String>('navigation:$authorizationEpoch'),
      title: 'Laci Digital',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(auth.user?.role),
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 240),
        child: switch (auth.status) {
          AuthStatus.initializing => const SplashPage(key: ValueKey('splash')),
          AuthStatus.authenticated => HomeShell(
              key: const ValueKey('home'),
              user: auth.user!,
            ),
          _ => const LoginPage(key: ValueKey('login')),
        },
      ),
    );
  }
}
