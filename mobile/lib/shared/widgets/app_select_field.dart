import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

class AppSelectOption<T> {
  const AppSelectOption({required this.value, required this.label, this.note});

  final T value;
  final String label;
  final String? note;
}

/// A mobile-first select control. Unlike DropdownButton, long option lists are
/// presented in a searchable bottom sheet and never cover the entire screen
/// with an unstyled platform menu.
class AppSelectField<T> extends StatelessWidget {
  const AppSelectField({
    required this.label,
    required this.options,
    required this.onChanged,
    this.value,
    this.placeholder = 'Pilih salah satu',
    this.prefixIcon,
    this.enabled = true,
    this.errorText,
    this.validator,
    this.searchHint = 'Cari pilihan…',
    super.key,
  });

  final String label;
  final List<AppSelectOption<T>> options;
  final T? value;
  final ValueChanged<T?>? onChanged;
  final String placeholder;
  final IconData? prefixIcon;
  final bool enabled;
  final String? errorText;
  final FormFieldValidator<T>? validator;
  final String searchHint;

  AppSelectOption<T>? get _selected {
    for (final AppSelectOption<T> option in options) {
      if (option.value == value) return option;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final bool interactive = enabled && onChanged != null;
    return FormField<T>(
      key: ValueKey<Object?>(value),
      initialValue: value,
      validator: validator,
      builder: (FormFieldState<T> field) {
        final AppSelectOption<T>? selected = _selected;
        return Semantics(
          button: interactive,
          label: '$label, ${selected?.label ?? placeholder}',
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.field),
            onTap: interactive
                ? () async {
                    final T? result = await showModalBottomSheet<T>(
                      context: context,
                      useSafeArea: true,
                      isScrollControlled: true,
                      builder: (BuildContext sheetContext) =>
                          _AppOptionSheet<T>(
                        title: label,
                        options: options,
                        selected: field.value,
                        searchHint: searchHint,
                      ),
                    );
                    if (result == null || !context.mounted) return;
                    field.didChange(result);
                    onChanged?.call(result);
                  }
                : null,
            child: InputDecorator(
              // Placeholder adalah konten nyata. Menandainya kosong membuat
              // label tidak mengambang dan bertumpuk dengan placeholder.
              isEmpty: false,
              decoration: InputDecoration(
                labelText: label,
                errorText: errorText ?? field.errorText,
                prefixIcon: prefixIcon == null ? null : Icon(prefixIcon),
                suffixIcon: Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: interactive ? AppColors.muted : AppColors.border,
                ),
                enabled: interactive,
              ),
              child: Text(
                selected?.label ?? placeholder,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: selected == null ? AppColors.muted : AppColors.ink,
                      fontWeight:
                          selected == null ? FontWeight.w500 : FontWeight.w700,
                    ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _AppOptionSheet<T> extends StatefulWidget {
  const _AppOptionSheet({
    required this.title,
    required this.options,
    required this.selected,
    required this.searchHint,
  });

  final String title;
  final List<AppSelectOption<T>> options;
  final T? selected;
  final String searchHint;

  @override
  State<_AppOptionSheet<T>> createState() => _AppOptionSheetState<T>();
}

class _AppOptionSheetState<T> extends State<_AppOptionSheet<T>> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final bool searchable = widget.options.length > 7;
    final String normalized = _query.trim().toLowerCase();
    final List<AppSelectOption<T>> visible = normalized.isEmpty
        ? widget.options
        : widget.options
            .where(
              (AppSelectOption<T> option) =>
                  option.label.toLowerCase().contains(normalized) ||
                  (option.note?.toLowerCase().contains(normalized) ?? false),
            )
            .toList(growable: false);
    final double initialSize = searchable
        ? .8
        : ((118 + widget.options.length * 60) /
                MediaQuery.sizeOf(context).height)
            .clamp(.28, .68);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: initialSize,
      minChildSize: initialSize < .35 ? .25 : .35,
      maxChildSize: .92,
      builder: (BuildContext context, ScrollController scrollController) =>
          Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 12, 12),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'PILIHAN',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: Theme.of(context).colorScheme.primary,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1,
                            ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        widget.title,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Tutup',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          if (searchable)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: TextField(
                autofocus: false,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: widget.searchHint,
                  prefixIcon: const Icon(Icons.search_rounded),
                ),
                onChanged: (String value) => setState(() => _query = value),
              ),
            ),
          const Divider(),
          Expanded(
            child: visible.isEmpty
                ? const Center(
                    child: Text('Pilihan tidak ditemukan.'),
                  )
                : ListView.separated(
                    controller: scrollController,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                    itemCount: visible.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 4),
                    itemBuilder: (BuildContext context, int index) {
                      final AppSelectOption<T> option = visible[index];
                      final bool selected = option.value == widget.selected;
                      return Material(
                        color: selected
                            ? Theme.of(context).colorScheme.primaryContainer
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                        child: ListTile(
                          minTileHeight: 56,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          title: Text(
                            option.label,
                            style: TextStyle(
                              fontWeight:
                                  selected ? FontWeight.w800 : FontWeight.w600,
                            ),
                          ),
                          subtitle:
                              option.note == null ? null : Text(option.note!),
                          trailing: selected
                              ? Icon(
                                  Icons.check_circle_rounded,
                                  color: Theme.of(context).colorScheme.primary,
                                )
                              : const Icon(
                                  Icons.chevron_right_rounded,
                                  color: AppColors.muted,
                                ),
                          onTap: () => Navigator.pop(context, option.value),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
