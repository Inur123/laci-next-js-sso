import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_theme.dart';
import '../../../core/errors/app_exception.dart';
import '../../../shared/models/json_value.dart';
import '../../../shared/widgets/app_layout.dart';
import '../../../shared/widgets/app_select_field.dart';
import '../../auth/domain/app_user.dart';
import '../../periods/domain/app_period.dart';
import '../application/resource_controller.dart';
import '../domain/resource_definition.dart';
import '../domain/resource_models.dart';

class ResourceFormPage extends ConsumerStatefulWidget {
  const ResourceFormPage({
    required this.definition,
    required this.user,
    required this.controllerArgs,
    this.item,
    this.activePeriod,
    this.viewPeriod,
    super.key,
  });

  final ResourceDefinition definition;
  final AppUser user;
  final ResourceControllerArgs controllerArgs;
  final ResourceItem? item;
  final AppPeriod? activePeriod;
  final AppPeriod? viewPeriod;

  bool get editing => item != null;

  @override
  ConsumerState<ResourceFormPage> createState() => _ResourceFormPageState();
}

class _ResourceFormPageState extends ConsumerState<ResourceFormPage> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final Map<String, TextEditingController> _textControllers =
      <String, TextEditingController>{};
  final Map<String, Object?> _values = <String, Object?>{};
  final Map<String, String> _fieldErrors = <String, String>{};
  LocalResourceFile? _file;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    for (final FieldDefinition field in widget.definition.formFields) {
      final Object? initial = widget.item?[field.key] ??
          (!widget.editing
              ? widget.controllerArgs.initialFilters[field.key]
              : null) ??
          field.defaultValue;
      switch (field.kind) {
        case ResourceFieldKind.text:
        case ResourceFieldKind.multiline:
        case ResourceFieldKind.time:
          _textControllers[field.key] =
              TextEditingController(text: initial?.toString() ?? '');
        case ResourceFieldKind.date:
        case ResourceFieldKind.dateTime:
          _values[field.key] = initial == null
              ? null
              : DateTime.tryParse(initial.toString())?.toLocal();
        case ResourceFieldKind.select:
        case ResourceFieldKind.color:
          final String? candidate = initial?.toString();
          _values[field.key] = field.options.any(
            (ResourceOption option) => option.value == candidate,
          )
              ? candidate
              : null;
        case ResourceFieldKind.toggle:
          _values[field.key] = initial is bool ? initial : initial == 'true';
        case ResourceFieldKind.file:
          break;
      }
    }
  }

  @override
  void dispose() {
    for (final TextEditingController controller in _textControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Color accent = AppColors.forRole(widget.user.role);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.editing
              ? 'Edit ${widget.definition.singular}'
              : 'Tambah ${widget.definition.singular}',
        ),
      ),
      body: SafeArea(
        child: AppConstrainedContent(
          maxWidth: 820,
          child: Form(
            key: _formKey,
            child: ListView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: <Widget>[
                _FormIntro(
                  accent: accent,
                  title: widget.editing ? 'Perbarui data' : 'Data baru',
                  message:
                      'Kolom bertanda bintang wajib diisi. Perubahan tetap diperiksa kembali oleh server.',
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
                    child: Column(
                      children: widget.definition.formFields
                          .map<Widget>(
                            (FieldDefinition field) => Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _buildField(field, accent),
                            ),
                          )
                          .toList(growable: false),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _FormActions(
                  submitting: _submitting,
                  onCancel: () => Navigator.pop(context),
                  onSubmit: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(FieldDefinition field, Color accent) =>
      switch (field.kind) {
        ResourceFieldKind.text ||
        ResourceFieldKind.multiline ||
        ResourceFieldKind.time =>
          TextFormField(
            controller: _textControllers[field.key],
            enabled: !_submitting,
            maxLines:
                field.kind == ResourceFieldKind.multiline ? field.maxLines : 1,
            keyboardType: _keyboardType(field),
            textInputAction: field.kind == ResourceFieldKind.multiline
                ? TextInputAction.newline
                : TextInputAction.next,
            decoration: InputDecoration(
              labelText: _label(field),
              hintText: field.placeholder,
              errorText: _fieldErrors[field.key],
              suffixIcon: field.kind == ResourceFieldKind.time
                  ? const Icon(Icons.schedule_rounded)
                  : null,
            ),
            validator: (String? value) {
              if (field.requiredFor(widget.editing) &&
                  (value == null || value.trim().isEmpty)) {
                return '${field.label} wajib diisi.';
              }
              if (field.kind == ResourceFieldKind.time &&
                  value != null &&
                  value.isNotEmpty &&
                  !RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(value)) {
                return 'Gunakan format jam HH:mm.';
              }
              return _validateOrderedValue(field, value);
            },
            onChanged: (_) => _clearServerError(field.key),
            onTap: field.kind == ResourceFieldKind.time
                ? () => _pickTime(field)
                : null,
            readOnly: field.kind == ResourceFieldKind.time,
          ),
        ResourceFieldKind.select => _buildSelectField(field),
        ResourceFieldKind.date || ResourceFieldKind.dateTime => InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: _submitting ? null : () => _pickDate(field),
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: _label(field),
                errorText: _fieldErrors[field.key],
                suffixIcon: const Icon(Icons.calendar_month_outlined),
              ),
              child: Text(
                _formatDateValue(field, _values[field.key] as DateTime?),
                style: (_values[field.key] == null)
                    ? Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: AppColors.muted,
                        )
                    : null,
              ),
            ),
          ),
        ResourceFieldKind.toggle => SwitchListTile.adaptive(
            value: (_values[field.key] as bool?) ?? false,
            onChanged: _submitting
                ? null
                : (bool value) => setState(() => _values[field.key] = value),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: AppColors.border),
            ),
            title: Text(_label(field)),
          ),
        ResourceFieldKind.color => _ColorField(
            field: field,
            value: _values[field.key] as String?,
            accent: accent,
            error: _fieldErrors[field.key],
            onChanged: _submitting
                ? null
                : (String value) => setState(() {
                      _values[field.key] = value;
                      _fieldErrors.remove(field.key);
                    }),
          ),
        ResourceFieldKind.file => _FileField(
            field: field,
            selected: _file,
            hasExisting: widget.item?[field.key] != null &&
                widget.item![field.key].toString().isNotEmpty,
            error: _fieldErrors[field.key],
            onPick: _submitting ? null : () => _pickFile(field),
            onClear: _submitting || _file == null
                ? null
                : () => setState(() => _file = null),
          ),
      };

  Widget _buildSelectField(FieldDefinition field) {
    if (_isLockedByContext(field)) {
      return InputDecorator(
        decoration: InputDecoration(
          labelText: _label(field),
          suffixIcon: const Icon(Icons.lock_outline_rounded),
        ),
        child: Text(field.optionLabel(_values[field.key])),
      );
    }
    return AppSelectField<String>(
      value: _values[field.key] as String?,
      label: _label(field),
      errorText: _fieldErrors[field.key],
      options: field.options
          .map<AppSelectOption<String>>(
            (ResourceOption option) => AppSelectOption<String>(
              value: option.value,
              label: option.label,
            ),
          )
          .toList(growable: false),
      onChanged: _submitting
          ? null
          : (String? value) => setState(() {
                _values[field.key] = value;
                _fieldErrors.remove(field.key);
              }),
      validator: (String? value) =>
          field.requiredFor(widget.editing) && value == null
              ? '${field.label} wajib dipilih.'
              : null,
    );
  }

  TextInputType _keyboardType(FieldDefinition field) {
    if (field.kind == ResourceFieldKind.multiline) {
      return TextInputType.multiline;
    }
    if (field.key.toLowerCase().contains('email')) {
      return TextInputType.emailAddress;
    }
    if (field.key.toLowerCase().contains('kontak') ||
        field.key.toLowerCase().contains('hp')) {
      return TextInputType.phone;
    }
    return TextInputType.text;
  }

  bool _isLockedByContext(FieldDefinition field) =>
      widget.controllerArgs.initialFilters.containsKey(field.key);

  String _label(FieldDefinition field) =>
      '${field.label}${field.requiredFor(widget.editing) ? ' *' : ''}';

  String _formatDateValue(FieldDefinition field, DateTime? value) {
    if (value == null) return 'Pilih ${field.label.toLowerCase()}';
    return field.kind == ResourceFieldKind.date
        ? DateFormat('d MMMM yyyy').format(value)
        : DateFormat('d MMM yyyy, HH:mm').format(value);
  }

  Future<void> _pickDate(FieldDefinition field) async {
    final DateTime current =
        (_values[field.key] as DateTime?) ?? DateTime.now();
    final DateTime? date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (date == null || !mounted) return;
    DateTime next = DateTime(date.year, date.month, date.day);
    if (field.kind == ResourceFieldKind.dateTime) {
      final TimeOfDay initial = TimeOfDay.fromDateTime(current);
      final TimeOfDay? time = await showTimePicker(
        context: context,
        initialTime: initial,
      );
      if (time == null || !mounted) return;
      next = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    }
    setState(() {
      _values[field.key] = next;
      _fieldErrors.remove(field.key);
    });
  }

  Future<void> _pickTime(FieldDefinition field) async {
    final String raw = _textControllers[field.key]?.text ?? '';
    final List<String> parts = raw.split(':');
    final TimeOfDay initial = parts.length == 2
        ? TimeOfDay(
            hour: int.tryParse(parts[0]) ?? 8,
            minute: int.tryParse(parts[1]) ?? 0,
          )
        : TimeOfDay.now();
    final TimeOfDay? time = await showTimePicker(
      context: context,
      initialTime: initial,
    );
    if (time == null || !mounted) return;
    _textControllers[field.key]?.text =
        '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    setState(() => _fieldErrors.remove(field.key));
  }

  Future<void> _pickFile(FieldDefinition field) async {
    final FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: field.acceptedExtensions,
      allowMultiple: false,
    );
    final PlatformFile? picked =
        result == null || result.files.isEmpty ? null : result.files.first;
    if (picked == null || picked.path == null || !mounted) return;
    if (field.maxFileBytes != null && picked.size > field.maxFileBytes!) {
      setState(() {
        _fieldErrors[field.key] =
            'Ukuran maksimal ${field.maxFileBytes! ~/ (1024 * 1024)} MB.';
      });
      return;
    }
    setState(() {
      _file = LocalResourceFile(
        path: picked.path!,
        name: picked.name,
        size: picked.size,
      );
      _fieldErrors.remove(field.key);
    });
  }

  String? _validateOrderedValue(FieldDefinition field, String? value) {
    final String? startKey = field.endAfterField;
    if (startKey == null || value == null || value.isEmpty) return null;
    final TextEditingController? start = _textControllers[startKey];
    if (start != null &&
        start.text.isNotEmpty &&
        value.compareTo(start.text) < 0) {
      return '${field.label} tidak boleh sebelum waktu mulai.';
    }
    return null;
  }

  bool _validateNonTextFields() {
    bool valid = true;
    for (final FieldDefinition field in widget.definition.formFields) {
      if ((field.kind == ResourceFieldKind.date ||
              field.kind == ResourceFieldKind.dateTime) &&
          field.requiredFor(widget.editing) &&
          _values[field.key] == null) {
        _fieldErrors[field.key] = '${field.label} wajib dipilih.';
        valid = false;
      }
      if (field.kind == ResourceFieldKind.color &&
          field.requiredFor(widget.editing) &&
          _values[field.key] == null) {
        _fieldErrors[field.key] = '${field.label} wajib dipilih.';
        valid = false;
      }
      if (field.kind == ResourceFieldKind.file &&
          field.requiredFor(widget.editing) &&
          _file == null &&
          (widget.item?[field.key] == null ||
              widget.item![field.key].toString().isEmpty)) {
        _fieldErrors[field.key] = '${field.label} wajib dipilih.';
        valid = false;
      }
      final String? startKey = field.endAfterField;
      if (startKey != null &&
          _values[field.key] is DateTime &&
          _values[startKey] is DateTime &&
          (_values[field.key] as DateTime)
              .isBefore(_values[startKey] as DateTime)) {
        _fieldErrors[field.key] =
            '${field.label} tidak boleh sebelum tanggal mulai.';
        valid = false;
      }
    }
    return valid;
  }

  JsonMap _payload() {
    final JsonMap payload = <String, dynamic>{};
    for (final FieldDefinition field in widget.definition.formFields) {
      switch (field.kind) {
        case ResourceFieldKind.text:
        case ResourceFieldKind.multiline:
        case ResourceFieldKind.time:
          payload[field.key] = _textControllers[field.key]?.text.trim() ?? '';
        case ResourceFieldKind.select:
        case ResourceFieldKind.color:
        case ResourceFieldKind.toggle:
          payload[field.key] = _values[field.key];
        case ResourceFieldKind.date:
        case ResourceFieldKind.dateTime:
          final DateTime? value = _values[field.key] as DateTime?;
          payload[field.key] = value?.toUtc().toIso8601String();
        case ResourceFieldKind.file:
          break;
      }
    }
    return payload;
  }

  Future<void> _submit() async {
    setState(() => _fieldErrors.clear());
    final bool formValid = _formKey.currentState?.validate() ?? false;
    final bool extraValid = _validateNonTextFields();
    if (!formValid || !extraValid) {
      setState(() {});
      return;
    }
    setState(() => _submitting = true);
    try {
      final ResourceDraft draft =
          ResourceDraft(values: _payload(), file: _file);
      final ResourceController controller =
          ref.read(resourceControllerProvider(widget.controllerArgs).notifier);
      if (widget.item == null) {
        await controller.create(draft);
      } else {
        await controller.update(widget.item!.id, draft);
      }
      if (!mounted) return;
      Navigator.pop(
        context,
        widget.editing
            ? '${widget.definition.singular} berhasil diperbarui.'
            : '${widget.definition.singular} berhasil ditambahkan.',
      );
    } on AppException catch (error) {
      final JsonMap details = jsonMap(error.details);
      if (details.isNotEmpty) {
        setState(() {
          for (final MapEntry<String, dynamic> entry in details.entries) {
            _fieldErrors[entry.key] = entry.value.toString();
          }
        });
      }
      _showError(error.message);
    } on Object {
      _showError('Data tidak dapat disimpan. Coba lagi.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _clearServerError(String key) {
    if (_fieldErrors.containsKey(key)) {
      setState(() => _fieldErrors.remove(key));
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.danger),
    );
  }
}

class _FormIntro extends StatelessWidget {
  const _FormIntro({
    required this.accent,
    required this.title,
    required this.message,
  });

  final Color accent;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: accent.withOpacity(0.07),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: accent.withOpacity(0.2)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(Icons.inventory_2_outlined, color: accent),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(message, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      );
}

class _FormActions extends StatelessWidget {
  const _FormActions({
    required this.submitting,
    required this.onCancel,
    required this.onSubmit,
  });

  final bool submitting;
  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) => Card(
        key: const ValueKey<String>('resource-form-actions'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton(
                  onPressed: submitting ? null : onCancel,
                  child: const Text('Batal'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: submitting ? null : onSubmit,
                  icon: submitting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.save_outlined),
                  label: Text(submitting ? 'Menyimpan...' : 'Simpan'),
                ),
              ),
            ],
          ),
        ),
      );
}

class _ColorField extends StatelessWidget {
  const _ColorField({
    required this.field,
    required this.value,
    required this.accent,
    required this.onChanged,
    this.error,
  });

  final FieldDefinition field;
  final String? value;
  final Color accent;
  final ValueChanged<String>? onChanged;
  final String? error;

  @override
  Widget build(BuildContext context) => InputDecorator(
        decoration: InputDecoration(
          labelText: '${field.label}${field.requiredOnCreate ? ' *' : ''}',
          errorText: error,
        ),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: field.options.map<Widget>((ResourceOption option) {
            final Color color = _hexColor(option.value, accent);
            final bool selected = value == option.value;
            return Semantics(
              label: option.label,
              selected: selected,
              button: true,
              child: InkWell(
                onTap:
                    onChanged == null ? null : () => onChanged!(option.value),
                customBorder: const CircleBorder(),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected ? AppColors.ink : Colors.transparent,
                      width: 3,
                    ),
                  ),
                  child: selected
                      ? const Icon(Icons.check, color: Colors.white, size: 18)
                      : null,
                ),
              ),
            );
          }).toList(growable: false),
        ),
      );

  Color _hexColor(String value, Color fallback) {
    final String raw = value.replaceFirst('#', '');
    final int? parsed = int.tryParse('FF$raw', radix: 16);
    return parsed == null ? fallback : Color(parsed);
  }
}

class _FileField extends StatelessWidget {
  const _FileField({
    required this.field,
    required this.selected,
    required this.hasExisting,
    required this.onPick,
    required this.onClear,
    this.error,
  });

  final FieldDefinition field;
  final LocalResourceFile? selected;
  final bool hasExisting;
  final VoidCallback? onPick;
  final VoidCallback? onClear;
  final String? error;

  @override
  Widget build(BuildContext context) => InputDecorator(
        decoration: InputDecoration(
          labelText: '${field.label}${field.requiredOnCreate ? ' *' : ''}',
          errorText: error,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                const Icon(Icons.description_outlined, color: AppColors.muted),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    selected?.name ??
                        (hasExisting ? 'File tersimpan' : 'Belum ada file'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (onClear != null)
                  IconButton(
                    tooltip: 'Batalkan pilihan',
                    onPressed: onClear,
                    icon: const Icon(Icons.close_rounded),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: onPick,
              icon: const Icon(Icons.upload_file_outlined),
              label: Text(hasExisting ? 'Ganti file' : 'Pilih file'),
            ),
            const SizedBox(height: 6),
            Text(
              'Maksimal ${(field.maxFileBytes ?? 0) ~/ (1024 * 1024)} MB · ${field.acceptedExtensions.map((String item) => item.toUpperCase()).join(', ')}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      );
}
