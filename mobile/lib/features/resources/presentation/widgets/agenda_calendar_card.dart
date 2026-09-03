import 'package:flutter/material.dart';

import '../../../../app/theme/app_theme.dart';
import '../../data/resource_repository.dart';
import '../../domain/resource_models.dart';

class AgendaCalendarCard extends StatefulWidget {
  const AgendaCalendarCard({
    required this.activities,
    required this.repository,
    super.key,
  });

  final List<ResourceItem> activities;
  final ResourceDataSource repository;

  @override
  State<AgendaCalendarCard> createState() => _AgendaCalendarCardState();
}

class _AgendaCalendarCardState extends State<AgendaCalendarCard> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  late DateTime _selected = DateTime.now();
  late Future<List<AgendaHoliday>> _holidays;

  @override
  void initState() {
    super.initState();
    _holidays = _loadHolidays();
  }

  Future<List<AgendaHoliday>> _loadHolidays() async {
    final int year = DateTime.now().year;
    final List<List<AgendaHoliday>> result =
        await Future.wait<List<AgendaHoliday>>(<Future<List<AgendaHoliday>>>[
      widget.repository.agendaHolidays(year),
      widget.repository.agendaHolidays(year + 1),
    ]);
    return <AgendaHoliday>[...result[0], ...result[1]];
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
        child: Card(
          clipBehavior: Clip.antiAlias,
          child: ExpansionTile(
            leading: const Icon(Icons.calendar_month_outlined),
            title: const Text('Kalender kegiatan & PHBI'),
            subtitle: const Text('Agenda internal dan hari besar nasional'),
            childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            children: <Widget>[
              FutureBuilder<List<AgendaHoliday>>(
                future: _holidays,
                builder: (
                  BuildContext context,
                  AsyncSnapshot<List<AgendaHoliday>> snapshot,
                ) =>
                    _calendar(
                  context,
                  snapshot.data ?? const <AgendaHoliday>[],
                  holidayError: snapshot.hasError,
                ),
              ),
            ],
          ),
        ),
      );

  Widget _calendar(
    BuildContext context,
    List<AgendaHoliday> holidays, {
    required bool holidayError,
  }) {
    final int days = DateUtils.getDaysInMonth(_month.year, _month.month);
    final int leading = DateTime(_month.year, _month.month).weekday - 1;
    final int cells = ((leading + days + 6) ~/ 7) * 7;
    final List<ResourceItem> selectedActivities = widget.activities
        .where(
          (ResourceItem item) => _sameDate(
            DateTime.tryParse(item.text('tanggalMulai', ''))?.toLocal(),
            _selected,
          ),
        )
        .toList(growable: false);
    final List<AgendaHoliday> selectedHolidays = holidays
        .where((AgendaHoliday item) => _sameDate(item.date, _selected))
        .toList(growable: false);
    return Column(
      children: <Widget>[
        Row(
          children: <Widget>[
            IconButton(
              tooltip: 'Bulan sebelumnya',
              onPressed: () => setState(
                () => _month = DateTime(_month.year, _month.month - 1),
              ),
              icon: const Icon(Icons.chevron_left_rounded),
            ),
            Expanded(
              child: Text(
                '${_monthName(_month.month)} ${_month.year}',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton(
              tooltip: 'Bulan berikutnya',
              onPressed: () => setState(
                () => _month = DateTime(_month.year, _month.month + 1),
              ),
              icon: const Icon(Icons.chevron_right_rounded),
            ),
          ],
        ),
        Row(
          children: <Widget>[
            for (final String day in const <String>[
              'Sen',
              'Sel',
              'Rab',
              'Kam',
              'Jum',
              'Sab',
              'Min',
            ])
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Text(
                    day,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            childAspectRatio: 0.92,
          ),
          itemCount: cells,
          itemBuilder: (BuildContext context, int index) {
            final int day = index - leading + 1;
            if (day < 1 || day > days) return const SizedBox.shrink();
            final DateTime date = DateTime(_month.year, _month.month, day);
            final List<ResourceItem> activities = widget.activities
                .where(
                  (ResourceItem item) => _sameDate(
                    DateTime.tryParse(item.text('tanggalMulai', ''))?.toLocal(),
                    date,
                  ),
                )
                .toList(growable: false);
            final bool holiday = holidays.any(
              (AgendaHoliday item) => _sameDate(item.date, date),
            );
            final bool selected = _sameDate(date, _selected);
            final bool today = _sameDate(date, DateTime.now());
            return InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => setState(() => _selected = date),
              child: Container(
                margin: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: selected
                      ? Theme.of(context).colorScheme.primary.withOpacity(0.12)
                      : null,
                  borderRadius: BorderRadius.circular(10),
                  border: today
                      ? Border.all(color: Theme.of(context).colorScheme.primary)
                      : null,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    Text('$day'),
                    const SizedBox(height: 3),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: <Widget>[
                        if (activities.isNotEmpty)
                          _Dot(
                            color: _agendaColor(activities.first) ??
                                AppColors.cabang,
                          ),
                        if (holiday) ...<Widget>[
                          const SizedBox(width: 2),
                          const _Dot(color: AppColors.purple),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 8),
        if (holidayError)
          Text(
            'Kalender PHBI sedang tidak tersedia; agenda internal tetap ditampilkan.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        if (selectedActivities.isEmpty && selectedHolidays.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(
              'Tidak ada agenda pada ${_selected.day} ${_monthName(_selected.month)}.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          )
        else ...<Widget>[
          ...selectedHolidays.map<Widget>(
            (AgendaHoliday item) => _CalendarEntry(
              color: AppColors.purple,
              title: item.description,
              subtitle: 'Hari Libur / Peringatan Nasional',
            ),
          ),
          ...selectedActivities.map<Widget>(
            (ResourceItem item) => _CalendarEntry(
              color: _agendaColor(item) ?? AppColors.cabang,
              title: item.text('judul'),
              subtitle: <String>[
                item.text('lokasi', ''),
                item.text('status', ''),
              ].where((String value) => value.isNotEmpty).join(' · '),
            ),
          ),
        ],
      ],
    );
  }

  bool _sameDate(DateTime? left, DateTime right) =>
      left != null && DateUtils.isSameDay(left, right);

  Color? _agendaColor(ResourceItem item) {
    final String raw = item.text('warna', '');
    if (!RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(raw)) return null;
    return Color(int.parse('FF${raw.substring(1)}', radix: 16));
  }

  String _monthName(int month) => const <String>[
        'Januari',
        'Februari',
        'Maret',
        'April',
        'Mei',
        'Juni',
        'Juli',
        'Agustus',
        'September',
        'Oktober',
        'November',
        'Desember',
      ][month - 1];
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: 5,
        height: 5,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

class _CalendarEntry extends StatelessWidget {
  const _CalendarEntry({
    required this.color,
    required this.title,
    required this.subtitle,
  });

  final Color color;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border(left: BorderSide(color: color, width: 4)),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: Theme.of(context).textTheme.titleSmall),
                  if (subtitle.isNotEmpty)
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
            ),
          ],
        ),
      );
}
