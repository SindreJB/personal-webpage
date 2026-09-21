/* ---------------------------------------------------------------
   Norgespris-modellen.

   Alle priser regnes i NOK/kWh. Spotprisene fra hvakosterstrommen.no
   er *uten* mva, så all regning skjer eks. mva og ganges opp med
   mva-faktoren til slutt. Nord-Norge (NO4) har fritak for mva på strøm.
   --------------------------------------------------------------- */

export const PRICE_ZONES = [
  { id: "NO1", label: "NO1", name: "Øst-Norge", city: "Oslo" },
  { id: "NO2", label: "NO2", name: "Sør-Norge", city: "Kristiansand" },
  { id: "NO3", label: "NO3", name: "Midt-Norge", city: "Trondheim" },
  { id: "NO4", label: "NO4", name: "Nord-Norge", city: "Tromsø" },
  { id: "NO5", label: "NO5", name: "Vest-Norge", city: "Bergen" },
] as const;

export type ZoneId = (typeof PRICE_ZONES)[number]["id"];

export const DEFAULT_ZONE: ZoneId = "NO3";

/** Fastprisen i Norgespris, eks. mva. 40 øre = 50 øre inkl. mva. */
export const NORGESPRIS_EX_VAT = 0.4;

/** Strømstøtten dekker 90 % av alt over 77 øre/kWh eks. mva, time for time. */
export const SUBSIDY_THRESHOLD_EX_VAT = 0.77;
export const SUBSIDY_COVERAGE = 0.9;

/** Begge ordningene gjelder opp til 5 000 kWh per måned for en bolig. */
export const MONTHLY_CAP_KWH = 5000;

/** Ordningen trådte i kraft 1. oktober 2025. */
export const NORGESPRIS_START = "2025-10-01";

/** Dagen brukeren selv gikk over, med mindre noe annet velges. */
export const DEFAULT_START_DATE = "2026-09-17";

/** Gjennomsnittlig leilighet, to personer. */
export const DEFAULT_ANNUAL_KWH = 9000;

/** Typisk påslag fra kraftleverandør på en spotavtale, NOK/kWh eks. mva. */
export const DEFAULT_MARKUP = 0.05;

export function isZoneId(value: string): value is ZoneId {
  return PRICE_ZONES.some((z) => z.id === value);
}

export function zoneInfo(zone: ZoneId) {
  return PRICE_ZONES.find((z) => z.id === zone)!;
}

/** Strøm i Nordland, Troms og Finnmark er fritatt for merverdiavgift. */
export function vatFactor(zone: ZoneId): number {
  return zone === "NO4" ? 1 : 1.25;
}

/**
 * Andel av årsforbruket per måned (januar = index 0). Norsk husholdning er
 * varmedominert, så kurven følger fyringssesongen. Summerer til 1.
 */
export const MONTH_SHARE = [
  0.125, 0.113, 0.104, 0.083, 0.062, 0.049, 0.045, 0.05, 0.061, 0.08, 0.102, 0.126,
] as const;

export const MONTH_NAMES = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
] as const;

export const MONTH_SHORT = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
] as const;

/** Én dags aggregat, regnet ut fra de 24 timesprisene. Alt eks. mva. */
export type DayPrice = {
  /** ISO-dato, YYYY-MM-DD */
  date: string;
  /** Snitt spotpris, NOK/kWh eks. mva. */
  avgSpot: number;
  /** Snitt strømstøtte per kWh, NOK eks. mva-påslag. */
  avgSubsidy: number;
  /** Antall timer som ligger bak snittet (23/24/25 rundt sommertid). */
  hours: number;
};

export type MonthRow = {
  /** YYYY-MM */
  key: string;
  year: number;
  /** 0-indeksert */
  month: number;
  label: string;
  /** Hele månedens modellerte forbruk, kWh. */
  kwh: number;
  /** Timer med prisdata — en måned som ikke er ferdig har færre. */
  hours: number;
  /** Andel av måneden vi faktisk har priser for, 0–1. */
  coverage: number;
  avgSpot: number;
  avgSubsidy: number;
  /** Månedskostnad inkl. mva på spotavtale med strømstøtte. */
  costSpot: number;
  /** Månedskostnad inkl. mva med Norgespris. */
  costNorgespris: number;
  /** costSpot − costNorgespris for hele måneden. */
  savings: number;
  /** Andel av måneden som ligger etter oppstartsdatoen, 0–1. */
  countedShare: number;
  /** Besparelsen som faktisk teller, altså savings × countedShare. */
  countedSavings: number;
};

export type Assumptions = {
  zone: ZoneId;
  annualKwh: number;
  markup: number;
  /** ISO-dato brukeren gikk over til Norgespris. */
  startDate: string;
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Liste over YYYY-MM fra og med `from` til og med `to`. */
export function monthRange(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm - 1;
  while (y < ty || (y === ty && m <= tm - 1)) {
    out.push(monthKey(y, m));
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

/** Strømstøtte per kWh for én time, eks. mva-oppgang. */
export function hourlySubsidy(spotExVat: number): number {
  return Math.max(0, spotExVat - SUBSIDY_THRESHOLD_EX_VAT) * SUBSIDY_COVERAGE;
}

export type DayRow = {
  date: string;
  /** YYYY-MM */
  monthKey: string;
  label: string;
  kwh: number;
  hours: number;
  avgSpot: number;
  avgSubsidy: number;
  costSpot: number;
  costNorgespris: number;
  savings: number;
  /** Ligger dagen på eller etter oppstartsdatoen? */
  counted: boolean;
};

/**
 * Døgnet er regneenheten. Forbruket antas jevnt fordelt over døgnets timer —
 * den samme forenklingen strømkalkulatorer flest gjør, siden vi ikke har
 * timesmålingen din. Hver dag prises med sine egne priser, og måneder og
 * totaler er rene summer av dagene, slik at alle tallene på siden stemmer
 * overens uansett hvor i en måned oppstartsdatoen faller.
 */
export function buildDayRows(days: DayPrice[], a: Assumptions): DayRow[] {
  const vat = vatFactor(a.zone);

  return [...days]
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((d) => {
      const [year, monthNo, dayNo] = d.date.split("-").map(Number);
      const month = monthNo - 1;
      const total = daysInMonth(year, month);
      const kwh = Math.min(MONTHLY_CAP_KWH, a.annualKwh * MONTH_SHARE[month]) / total;

      const costSpot = kwh * (d.avgSpot + a.markup - d.avgSubsidy) * vat;
      const costNorgespris = kwh * NORGESPRIS_EX_VAT * vat;

      return {
        date: d.date,
        monthKey: d.date.slice(0, 7),
        label: `${dayNo}. ${MONTH_SHORT[month]}`,
        kwh,
        hours: d.hours,
        avgSpot: d.avgSpot,
        avgSubsidy: d.avgSubsidy,
        costSpot,
        costNorgespris,
        savings: costSpot - costNorgespris,
        counted: d.date >= a.startDate,
      };
    });
}

/** Ruller døgnradene opp til én rad per måned. Alt er summer, ingen snitt-av-snitt. */
export function buildMonthRows(dayRows: DayRow[]): MonthRow[] {
  const byMonth = new Map<string, DayRow[]>();

  for (const day of dayRows) {
    const bucket = byMonth.get(day.monthKey);
    if (bucket) bucket.push(day);
    else byMonth.set(day.monthKey, [day]);
  }

  const rows: MonthRow[] = [];

  for (const [key, bucket] of [...byMonth.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    const [year, monthNo] = key.split("-").map(Number);
    const month = monthNo - 1;

    const hours = bucket.reduce((sum, d) => sum + d.hours, 0);
    if (hours === 0) continue;

    const kwh = bucket.reduce((sum, d) => sum + d.kwh, 0);
    const costSpot = bucket.reduce((sum, d) => sum + d.costSpot, 0);
    const costNorgespris = bucket.reduce((sum, d) => sum + d.costNorgespris, 0);

    // Forbruksvektet snitt — det er den prisen kostnaden faktisk er regnet med.
    const avgSpot = bucket.reduce((sum, d) => sum + d.avgSpot * d.kwh, 0) / kwh;
    const avgSubsidy = bucket.reduce((sum, d) => sum + d.avgSubsidy * d.kwh, 0) / kwh;

    const counted = bucket.filter((d) => d.counted);

    rows.push({
      key,
      year,
      month,
      label: `${MONTH_SHORT[month]} ${String(year).slice(2)}`,
      kwh,
      hours,
      coverage: Math.min(1, bucket.length / daysInMonth(year, month)),
      avgSpot,
      avgSubsidy,
      costSpot,
      costNorgespris,
      savings: costSpot - costNorgespris,
      countedShare: counted.length / bucket.length,
      countedSavings: counted.reduce((sum, d) => sum + d.savings, 0),
    });
  }

  return rows;
}

export type Totals = {
  kwh: number;
  costSpot: number;
  costNorgespris: number;
  savings: number;
  /** Positivt tall betyr at Norgespris har lønt seg. */
  savingsPerKwh: number;
  /** Antall døgn med prisdata i perioden. */
  days: number;
};

/** Summerer bare døgnene som ligger på eller etter oppstartsdatoen. */
export function totalsSinceStart(dayRows: DayRow[]): Totals {
  let kwh = 0;
  let costSpot = 0;
  let costNorgespris = 0;
  let days = 0;

  for (const row of dayRows) {
    if (!row.counted) continue;
    kwh += row.kwh;
    costSpot += row.costSpot;
    costNorgespris += row.costNorgespris;
    days += 1;
  }

  return {
    kwh,
    costSpot,
    costNorgespris,
    savings: costSpot - costNorgespris,
    savingsPerKwh: kwh > 0 ? (costSpot - costNorgespris) / kwh : 0,
    days,
  };
}

export function formatKroner(value: number, decimals = 0): string {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatOre(nokPerKwh: number): string {
  return `${new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 }).format(nokPerKwh * 100)} øre`;
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${MONTH_NAMES[m - 1]} ${y}`;
}
