import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/app/theme/app_theme.dart';
import 'package:laci_mobile/shared/widgets/app_states.dart';
import 'package:shimmer/shimmer.dart';

void main() {
  testWidgets('state loading data memakai shimmer',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AppLoadingList(items: 2)),
      ),
    );

    expect(find.byType(Shimmer), findsOneWidget);
    expect(find.byType(AppLoadingCard), findsNWidgets(2));
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('state data kosong tampil ringan tanpa kartu besar',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AppEmptyState(
            title: 'Belum ada data',
            message: 'Data baru akan tampil di sini.',
          ),
        ),
      ),
    );

    expect(find.byType(Card), findsNothing);
    expect(find.byIcon(Icons.inventory_2_outlined), findsOneWidget);
    expect(find.text('Belum ada data'), findsOneWidget);
  });

  testWidgets('aksi dialog tetap sejajar dan tidak dipaksa selebar layar',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(null),
        home: Scaffold(
          body: AlertDialog(
            title: const Text('Hapus data?'),
            actions: <Widget>[
              TextButton(onPressed: () {}, child: const Text('Batal')),
              FilledButton(onPressed: () {}, child: const Text('Hapus')),
            ],
          ),
        ),
      ),
    );

    final Offset cancel = tester.getCenter(find.text('Batal'));
    final Offset remove = tester.getCenter(find.text('Hapus'));
    expect((cancel.dy - remove.dy).abs(), lessThan(2));
    expect(tester.getSize(find.byType(FilledButton)).width, lessThan(200));
  });
}
