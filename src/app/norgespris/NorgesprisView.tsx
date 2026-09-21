"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildDayRows,
  buildMonthRows,
  DEFAULT_ANNUAL_KWH,
  DEFAULT_MARKUP,
  DEFAULT_START_DATE,
  DEFAULT_ZONE,
  formatDateLong,
  formatKroner,
  formatOre,
  monthRange,
  NORGESPRIS_EX_VAT,
  NORGESPRIS_START,
  PRICE_ZONES,
  SUBSIDY_THRESHOLD_EX_VAT,
  totalsSinceStart,
  vatFactor,
  zoneInfo,
  type DayPrice,
  type ZoneId,
} from "@/lib/strom/norgespris";
import { CumulativeSavingsChart, MonthlyCostChart } from "./SparingChart";

/** Lokal dato, ikke UTC — rett etter midnatt i Norge er de to forskjellige. */
function today(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

const TODAY = today();

/** Henter månedene parallelt, men med tak, og mater dem inn etter hvert. */
async function loadZone(
  zone: ZoneId,
  signal: AbortSignal,
  onMonth: (days: DayPrice[]) => void
): Promise<void> {
  const months = monthRange(NORGESPRIS_START.slice(0, 7), TODAY.slice(0, 7));
  let cursor = 0;

  const runners = Array.from({ length: Math.min(3, months.length) }, async () => {
    while (cursor < months.length) {
      const month = months[cursor++];
      const res = await fetch(`/api/strom/priser?zone=${zone}&month=${month}`, { signal });
      if (!res.ok) throw new Error(`Klarte ikke å hente priser for ${month}`);
      const body = (await res.json()) as { days: DayPrice[] };
      onMonth(body.days);
    }
  });

  await Promise.all(runners);
}

export default function NorgesprisView() {
  const [zone, setZone] = useState<ZoneId>(DEFAULT_ZONE);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [annualKwh, setAnnualKwh] = useState(DEFAULT_ANNUAL_KWH);
  const [markupOre, setMarkupOre] = useState(Math.round(DEFAULT_MARKUP * 100));
  const [showTable, setShowTable] = useState(false);

  const [days, setDays] = useState<DayPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const collected: DayPrice[] = [];

    setDays([]);
    setLoading(true);
    setError(null);

    loadZone(zone, controller.signal, (batch) => {
      collected.push(...batch);
      setDays([...collected]);
    })
      .then(() => setLoading(false))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Noe gikk galt under henting av priser");
        setLoading(false);
      });

    return () => controller.abort();
  }, [zone]);

  const assumptions = useMemo(
    () => ({ zone, annualKwh, markup: markupOre / 100, startDate }),
    [zone, annualKwh, markupOre, startDate]
  );

  // Døgnet er regneenheten; måneder og totaler er summer av de samme radene.
  const dayRows = useMemo(() => buildDayRows(days, assumptions), [days, assumptions]);
  const rows = useMemo(() => buildMonthRows(dayRows), [dayRows]);
  const totals = useMemo(() => totalsSinceStart(dayRows), [dayRows]);

  const zi = zoneInfo(zone);
  const vat = vatFactor(zone);
  const norgesprisIncl = NORGESPRIS_EX_VAT * vat;
  const winning = totals.savings >= 0;

  return (
    <div className="np">
      <header className="np-masthead">
        <Link href="/" className="np-back">
          ← Sindre Jentoft Bøe
        </Link>
        <p className="np-kicker">Strømsone {zi.id} · {zi.name}</p>
        <h1>Norgespris index</h1>
        <p className="np-lede">
          Hva Norgespris faktisk har gjort med strømregningen, regnet mot spotprisen i din sone
          og et gjennomsnittlig forbruk for en leilighet med to personer.
        </p>
      </header>

      <section className="np-controls" aria-label="Forutsetninger">
        <label>
          <span>Strømsone</span>
          <select value={zone} onChange={(e) => setZone(e.target.value as ZoneId)}>
            {PRICE_ZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.id} — {z.name} ({z.city})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Startet med Norgespris</span>
          <input
            type="date"
            value={startDate}
            min={NORGESPRIS_START}
            max={TODAY}
            onChange={(e) => setStartDate(e.target.value || DEFAULT_START_DATE)}
          />
        </label>

        <label>
          <span>Årsforbruk (kWh)</span>
          <input
            type="number"
            min={1000}
            max={40000}
            step={500}
            value={annualKwh}
            onChange={(e) => setAnnualKwh(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>

        <label>
          <span>Påslag (øre/kWh)</span>
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={markupOre}
            onChange={(e) => setMarkupOre(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      </section>

      {error && (
        <p className="np-error" role="alert">
          {error}
        </p>
      )}

      <section className="np-hero" aria-label="Oppsummering">
        <div className="np-hero-main">
          <p className="np-stat-label">
            {winning ? "Spart" : "Tapt"} siden {formatDateLong(startDate)}
          </p>
          <p className="np-hero-figure">
            {winning ? "" : "−"}
            {formatKroner(Math.abs(totals.savings))}
            <span> kr</span>
          </p>
          <p className="np-stat-sub">
            {winning
              ? "så mye billigere har Norgespris vært enn spotavtalen"
              : "så mye dyrere har Norgespris vært enn spotavtalen"}
          </p>
        </div>

        <dl className="np-stats">
          <div>
            <dt>Med Norgespris</dt>
            <dd>{formatKroner(totals.costNorgespris)} kr</dd>
            <p>{formatOre(norgesprisIncl)}/kWh fast</p>
          </div>
          <div>
            <dt>Uten Norgespris</dt>
            <dd>{formatKroner(totals.costSpot)} kr</dd>
            <p>spot + påslag − strømstøtte</p>
          </div>
          <div>
            <dt>Differanse per kWh</dt>
            <dd>{formatOre(totals.savingsPerKwh)}</dd>
            <p>
              {formatKroner(totals.kwh)} kWh over {totals.days} døgn
            </p>
          </div>
        </dl>
      </section>

      {loading && rows.length === 0 ? (
        <p className="np-loading">Henter timespriser for {zi.id} …</p>
      ) : (
        <>
          {loading && <p className="np-loading">Henter flere måneder …</p>}
          <MonthlyCostChart rows={rows} />
          <CumulativeSavingsChart monthRows={rows} dayRows={dayRows} />
        </>
      )}

      <section className="np-tablewrap">
        <button
          type="button"
          className="np-toggle"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
        >
          {showTable ? "Skjul tallene" : "Vis tallene"}
        </button>

        {showTable && (
          <table className="np-table">
            <caption>
              Alle beløp inkl. mva{vat === 1 ? " (Nord-Norge har mva-fritak på strøm)" : ""}, uten
              nettleie. «Teller» er den delen av måneden som ligger etter oppstartsdatoen.
            </caption>
            <thead>
              <tr>
                <th scope="col">Måned</th>
                <th scope="col">Forbruk</th>
                <th scope="col">Snitt spot</th>
                <th scope="col">Strømstøtte</th>
                <th scope="col">Uten</th>
                <th scope="col">Med</th>
                <th scope="col">Differanse</th>
                <th scope="col">Teller</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={r.countedShare <= 0 ? "np-row-dim" : undefined}>
                  <th scope="row">{r.label}</th>
                  <td>{formatKroner(r.kwh)} kWh</td>
                  <td>{formatOre(r.avgSpot)}</td>
                  <td>{r.avgSubsidy > 0 ? formatOre(r.avgSubsidy) : "—"}</td>
                  <td>{formatKroner(r.costSpot)}</td>
                  <td>{formatKroner(r.costNorgespris)}</td>
                  <td>
                    {r.savings >= 0 ? "+" : "−"}
                    {formatKroner(Math.abs(r.savings))}
                  </td>
                  <td>{Math.round(r.countedShare * 100)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="np-notes">
        <h2>Slik er det regnet</h2>
        <ul>
          <li>
            <strong>Norgespris</strong> er {formatOre(NORGESPRIS_EX_VAT)}/kWh eks. mva
            {vat === 1 ? " — og Nord-Norge betaler ikke mva på strøm" : `, altså ${formatOre(norgesprisIncl)}/kWh inkl. mva`}.
            Ordningen gjelder opp til 5 000 kWh per måned.
          </li>
          <li>
            <strong>Uten Norgespris</strong> betaler du spotprisen time for time, pluss påslaget
            til kraftleverandøren, minus strømstøtte: 90 % av alt over{" "}
            {formatOre(SUBSIDY_THRESHOLD_EX_VAT)}/kWh eks. mva, regnet per time. Du kan ikke ha
            begge ordningene samtidig.
          </li>
          <li>
            <strong>Forbruket</strong> er {formatKroner(annualKwh)} kWh i året fordelt på
            fyringssesongen — standardtallet for en leilighet med to personer. Det antas jevnt
            fordelt over døgnets timer, siden denne siden ikke kjenner din timesmåling.
          </li>
          <li>
            <strong>Nettleie er holdt utenfor.</strong> Den er den samme uansett hvilken
            strømavtale du har, så den påvirker ikke differansen.
          </li>
        </ul>
        <p className="np-source">
          Spotpriser fra{" "}
          <a href="https://www.hvakosterstrommen.no" target="_blank" rel="noreferrer">
            hvakosterstrommen.no
          </a>
          . Satsene for Norgespris og strømstøtte er hentet fra NVE og regjeringen.no.
        </p>
      </section>
    </div>
  );
}
