import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../shared/widgets/app_layout.dart';
import '../../../../shared/widgets/app_states.dart';
import '../../domain/resource_definition.dart';
import '../../domain/resource_models.dart';

bool _hasVisibleResourceValue(Object? value) {
  if (value == null) return false;
  if (value is String) return value.trim().isNotEmpty;
  if (value is Iterable<Object?>) return value.isNotEmpty;
  if (value is Map<Object?, Object?>) return value.isNotEmpty;
  return true;
}

String resourceValueLabel(FieldDefinition field, Object? value) {
  if (value == null) return '-';
  if (field.kind == ResourceFieldKind.date ||
      field.kind == ResourceFieldKind.dateTime) {
    final DateTime? date = DateTime.tryParse(value.toString())?.toLocal();
    if (date == null) return value.toString();
    return field.kind == ResourceFieldKind.date
        ? DateFormat('d MMMM yyyy', 'id_ID').format(date)
        : DateFormat('d MMM yyyy, HH:mm', 'id_ID').format(date);
  }
  if (field.kind == ResourceFieldKind.toggle) {
    return value == true ? 'Aktif' : 'Tidak aktif';
  }
  if (value is Map) {
    final Object? label = value['name'] ?? value['nama'];
    if (label != null && label.toString().isNotEmpty) return label.toString();
    final Object? participantCount = value['dataPresensi'];
    if (participantCount != null) return '$participantCount peserta';
  }
  if (value is List) {
    if (value.isEmpty) return 'Belum ada';
    return '${value.length} entri';
  }
  if (field.options.isNotEmpty) return field.optionLabel(value);
  return value.toString().trim().isEmpty ? '-' : value.toString();
}

Color resourceStatusColor(Object? value, Color fallback) => switch (value) {
      'DITERIMA' || 'BERLANGSUNG' || 'OPEN' || true => AppColors.pac,
      'DITOLAK' || 'CLOSED' || false => AppColors.danger,
      'PENDING' || 'MENDATANG' || 'BERAKHIR_HARI_INI' => AppColors.warning,
      'SELESAI' => AppColors.muted,
      _ => fallback,
    };

class ResourceStatusBadge extends StatelessWidget {
  const ResourceStatusBadge({
    required this.label,
    required this.color,
    super.key,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: color.withOpacity(0.25)),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w800,
              ),
        ),
      );
}

class ResourceCard extends StatelessWidget {
  const ResourceCard({
    required this.definition,
    required this.item,
    required this.accent,
    required this.onTap,
    this.menu,
    this.selectable = false,
    this.selected = false,
    this.onSelected,
    this.leading,
    super.key,
  });

  final ResourceDefinition definition;
  final ResourceItem item;
  final Color accent;
  final VoidCallback onTap;
  final Widget? menu;
  final bool selectable;
  final bool selected;
  final ValueChanged<bool>? onSelected;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final FieldDefinition? statusField = _statusField();
    final List<FieldDefinition> metadata = definition.cardFields
        .where(
          (FieldDefinition field) =>
              field.key != statusField?.key &&
              _hasVisibleResourceValue(item[field.key]),
        )
        .toList(growable: false);
    return Semantics(
      button: true,
      label:
          'Buka ${definition.singular} ${item.text(definition.primaryField)}',
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            children: <Widget>[
              Positioned(
                left: 0,
                top: 20,
                bottom: 20,
                child: Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: const BorderRadius.horizontal(
                      right: Radius.circular(8),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 15, 8, 15),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    if (selectable)
                      Padding(
                        padding: const EdgeInsets.only(right: 6, top: 6),
                        child: SizedBox(
                          width: 28,
                          height: 28,
                          child: Checkbox(
                            value: selected,
                            onChanged: (bool? value) =>
                                onSelected?.call(value ?? false),
                          ),
                        ),
                      ),
                    if (leading != null)
                      leading!
                    else
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: accent.withOpacity(.1),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Icon(
                          Icons.folder_copy_outlined,
                          color: accent,
                          size: 23,
                        ),
                      ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            item.text(definition.primaryField),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(height: 1.2),
                          ),
                          if (statusField != null) ...<Widget>[
                            const SizedBox(height: 8),
                            ResourceStatusBadge(
                              label: resourceValueLabel(
                                statusField,
                                item[statusField.key],
                              ),
                              color: resourceStatusColor(
                                item[statusField.key],
                                accent,
                              ),
                            ),
                          ],
                          if (metadata.isNotEmpty) ...<Widget>[
                            const SizedBox(height: 11),
                            Wrap(
                              spacing: 12,
                              runSpacing: 7,
                              children: metadata
                                  .map<Widget>(
                                    (FieldDefinition field) => _Metadata(
                                      label: field.label,
                                      value: resourceValueLabel(
                                        field,
                                        item[field.key],
                                      ),
                                    ),
                                  )
                                  .toList(growable: false),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (menu != null) menu!,
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  FieldDefinition? _statusField() {
    for (final FieldDefinition field in definition.cardFields) {
      if ((field.key == 'status' || field.key == 'isActive') &&
          _hasVisibleResourceValue(item[field.key])) {
        return field;
      }
    }
    return null;
  }
}

class _Metadata extends StatelessWidget {
  const _Metadata({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 240),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 5,
              height: 5,
              decoration: const BoxDecoration(
                color: AppColors.muted,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                '$label: $value',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      );
}

class ResourceLoadingList extends StatelessWidget {
  const ResourceLoadingList({super.key});

  @override
  Widget build(BuildContext context) => AppConstrainedContent(
        child: AppShimmer(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
            itemCount: 6,
            separatorBuilder: (BuildContext context, int index) =>
                const SizedBox(height: 10),
            itemBuilder: (BuildContext context, int index) => const Card(
              child: SizedBox(
                height: 116,
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      AppShimmerBox(width: 190, height: 16),
                      SizedBox(height: 18),
                      AppShimmerBox(width: 110, height: 12),
                      SizedBox(height: 10),
                      AppShimmerBox(width: 230, height: 12),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}

class ResourceMessageState extends StatelessWidget {
  const ResourceMessageState({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.actionIcon = Icons.refresh_rounded,
    this.onAction,
    super.key,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final IconData actionIcon;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => AppEmptyState(
        icon: icon,
        title: title,
        message: message,
        action: actionLabel != null && onAction != null
            ? FilledButton.tonalIcon(
                onPressed: onAction,
                icon: Icon(actionIcon),
                label: Text(actionLabel!),
              )
            : null,
      );
}
