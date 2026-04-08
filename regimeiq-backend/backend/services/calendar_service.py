from __future__ import annotations

from datetime import date, datetime, timedelta
import calendar


def _first_friday(year: int, month: int) -> date:
    d = date(year, month, 1)
    while d.weekday() != 4:
        d += timedelta(days=1)
    return d


def _next_month(year: int, month: int) -> tuple[int, int]:
    if month == 12:
        return year + 1, 1
    return year, month + 1


def next_macro_releases(today: date | None = None) -> dict:
    if today is None:
        today = datetime.utcnow().date()

    y, m = today.year, today.month
    releases = []
    cy, cm = y, m
    for _ in range(4):
        releases.extend([
            {"event": "US Nonfarm Payrolls", "date": _first_friday(cy, cm).isoformat()},
            {"event": "US CPI", "date": date(cy, cm, min(13, calendar.monthrange(cy, cm)[1])).isoformat()},
            {"event": "US FOMC (approx)", "date": date(cy, cm, min(20, calendar.monthrange(cy, cm)[1])).isoformat()},
            {"event": "ECB Policy Decision (approx)", "date": date(cy, cm, min(18, calendar.monthrange(cy, cm)[1])).isoformat()},
            {"event": "BoJ Policy Decision (approx)", "date": date(cy, cm, min(19, calendar.monthrange(cy, cm)[1])).isoformat()},
            {"event": "UK CPI", "date": date(cy, cm, min(17, calendar.monthrange(cy, cm)[1])).isoformat()},
        ])
        cy, cm = _next_month(cy, cm)

    releases = [r for r in releases if date.fromisoformat(r["date"]) >= today]
    releases.sort(key=lambda r: r["date"])
    return {"as_of": today.isoformat(), "releases": releases[:12]}
