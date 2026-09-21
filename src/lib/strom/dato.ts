/* ---------------------------------------------------------------
   Datoregning på YYYY-MM-DD-strenger.

   Alt går via UTC. Bruker vi lokal tid her, vil `new Date(y, m, d)`
   i en tidssone vest for Greenwich kunne rulle over til dagen før
   når vi leser den ut igjen.
   --------------------------------------------------------------- */

export function parseDate(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = value.split("-").map(Number);
  return { y, m: m - 1, d };
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** Ukedag med mandag først: 0 = mandag, 6 = søndag. */
export function weekdayMondayFirst(y: number, m: number, d: number): number {
  return (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
}

export function clampDate(value: string, min: string, max: string): string {
  return value < min ? min : value > max ? max : value;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parseDate(value);
  return m >= 0 && m <= 11 && d >= 1 && d <= daysInMonth(y, m);
}

export function addDays(value: string, delta: number): string {
  const { y, m, d } = parseDate(value);
  const next = new Date(Date.UTC(y, m, d + delta));
  return isoDate(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
}

/** Beholder dagen i måneden der det går — 31. januar + 1 måned blir 28./29. februar. */
export function addMonths(value: string, delta: number): string {
  const { y, m, d } = parseDate(value);
  const target = new Date(Date.UTC(y, m + delta, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  return isoDate(ty, tm, Math.min(d, daysInMonth(ty, tm)));
}

/** Lokal dato, ikke UTC — rett etter midnatt i Norge er de to forskjellige. */
export function todayLocal(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Cellene i et månedsrutenett med mandag først. `null` er tomrommet før
 * den første i måneden.
 */
export function monthCells(y: number, m: number): (string | null)[] {
  const lead = weekdayMondayFirst(y, m, 1);
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth(y, m); d += 1) cells.push(isoDate(y, m, d));
  return cells;
}

/** Samme rutenett delt i hele uker à sju celler, etterfylt med `null`. */
export function monthWeeks(y: number, m: number): (string | null)[][] {
  const cells = monthCells(y, m);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
