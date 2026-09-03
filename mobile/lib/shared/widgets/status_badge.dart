import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final String value = status.toUpperCase();
    final Color color = switch (value) {
      'DITERIMA' || 'SENT' || 'OPEN' || 'AKTIF' => AppColors.pac,
      'DITOLAK' || 'FAILED' || 'INACTIVE' || 'TUTUP' => AppColors.danger,
      'PENDING' || 'MENDATANG' => AppColors.warning,
      'BERLANGSUNG' => AppColors.cabang,
      _ => AppColors.muted,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(0.22)),
      ),
      child: Text(
        value.replaceAll('_', ' '),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
