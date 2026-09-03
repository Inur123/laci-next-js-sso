import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

/// Keeps content comfortable on phones and prevents forms/lists stretching
/// edge-to-edge on tablets, split-screen, and landscape windows.
class AppConstrainedContent extends StatelessWidget {
  const AppConstrainedContent({
    required this.child,
    this.maxWidth = 920,
    this.alignment = Alignment.topCenter,
    super.key,
  });

  final Widget child;
  final double maxWidth;
  final AlignmentGeometry alignment;

  @override
  Widget build(BuildContext context) => Align(
        alignment: alignment,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: SizedBox(width: double.infinity, child: child),
        ),
      );
}

class AppPageIntro extends StatelessWidget {
  const AppPageIntro({
    required this.title,
    required this.message,
    required this.icon,
    this.accent,
    this.trailing,
    super.key,
  });

  final String title;
  final String message;
  final IconData icon;
  final Color? accent;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final Color color = accent ?? Theme.of(context).colorScheme.primary;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color.alphaBlend(color.withOpacity(0.07), Colors.white),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: color.withOpacity(0.16)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withOpacity(0.13),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color, size: 23),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 3),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.muted,
                      ),
                ),
              ],
            ),
          ),
          if (trailing != null) ...<Widget>[
            const SizedBox(width: 8),
            trailing!,
          ],
        ],
      ),
    );
  }
}

class AppSectionTitle extends StatelessWidget {
  const AppSectionTitle({
    required this.title,
    this.subtitle,
    this.trailing,
    super.key,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                if (subtitle != null) ...<Widget>[
                  const SizedBox(height: 3),
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...<Widget>[
            const SizedBox(width: 12),
            trailing!,
          ],
        ],
      );
}

/// Responsive field cluster: one column on compact phones, multiple equal
/// columns only when each field can keep a readable minimum width.
class AppResponsiveFields extends StatelessWidget {
  const AppResponsiveFields({
    required this.children,
    this.minFieldWidth = 250,
    this.spacing = 10,
    super.key,
  });

  final List<Widget> children;
  final double minFieldWidth;
  final double spacing;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final int columns =
              (constraints.maxWidth / minFieldWidth).floor().clamp(1, 3);
          final double width =
              (constraints.maxWidth - (spacing * (columns - 1))) / columns;
          return Wrap(
            spacing: spacing,
            runSpacing: spacing,
            children: children
                .map<Widget>(
                    (Widget child) => SizedBox(width: width, child: child))
                .toList(growable: false),
          );
        },
      );
}

/// Responsive card grid that redistributes the final row instead of leaving
/// an empty column. A final row with one item therefore becomes full-width,
/// while two, three, or four items divide the available width evenly.
class AppAdaptiveGrid extends StatelessWidget {
  const AppAdaptiveGrid({
    required this.children,
    this.minItemWidth = 150,
    this.maxColumns = 4,
    this.spacing = 10,
    this.runSpacing = 10,
    this.fillLastRow = true,
    super.key,
  });

  final List<Widget> children;
  final double minItemWidth;
  final int maxColumns;
  final double spacing;
  final double runSpacing;
  final bool fillLastRow;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final int availableColumns =
            ((constraints.maxWidth + spacing) / (minItemWidth + spacing))
                .floor()
                .clamp(1, maxColumns);
        final int columns = availableColumns.clamp(1, children.length);
        final int remainder = children.length % columns;
        final int lastRowCount = remainder == 0 ? columns : remainder;
        final int lastRowStart = children.length - lastRowCount;
        final double regularWidth =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;
        final double finalRowWidth = fillLastRow
            ? (constraints.maxWidth - spacing * (lastRowCount - 1)) /
                lastRowCount
            : regularWidth;
        return Wrap(
          spacing: spacing,
          runSpacing: runSpacing,
          children: <Widget>[
            for (int index = 0; index < children.length; index++)
              SizedBox(
                width: index >= lastRowStart ? finalRowWidth : regularWidth,
                child: children[index],
              ),
          ],
        );
      },
    );
  }
}

/// One pagination treatment for every list in the application.
///
/// The compact page fraction matches the resource lists while the outlined
/// controls keep the previous/next affordances visible without resembling a
/// bottom navigation bar.
class AppPagination extends StatelessWidget {
  const AppPagination({
    required this.page,
    required this.totalPages,
    required this.onPage,
    this.loading = false,
    this.padding = const EdgeInsets.only(top: 6),
    super.key,
  });

  final int page;
  final int totalPages;
  final ValueChanged<int> onPage;
  final bool loading;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final int safeTotal = totalPages < 1 ? 1 : totalPages;
    if (safeTotal <= 1) return const SizedBox.shrink();
    final int safePage = page.clamp(1, safeTotal);
    return Padding(
      padding: padding,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          IconButton.outlined(
            tooltip: 'Halaman sebelumnya',
            onPressed:
                loading || safePage <= 1 ? null : () => onPage(safePage - 1),
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 76),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                '$safePage / $safeTotal',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelLarge,
              ),
            ),
          ),
          IconButton.outlined(
            tooltip: 'Halaman berikutnya',
            onPressed: loading || safePage >= safeTotal
                ? null
                : () => onPage(safePage + 1),
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}
