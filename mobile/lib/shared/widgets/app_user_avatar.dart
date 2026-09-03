import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../features/auth/domain/app_user.dart';

/// Avatar akun yang konsisten untuk seluruh aplikasi.
///
/// Foto berupa URL publik dimuat langsung. Key foto privat selalu diambil
/// melalui API Laci agar header Authorization dari sesi mobile ikut terkirim.
/// Inisial tetap berada di belakang gambar sehingga kegagalan jaringan tidak
/// pernah menghasilkan lingkaran kosong.
class AppUserAvatar extends ConsumerStatefulWidget {
  const AppUserAvatar({
    required this.user,
    required this.radius,
    required this.backgroundColor,
    required this.foregroundColor,
    this.textStyle,
    super.key,
  });

  final AppUser user;
  final double radius;
  final Color backgroundColor;
  final Color foregroundColor;
  final TextStyle? textStyle;

  @override
  ConsumerState<AppUserAvatar> createState() => _AppUserAvatarState();
}

class _AppUserAvatarState extends ConsumerState<AppUserAvatar> {
  ImageProvider<Object>? _image;
  int _loadGeneration = 0;

  @override
  void initState() {
    super.initState();
    _resolveImage();
  }

  @override
  void didUpdateWidget(covariant AppUserAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.user, widget.user)) {
      _resolveImage(
        refreshRemote: oldWidget.user.id == widget.user.id &&
            oldWidget.user.image == widget.user.image,
      );
    }
  }

  void _resolveImage({bool refreshRemote = false}) {
    final int generation = ++_loadGeneration;
    final String source = widget.user.image?.trim() ?? '';
    final Uri? uri = Uri.tryParse(source);
    if (uri != null &&
        (uri.scheme == 'https' || uri.scheme == 'http') &&
        uri.host.isNotEmpty) {
      final NetworkImage remote = NetworkImage(uri.toString());
      if (refreshRemote) {
        // URL avatar SSO dapat tetap sama walau isi fotonya telah diganti.
        // Buang cache hanya saat objek user baru datang dari sinkronisasi.
        _image = null;
        unawaited(_reloadRemoteImage(remote, generation));
      } else {
        _image = remote;
      }
      return;
    }
    _image = null;
    if (source.isNotEmpty) {
      unawaited(_loadPrivateImage(generation));
    }
  }

  Future<void> _reloadRemoteImage(
    NetworkImage image,
    int generation,
  ) async {
    await image.evict();
    if (!mounted || generation != _loadGeneration) return;
    setState(() => _image = image);
  }

  Future<void> _loadPrivateImage(int generation) async {
    try {
      final Uint8List bytes = await ref
          .read(apiClientProvider)
          .download('/images/users/${widget.user.id}');
      if (!mounted || generation != _loadGeneration || bytes.isEmpty) return;
      setState(() => _image = MemoryImage(bytes));
    } on Object {
      // Inisial adalah fallback yang disengaja saat foto tidak tersedia.
    }
  }

  void _handleImageError(Object _, StackTrace? __) {
    if (!mounted || _image == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _image = null);
    });
  }

  @override
  Widget build(BuildContext context) => Semantics(
        image: true,
        label: 'Foto profil ${widget.user.name}',
        child: CircleAvatar(
          radius: widget.radius,
          backgroundColor: widget.backgroundColor,
          foregroundImage: _image,
          onForegroundImageError: _image == null ? null : _handleImageError,
          child: Text(
            widget.user.initials,
            style: (widget.textStyle ?? Theme.of(context).textTheme.titleMedium)
                ?.copyWith(
              color: widget.foregroundColor,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      );
}
