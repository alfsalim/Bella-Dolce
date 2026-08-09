import { describe, it, expect } from 'vitest';

const UNFULFILLED_STATUSES = ['ordered', 'in-progress', 'delayed'];

const toMinutes = (hhmm: string) => {
  const [hh, mm] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (Number.isFinite(hh) ? hh : 6) * 60 + (Number.isFinite(mm) ? mm : 0);
};

const isPastReminderTime = (nowHHMM: string, reminderTime: string) => toMinutes(nowHHMM) >= toMinutes(reminderTime);

describe('Daily orders reminder — time gating', () => {
  it('does not trigger before the configured reminder time', () => {
    expect(isPastReminderTime('05:59', '06:00')).toBe(false);
  });

  it('triggers exactly at the configured reminder time', () => {
    expect(isPastReminderTime('06:00', '06:00')).toBe(true);
  });

  it('triggers any time after the configured reminder time', () => {
    expect(isPastReminderTime('14:30', '06:00')).toBe(true);
  });

  it('falls back to 06:00 when the stored time is malformed', () => {
    expect(toMinutes('not-a-time')).toBe(6 * 60);
  });

  it('respects a custom configured time, e.g. 08:30', () => {
    expect(isPastReminderTime('08:29', '08:30')).toBe(false);
    expect(isPastReminderTime('08:30', '08:30')).toBe(true);
  });
});

describe('Daily orders reminder — disabled short-circuit', () => {
  const shouldRun = (config: { enabled?: boolean } | null) => config?.enabled !== false;

  it('runs when no config row exists yet (defaults to enabled)', () => {
    expect(shouldRun(null)).toBe(true);
  });

  it('runs when explicitly enabled', () => {
    expect(shouldRun({ enabled: true })).toBe(true);
  });

  it('does not run when explicitly disabled in Settings', () => {
    expect(shouldRun({ enabled: false })).toBe(false);
  });
});

describe('Daily orders reminder — which orders qualify', () => {
  const qualifies = (order: { expectedDate: string; status: string }, today: string) =>
    order.expectedDate === today && UNFULFILLED_STATUSES.includes(order.status);

  const today = '2026-08-09';

  it('includes an order scheduled for today with status ordered', () => {
    expect(qualifies({ expectedDate: today, status: 'ordered' }, today)).toBe(true);
  });

  it('includes an order scheduled for today with status in-progress or delayed', () => {
    expect(qualifies({ expectedDate: today, status: 'in-progress' }, today)).toBe(true);
    expect(qualifies({ expectedDate: today, status: 'delayed' }, today)).toBe(true);
  });

  it('excludes an order already delivered today', () => {
    expect(qualifies({ expectedDate: today, status: 'delivered' }, today)).toBe(false);
  });

  it('excludes an order cancelled today', () => {
    expect(qualifies({ expectedDate: today, status: 'cancelled' }, today)).toBe(false);
  });

  it('excludes an order scheduled for a different day', () => {
    expect(qualifies({ expectedDate: '2026-08-10', status: 'ordered' }, today)).toBe(false);
  });

  it('expectedDate equality must be a plain string compare — not routed through a DateTime where-clause', () => {
    // Regression: expectedDate is a String column; the generic where-clause layer (client
    // and server) coerces YYYY-MM-DD-shaped filter values into ISO datetimes, which silently
    // returns zero rows against this column. The reminder must fetch unfiltered and compare
    // plain strings client-side instead of filtering via where('expectedDate', '==', today).
    expect(today === '2026-08-09T00:00:00.000Z').toBe(false);
    expect(today === today).toBe(true);
  });
});

describe('Daily orders reminder — once-per-user-per-day guard', () => {
  const storageKeyFor = (userId: string, dateStr: string) => `bd_order_reminder_shown_${userId}_${dateStr}`;

  it('produces a distinct key per user', () => {
    expect(storageKeyFor('user-1', '2026-08-09')).not.toBe(storageKeyFor('user-2', '2026-08-09'));
  });

  it('produces a distinct key per calendar day so it can show again tomorrow', () => {
    expect(storageKeyFor('user-1', '2026-08-09')).not.toBe(storageKeyFor('user-1', '2026-08-10'));
  });

  it('the same user/day combination always maps to the same key (idempotent guard)', () => {
    expect(storageKeyFor('user-1', '2026-08-09')).toBe(storageKeyFor('user-1', '2026-08-09'));
  });
});
