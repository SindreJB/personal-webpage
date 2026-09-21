import { NextResponse } from "next/server";
import { hourlySubsidy, isZoneId, type DayPrice } from "@/lib/strom/norgespris";

/* ---------------------------------------------------------------
   GET /api/strom/priser?zone=NO3&month=2026-09

   Henter døgnfilene fra hvakosterstrommen.no for én måned og
   koker dem ned til ett aggregat per dag. Én måned per kall holder
   svaret innenfor tidsbudsjettet — klienten ber om månedene den
   trenger og setter dem sammen selv.

   Data: hvakosterstrommen.no (gratis, ingen nøkkel). Prisene er
   spotpris eks. mva, NOK/kWh.
   --------------------------------------------------------------- */

const SOURCE = "https://www.hvakosterstrommen.no/api/v1/prices";
const CONCURRENCY = 8;

type HourEntry = {
  NOK_per_kWh: number;
  time_start: string;
  time_end: string;
};

/** Kjører `worker` over listen med et tak på hvor mange som er i lufta. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

async function fetchDay(zone: string, year: number, month: number, day: number, fresh: boolean) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const url = `${SOURCE}/${year}/${mm}-${dd}_${zone}.json`;

  // Historikk endrer seg aldri; bare de siste dagene trenger kort levetid.
  const revalidate = fresh ? 60 * 60 : 60 * 60 * 24 * 30;

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return null; // 404 = dagen finnes ikke ennå

  const hours = (await res.json()) as HourEntry[];
  if (!Array.isArray(hours) || hours.length === 0) return null;

  const spotSum = hours.reduce((sum, h) => sum + h.NOK_per_kWh, 0);
  const subsidySum = hours.reduce((sum, h) => sum + hourlySubsidy(h.NOK_per_kWh), 0);

  const price: DayPrice = {
    date: `${year}-${mm}-${dd}`,
    avgSpot: spotSum / hours.length,
    avgSubsidy: subsidySum / hours.length,
    hours: hours.length,
  };
  return price;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const zone = params.get("zone") ?? "";
  const month = params.get("month") ?? "";

  if (!isZoneId(zone)) {
    return NextResponse.json({ error: "Ukjent strømsone" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Måned må være på formen YYYY-MM" }, { status: 400 });
  }

  const [year, monthNo] = month.split("-").map(Number);
  if (monthNo < 1 || monthNo > 12) {
    return NextResponse.json({ error: "Ugyldig måned" }, { status: 400 });
  }

  const today = new Date();
  const lastDay = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  const isCurrentMonth =
    year === today.getFullYear() && monthNo === today.getMonth() + 1;

  // Ikke be om dager som ligger fram i tid.
  const until = isCurrentMonth ? Math.min(lastDay, today.getDate()) : lastDay;
  if (until < 1 || new Date(Date.UTC(year, monthNo - 1, 1)) > today) {
    return NextResponse.json({ zone, month, days: [] });
  }

  const dayNumbers = Array.from({ length: until }, (_, i) => i + 1);
  const freshFrom = isCurrentMonth ? until - 2 : Infinity;

  const settled = await mapWithLimit(dayNumbers, CONCURRENCY, (day) =>
    fetchDay(zone, year, monthNo, day, day >= freshFrom).catch(() => null)
  );

  const days = settled.filter((d): d is DayPrice => d !== null);

  return NextResponse.json(
    { zone, month, days },
    {
      headers: {
        // Ferdige måneder kan ligge lenge i kanten; inneværende måned kortere.
        "Cache-Control": isCurrentMonth
          ? "public, s-maxage=3600, stale-while-revalidate=86400"
          : "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
