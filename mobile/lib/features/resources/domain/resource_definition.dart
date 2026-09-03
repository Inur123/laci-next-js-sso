import '../../auth/domain/app_user.dart';

enum ResourceScope {
  mine,
  review,
  reference;

  String? get apiValue => switch (this) {
        ResourceScope.mine => null,
        ResourceScope.review => 'review',
        ResourceScope.reference => 'reference',
      };
}

enum ResourceFieldKind {
  text,
  multiline,
  select,
  date,
  dateTime,
  time,
  toggle,
  color,
  file,
}

class ResourceOption {
  const ResourceOption(this.value, this.label);

  final String value;
  final String label;
}

class FieldDefinition {
  const FieldDefinition({
    required this.key,
    required this.label,
    this.kind = ResourceFieldKind.text,
    this.placeholder,
    this.options = const <ResourceOption>[],
    this.requiredOnCreate = false,
    this.requiredOnEdit = false,
    this.showInForm = true,
    this.showInDetail = true,
    this.showInCard = false,
    this.maxLines = 1,
    this.defaultValue,
    this.endAfterField,
    this.uploadPrefix,
    this.maxFileBytes,
    this.acceptedExtensions = const <String>[],
  });

  final String key;
  final String label;
  final ResourceFieldKind kind;
  final String? placeholder;
  final List<ResourceOption> options;
  final bool requiredOnCreate;
  final bool requiredOnEdit;
  final bool showInForm;
  final bool showInDetail;
  final bool showInCard;
  final int maxLines;
  final Object? defaultValue;
  final String? endAfterField;
  final String? uploadPrefix;
  final int? maxFileBytes;
  final List<String> acceptedExtensions;

  bool requiredFor(bool editing) => editing ? requiredOnEdit : requiredOnCreate;

  String optionLabel(Object? value) {
    final String raw = value?.toString() ?? '';
    for (final ResourceOption option in options) {
      if (option.value == raw) return option.label;
    }
    return raw.replaceAll('_', ' ');
  }
}

class FilterDefinition {
  const FilterDefinition({
    required this.queryKey,
    required this.label,
    this.options = const <ResourceOption>[],
    this.source = ResourceFilterSource.fixed,
  });

  final String queryKey;
  final String label;
  final List<ResourceOption> options;
  final ResourceFilterSource source;
}

enum ResourceFilterSource { fixed, pacDirectory }

class SortDefinition {
  const SortDefinition(this.key, this.label);

  final String key;
  final String label;
}

class StatDefinition {
  const StatDefinition(this.key, this.label);

  final String key;
  final String label;
}

enum SpreadsheetValueKind {
  text,
  date,
  dateTime,
  option,
  nested,
  education,
  training,
}

class SpreadsheetColumnDefinition {
  const SpreadsheetColumnDefinition({
    required this.key,
    required this.header,
    this.example = '',
    this.importAliases = const <String>[],
    this.kind = SpreadsheetValueKind.text,
    this.optional = false,
    this.width = 18,
    this.nestedKey,
    this.matchValue,
    this.cabangOnly = false,
    this.omitWhenAllEmpty = false,
  });

  final String key;
  final String header;
  final String example;
  final List<String> importAliases;
  final SpreadsheetValueKind kind;
  final bool optional;
  final double width;
  final String? nestedKey;
  final String? matchValue;
  final bool cabangOnly;
  final bool omitWhenAllEmpty;

  List<String> get acceptedHeaders => <String>[header, ...importAliases];
}

class ResourceSpreadsheetDefinition {
  const ResourceSpreadsheetDefinition({
    required this.module,
    required this.exportSheetName,
    required this.exportFilePrefix,
    required this.columns,
    this.templateFileName,
    this.cabangExportFilePrefix,
    this.qualifyWithPacFilter = false,
    this.templateSheetName = 'Template',
    this.maxImportRows = 3000,
  });

  final String module;
  final String? templateFileName;
  final String templateSheetName;
  final String exportSheetName;
  final String exportFilePrefix;
  final String? cabangExportFilePrefix;
  final bool qualifyWithPacFilter;
  final List<SpreadsheetColumnDefinition> columns;
  final int maxImportRows;

  bool get supportsImport => templateFileName != null;
}

class ResourceDefinition {
  const ResourceDefinition({
    required this.key,
    required this.title,
    required this.singular,
    required this.primaryField,
    required this.fields,
    required this.accessRoles,
    this.createRoles = const <UserRole>{},
    this.editRoles = const <UserRole>{},
    this.deleteRoles = const <UserRole>{},
    this.filters = const <FilterDefinition>[],
    this.defaultFilters = const <String, String>{},
    this.sorts = const <SortDefinition>[],
    this.stats = const <StatDefinition>[],
    this.defaultSortKey,
    this.defaultSortAscending = false,
    this.searchHint = 'Cari data...',
    this.emptyMessage = 'Belum ada data pada periode ini.',
    this.pendingOnlyEdit = false,
    this.supportsStatusReview = false,
    this.supportsMemberVerification = false,
    this.supportsCopyPeriod = false,
    this.supportsCopyToActivePeriod = false,
    this.supportsParticipants = false,
    this.spreadsheet,
  });

  final String key;
  final String title;
  final String singular;
  final String primaryField;
  final List<FieldDefinition> fields;
  final Set<UserRole> accessRoles;
  final Set<UserRole> createRoles;
  final Set<UserRole> editRoles;
  final Set<UserRole> deleteRoles;
  final List<FilterDefinition> filters;
  final Map<String, String> defaultFilters;
  final List<SortDefinition> sorts;
  final List<StatDefinition> stats;
  final String? defaultSortKey;
  final bool defaultSortAscending;
  final String searchHint;
  final String emptyMessage;
  final bool pendingOnlyEdit;
  final bool supportsStatusReview;
  final bool supportsMemberVerification;
  final bool supportsCopyPeriod;
  final bool supportsCopyToActivePeriod;
  final bool supportsParticipants;
  final ResourceSpreadsheetDefinition? spreadsheet;

  String get path => '/$key';

  FieldDefinition? get fileField {
    for (final FieldDefinition field in fields) {
      if (field.kind == ResourceFieldKind.file) return field;
    }
    return null;
  }

  List<FieldDefinition> get formFields => fields
      .where((FieldDefinition field) => field.showInForm)
      .toList(growable: false);

  List<FieldDefinition> get detailFields => fields
      .where((FieldDefinition field) => field.showInDetail)
      .toList(growable: false);

  List<FieldDefinition> get cardFields => fields
      .where((FieldDefinition field) => field.showInCard)
      .toList(growable: false);

  bool canAccess(AppUser user) => accessRoles.contains(user.role);

  bool canCreate(AppUser user, ResourceScope scope) =>
      scope == ResourceScope.mine && createRoles.contains(user.role);

  bool canEdit(
    AppUser user,
    ResourceScope scope,
    Map<String, dynamic> item,
  ) {
    if (scope != ResourceScope.mine || !editRoles.contains(user.role)) {
      return false;
    }
    return !pendingOnlyEdit || item['status'] == 'PENDING';
  }

  bool canDelete(
    AppUser user,
    ResourceScope scope,
    Map<String, dynamic> item,
  ) {
    if (scope == ResourceScope.reference) return false;
    return deleteRoles.contains(user.role);
  }

  bool canReviewStatus(AppUser user, ResourceScope scope) =>
      supportsStatusReview && user.isCabang && scope != ResourceScope.reference;

  bool canVerifyMember(AppUser user) =>
      supportsMemberVerification && user.isCabang;

  bool canDownload(
    AppUser user,
    ResourceScope scope,
    Map<String, dynamic> item,
  ) =>
      fileField != null &&
      item[fileField!.key] != null &&
      item[fileField!.key].toString().isNotEmpty;
}
