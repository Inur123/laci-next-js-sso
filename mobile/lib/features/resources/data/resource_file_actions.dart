import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../domain/resource_definition.dart';
import '../domain/resource_models.dart';
import 'resource_repository.dart';

class ResourceFileActions {
  const ResourceFileActions(this._repository);

  static const String _cacheDirectoryName = 'laci-resource-files';
  static const Duration _previewRetention = Duration(minutes: 10);

  final ResourceDataSource _repository;

  Future<DownloadedResourceFile> downloadToTemporaryFile(
    ResourceDefinition definition,
    ResourceItem item, {
    ResourceScope scope = ResourceScope.mine,
  }) async {
    final Uint8List bytes =
        await _repository.download(definition, item, scope: scope);
    final Directory directory = await _temporaryDirectory();
    final String name = suggestedName(definition, item);
    final File file = File('${directory.path}/$name');
    await file.writeAsBytes(bytes, flush: true);
    return DownloadedResourceFile(path: file.path, name: name);
  }

  Future<DownloadedResourceFile> open(
    ResourceDefinition definition,
    ResourceItem item, {
    ResourceScope scope = ResourceScope.mine,
  }) async {
    final DownloadedResourceFile file =
        await downloadToTemporaryFile(definition, item, scope: scope);
    await OpenFilex.open(file.path);
    unawaited(_deleteLater(File(file.path), _previewRetention));
    return file;
  }

  Future<DownloadedResourceFile> share(
    ResourceDefinition definition,
    ResourceItem item, {
    ResourceScope scope = ResourceScope.mine,
  }) async {
    final DownloadedResourceFile file =
        await downloadToTemporaryFile(definition, item, scope: scope);
    try {
      await Share.shareXFiles(
        <XFile>[XFile(file.path)],
        subject: definition.singular,
        fileNameOverrides: <String>[file.name],
      );
    } finally {
      final File temporary = File(file.path);
      if (await temporary.exists()) await temporary.delete();
    }
    return file;
  }

  Future<String?> saveToUserSelectedLocation(
    ResourceDefinition definition,
    ResourceItem item, {
    ResourceScope scope = ResourceScope.mine,
  }) async {
    final Uint8List bytes =
        await _repository.download(definition, item, scope: scope);
    final String name = suggestedName(definition, item);
    final String extension = name.contains('.')
        ? name.substring(name.lastIndexOf('.') + 1).toLowerCase()
        : '';
    return FilePicker.platform.saveFile(
      dialogTitle: 'Simpan ${definition.singular}',
      fileName: name,
      type: extension.isEmpty ? FileType.any : FileType.custom,
      allowedExtensions: extension.isEmpty ? null : <String>[extension],
      bytes: bytes,
    );
  }

  Future<Directory> _temporaryDirectory() async {
    final Directory root = await getTemporaryDirectory();
    final Directory directory = Directory('${root.path}/$_cacheDirectoryName');
    if (!await directory.exists()) await directory.create(recursive: true);
    final DateTime cutoff = DateTime.now().subtract(const Duration(hours: 24));
    await for (final FileSystemEntity entity in directory.list()) {
      if (entity is! File) continue;
      try {
        final FileStat stat = await entity.stat();
        if (stat.modified.isBefore(cutoff)) await entity.delete();
      } on FileSystemException {
        // Cache cleanup is best-effort and must not block the requested file.
      }
    }
    return directory;
  }

  /// Removes decrypted resource previews cached by this feature.
  ///
  /// Logout/session-clear flows can call this hook through
  /// `resourceFileActionsProvider`. Cleanup remains best-effort so a filesystem
  /// race cannot prevent the session itself from being cleared.
  Future<void> clearTemporaryFiles() async {
    try {
      final Directory root = await getTemporaryDirectory();
      final Directory directory =
          Directory('${root.path}/$_cacheDirectoryName');
      if (await directory.exists()) await directory.delete(recursive: true);
    } on FileSystemException {
      // Session cleanup must continue even when the OS owns an open preview.
    }
  }

  static Future<void> _deleteLater(File file, Duration delay) async {
    await Future<void>.delayed(delay);
    try {
      if (await file.exists()) await file.delete();
    } on FileSystemException {
      // Stale files are retried by the next prune or explicit logout cleanup.
    }
  }

  static String suggestedName(
    ResourceDefinition definition,
    ResourceItem item,
  ) {
    final String original = item.text('fileName', '');
    if (original.isNotEmpty) return _safeName(original);
    final String storageKey = item.text('file', '');
    final RegExpMatch? match =
        RegExp(r'-([a-zA-Z0-9]+)\.enc$').firstMatch(storageKey.toLowerCase());
    final String extension = match?.group(1) ?? 'bin';
    final String base = _safeName(item.text(definition.primaryField, item.id));
    return '$base.$extension';
  }

  static String _safeName(String value) {
    final String cleaned = value
        .trim()
        .replaceAll(RegExp(r'[^a-zA-Z0-9._ -]'), '_')
        .replaceAll(RegExp(r'\s+'), '_')
        .replaceAll(RegExp('_+'), '_')
        .replaceAll(RegExp(r'^_+|_+$'), '');
    return cleaned.isEmpty ? 'dokumen' : cleaned;
  }
}
