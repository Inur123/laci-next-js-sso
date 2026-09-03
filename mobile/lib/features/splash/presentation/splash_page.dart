import 'package:flutter/material.dart';

import '../../../app/theme/app_theme.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 650),
  )..forward();
  late final Animation<double> _opacity = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );
  late final Animation<double> _scale =
      Tween<double>(begin: 0.94, end: 1).animate(
    CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: Semantics(
            image: true,
            label: 'Logo Laci Digital',
            child: FadeTransition(
              opacity: _opacity,
              child: ScaleTransition(
                scale: _scale,
                child: Image.asset(
                  'assets/images/logo_laci.webp',
                  width: 148,
                  height: 148,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
        ),
        bottomNavigationBar: const SafeArea(
          minimum: EdgeInsets.only(bottom: 28),
          child: SizedBox(
            height: 3,
            child: Center(
              child: SizedBox(
                width: 44,
                child: LinearProgressIndicator(
                  color: AppColors.pacBright,
                  backgroundColor: AppColors.softGreen,
                ),
              ),
            ),
          ),
        ),
      );
}
