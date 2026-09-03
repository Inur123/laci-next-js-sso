import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/shared/widgets/app_layout.dart';

void main() {
  testWidgets('grid memenuhi baris terakhir tanpa menyisakan kolom kosong',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: 330,
              child: AppAdaptiveGrid(
                minItemWidth: 140,
                maxColumns: 2,
                children: <Widget>[
                  SizedBox(key: ValueKey<String>('card-1'), height: 60),
                  SizedBox(key: ValueKey<String>('card-2'), height: 60),
                  SizedBox(key: ValueKey<String>('card-3'), height: 60),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    final double firstWidth =
        tester.getSize(find.byKey(const ValueKey<String>('card-1'))).width;
    final double lastWidth =
        tester.getSize(find.byKey(const ValueKey<String>('card-3'))).width;
    expect(lastWidth, closeTo(330, .1));
    expect(lastWidth, greaterThan(firstWidth * 1.9));
  });

  testWidgets('pagination memakai pola ringkas yang sama di semua daftar',
      (WidgetTester tester) async {
    int selectedPage = 2;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppPagination(
            page: 2,
            totalPages: 4,
            onPage: (int value) => selectedPage = value,
          ),
        ),
      ),
    );

    expect(find.text('2 / 4'), findsOneWidget);
    expect(find.byTooltip('Halaman sebelumnya'), findsOneWidget);
    expect(find.byTooltip('Halaman berikutnya'), findsOneWidget);

    await tester.tap(find.byTooltip('Halaman berikutnya'));
    expect(selectedPage, 3);
  });

  testWidgets('pagination satu halaman tidak menambah kontrol yang tidak perlu',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppPagination(
            page: 1,
            totalPages: 1,
            onPage: (_) {},
          ),
        ),
      ),
    );

    expect(find.byTooltip('Halaman sebelumnya'), findsNothing);
    expect(find.byTooltip('Halaman berikutnya'), findsNothing);
    expect(find.text('1 / 1'), findsNothing);
  });
}
