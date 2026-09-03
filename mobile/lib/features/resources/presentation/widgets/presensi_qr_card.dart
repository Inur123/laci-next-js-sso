import 'dart:ui' as ui;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_theme.dart';

String presensiQrFileName(String activityName) {
  final String safeActivity = activityName
      .trim()
      .replaceAll(RegExp(r'[\\/:*?"<>|]'), '_')
      .replaceAll(RegExp(r'\s+'), '_')
      .replaceAll(RegExp('_+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');
  return 'QR-Presensi-${safeActivity.isEmpty ? 'Kegiatan' : safeActivity}.png';
}

Future<Uint8List> renderPresensiQrPng(
  Uri uri, {
  double size = 2048,
}) async {
  final QrPainter painter = QrPainter(
    data: uri.toString(),
    version: QrVersions.auto,
    errorCorrectionLevel: QrErrorCorrectLevel.H,
    gapless: true,
    // A white background keeps the exported QR scanner-friendly.
    // ignore: deprecated_member_use
    emptyColor: Colors.white,
  );
  final ByteData? data = await painter.toImageData(
    size,
    format: ui.ImageByteFormat.png,
  );
  if (data == null) throw StateError('QR image data is unavailable');
  return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
}

class PresensiQrCard extends StatefulWidget {
  const PresensiQrCard({
    required this.uri,
    required this.activityName,
    super.key,
  });

  final Uri uri;
  final String activityName;

  @override
  State<PresensiQrCard> createState() => _PresensiQrCardState();
}

class _PresensiQrCardState extends State<PresensiQrCard> {
  bool _saving = false;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'QR presensi',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 5),
              Text(
                'Peserta memindai QR ini untuk membuka formulir presensi publik.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              Center(
                child: Semantics(
                  image: true,
                  label: 'QR presensi ${widget.activityName}',
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: QrImageView(
                      data: widget.uri.toString(),
                      size: 190,
                      padding: const EdgeInsets.all(6),
                      backgroundColor: Colors.white,
                      errorCorrectionLevel: QrErrorCorrectLevel.H,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SelectableText(
                widget.uri.toString(),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.muted,
                    ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: <Widget>[
                  OutlinedButton.icon(
                    onPressed: () => _copy(context),
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Salin'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _share,
                    icon: const Icon(Icons.ios_share_rounded),
                    label: const Text('Bagikan'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _saving ? null : () => _download(context),
                    icon: _saving
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download_rounded),
                    label: Text(_saving ? 'Menyimpan...' : 'Unduh QR'),
                  ),
                  FilledButton.tonalIcon(
                    onPressed: () => _open(context),
                    icon: const Icon(Icons.open_in_browser_rounded),
                    label: const Text('Buka form'),
                  ),
                ],
              ),
            ],
          ),
        ),
      );

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: widget.uri.toString()));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tautan presensi disalin.')),
    );
  }

  Future<void> _share() => Share.share(
        widget.uri.toString(),
        subject: 'Presensi ${widget.activityName}',
      );

  Future<void> _download(BuildContext context) async {
    setState(() => _saving = true);
    try {
      final Uint8List bytes = await renderPresensiQrPng(widget.uri);
      final String? path = await FilePicker.platform.saveFile(
        dialogTitle: 'Simpan QR presensi',
        fileName: presensiQrFileName(widget.activityName),
        type: FileType.custom,
        allowedExtensions: const <String>['png'],
        bytes: bytes,
      );
      if (path == null || !context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('QR presensi berhasil disimpan.')),
      );
    } on Object {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('QR presensi tidak dapat disimpan. Coba lagi.'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _open(BuildContext context) async {
    final bool opened = await launchUrl(
      widget.uri,
      mode: LaunchMode.externalApplication,
    );
    if (opened || !context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tautan presensi tidak dapat dibuka.')),
    );
  }
}
