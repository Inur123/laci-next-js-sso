import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_theme.dart';
import '../../../shared/models/json_value.dart';
import '../../../shared/widgets/app_layout.dart';

final DateFormat adminDateFormat = DateFormat('dd MMM yyyy, HH:mm', 'id_ID');

String formatAdminDate(Object? value) {
  final DateTime? date = dateTimeValue(value)?.toLocal();
  return date == null ? '—' : adminDateFormat.format(date);
}

class AdminSearchField extends StatelessWidget {
  const AdminSearchField({
    required this.controller,
    required this.hint,
    required this.onSubmitted,
    super.key,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        textInputAction: TextInputAction.search,
        onSubmitted: onSubmitted,
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: const Icon(Icons.search_rounded),
          suffixIcon: controller.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Hapus pencarian',
                  onPressed: () {
                    controller.clear();
                    onSubmitted('');
                  },
                  icon: const Icon(Icons.close_rounded),
                ),
        ),
      );
}

class AdminSummaryGrid extends StatelessWidget {
  const AdminSummaryGrid({required this.items, super.key});

  final List<AdminSummaryItem> items;

  @override
  Widget build(BuildContext context) => AppAdaptiveGrid(
        minItemWidth: 160,
        maxColumns: 3,
        children: items
            .map<Widget>(
              (AdminSummaryItem item) => SizedBox(
                height: 88,
                child: Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: Color.alphaBlend(
                      item.color.withOpacity(.055),
                      AppColors.surface,
                    ),
                    border: Border.all(color: item.color.withOpacity(.16)),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: <Widget>[
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: item.color.withOpacity(.13),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(item.icon, color: item.color, size: 22),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              item.value.toString(),
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(
                                    color: item.color,
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                            Text(
                              item.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(growable: false),
      );
}

class AdminSummaryItem {
  const AdminSummaryItem(this.label, this.value, this.icon, this.color);

  final String label;
  final int value;
  final IconData icon;
  final Color color;
}

class AdminPagination extends StatelessWidget {
  const AdminPagination({
    required this.page,
    required this.totalPages,
    required this.onPage,
    super.key,
  });

  final int page;
  final int totalPages;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) => AppPagination(
        page: page,
        totalPages: totalPages,
        onPage: onPage,
      );
}

class AdminLabelValue extends StatelessWidget {
  const AdminLabelValue({
    required this.label,
    required this.value,
    super.key,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final Widget labelWidget = Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.muted,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .5,
                  ),
            );
            final Widget valueWidget = SelectableText(
              value.isEmpty ? '—' : value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            );
            if (constraints.maxWidth < 420) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  labelWidget,
                  const SizedBox(height: 4),
                  valueWidget,
                ],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                SizedBox(width: 132, child: labelWidget),
                Expanded(child: valueWidget),
              ],
            );
          },
        ),
      );
}

void showAdminMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
