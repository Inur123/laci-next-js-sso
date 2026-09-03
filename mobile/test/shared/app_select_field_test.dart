import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:laci_mobile/shared/widgets/app_select_field.dart';

void main() {
  testWidgets('pilihan panjang memakai bottom sheet yang dapat dicari',
      (WidgetTester tester) async {
    String? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: StatefulBuilder(
              builder: (BuildContext context, StateSetter setState) =>
                  AppSelectField<String>(
                label: 'Pengguna PAC',
                value: selected,
                searchHint: 'Cari nama PAC…',
                options: List<AppSelectOption<String>>.generate(
                  12,
                  (int index) => AppSelectOption<String>(
                    value: 'pac-$index',
                    label: 'PAC ${index + 1}',
                  ),
                ),
                onChanged: (String? value) => setState(() => selected = value),
              ),
            ),
          ),
        ),
      ),
    );

    final double labelY = tester.getCenter(find.text('Pengguna PAC')).dy;
    final double placeholderY =
        tester.getCenter(find.text('Pilih salah satu')).dy;
    expect(labelY, lessThan(placeholderY - 6));

    await tester.tap(find.text('Pilih salah satu'));
    await tester.pumpAndSettle();

    expect(find.text('PILIHAN'), findsOneWidget);
    expect(find.text('Cari nama PAC…'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'PAC 11');
    await tester.pump();
    final Finder option = find.descendant(
      of: find.byType(ListTile),
      matching: find.text('PAC 11'),
    );
    expect(option, findsOneWidget);
    expect(find.text('PAC 1'), findsNothing);

    await tester.tap(option);
    await tester.pumpAndSettle();
    expect(selected, 'pac-10');
    expect(find.text('PAC 11'), findsOneWidget);
  });
}
