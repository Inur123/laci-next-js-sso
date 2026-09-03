import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../app/theme/app_theme.dart';
import 'app_layout.dart';

class AppLoadingList extends StatelessWidget {
  const AppLoadingList({super.key, this.items = 5});

  final int items;

  @override
  Widget build(BuildContext context) => AppConstrainedContent(
        child: AppShimmer(
          child: ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.page),
            itemCount: items,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, __) => const AppLoadingCard(),
          ),
        ),
      );
}

class AppShimmer extends StatelessWidget {
  const AppShimmer({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => Shimmer.fromColors(
        baseColor: const Color(0xFFDCE8E1),
        highlightColor: const Color(0xFFF9FCFA),
        period: const Duration(milliseconds: 1250),
        child: ExcludeSemantics(child: child),
      );
}

class AppShimmerBox extends StatelessWidget {
  const AppShimmerBox({
    required this.width,
    required this.height,
    this.radius = 10,
    super.key,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(radius),
        ),
      );
}

class AppLoadingCard extends StatelessWidget {
  const AppLoadingCard({super.key});

  @override
  Widget build(BuildContext context) => Container(
        height: 108,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          children: <Widget>[
            AppShimmerBox(width: 48, height: 48, radius: 16),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  AppShimmerBox(width: 180, height: 15),
                  SizedBox(height: 11),
                  AppShimmerBox(width: 112, height: 11),
                  SizedBox(height: 8),
                  AppShimmerBox(width: 220, height: 11),
                ],
              ),
            ),
          ],
        ),
      );
}

class AppLoadingDetail extends StatelessWidget {
  const AppLoadingDetail({super.key});

  @override
  Widget build(BuildContext context) => AppConstrainedContent(
        child: AppShimmer(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.page),
            children: const <Widget>[
              AppShimmerBox(width: double.infinity, height: 128, radius: 24),
              SizedBox(height: 16),
              AppShimmerBox(width: double.infinity, height: 220, radius: 20),
              SizedBox(height: 16),
              AppShimmerBox(width: double.infinity, height: 92, radius: 20),
            ],
          ),
        ),
      );
}

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    required this.title,
    required this.message,
    this.icon = Icons.inventory_2_outlined,
    this.accent,
    this.action,
    super.key,
  });

  final String title;
  final String message;
  final IconData icon;
  final Color? accent;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final color = accent ?? Theme.of(context).colorScheme.primary;
    return AppConstrainedContent(
      maxWidth: 520,
      alignment: Alignment.center,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(icon, color: color, size: 54),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 7),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.muted,
                      height: 1.45,
                    ),
              ),
              if (action != null) ...<Widget>[
                const SizedBox(height: 18),
                action!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class AppErrorState extends StatelessWidget {
  const AppErrorState({
    required this.message,
    required this.onRetry,
    super.key,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => AppEmptyState(
        icon: Icons.cloud_off_outlined,
        accent: AppColors.danger,
        title: 'Data belum dapat dimuat',
        message: message,
        action: OutlinedButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Coba lagi'),
        ),
      );
}
