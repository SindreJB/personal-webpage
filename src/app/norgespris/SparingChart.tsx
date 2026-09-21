"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatKroner, type DayRow, type MonthRow } from "@/lib/strom/norgespris";

/* Kategoriske slott 1 og 2, steget for mørk flate. Validert mot #000:
   CVD ΔE 26.8, normalsyn ΔE 31.8, begge over 3:1 mot flaten. */
const SERIES_NORGESPRIS = "#3987e5";
const SERIES_SPOT = "#d95926";

const VB_W = 960;
const MAX_BAR_PX = 24;
const BAR_GAP_PX = 2; // flatefargen skiller stolpene, ikke en strek

/**
 * SVG-en skaleres med containeren, så alt som skal ha en fast størrelse på
 * skjermen må ganges opp med hvor mange viewBox-enheter det går på én CSS-px.
 * Uten dette blir aksetekst på mobil fire piksler høy.
 */
function useViewboxScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(VB_W);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, k: VB_W / width, width };
}

/** Stolpe med 4px avrundet dataende og firkantet fot mot grunnlinja. */
function barPath(x: number, y: number, w: number, h: number, radius: number): string {
  if (h <= 0.5) return `M${x},${y} h${w}`;
  const r = Math.min(radius, w / 2, h);
  return [
    `M${x},${y + h}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}

/** Pene akseverdier: 1 / 2 / 2.5 / 5 × 10ⁿ. */
function niceTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

/** Grov, men konservativ tekstbredde — nok til å unngå at merkelapper kolliderer. */
function textWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.58;
}

type Hover = { index: number; x: number; y: number };

export function MonthlyCostChart({ rows }: { rows: MonthRow[] }) {
  const { ref, k } = useViewboxScale();
  const [hover, setHover] = useState<Hover | null>(null);

  const layout = useMemo(() => {
    const axisFont = 11 * k;
    const ticks = niceTicks(
      Math.max(1, ...rows.map((r) => Math.max(r.costSpot, r.costNorgespris)))
    );
    const top = ticks[ticks.length - 1];

    const widestTick = Math.max(...ticks.map((t) => textWidth(formatKroner(t), axisFont)));
    const pad = {
      top: 26 * k,
      right: 14 * k,
      bottom: 34 * k,
      left: Math.max(36 * k, widestTick + 14 * k),
    };

    const plotW = VB_W - pad.left - pad.right;
    // ~300 CSS px høy, men aldri smalere enn omtrent 3:2 på en telefon.
    const plotH = Math.min(620, Math.max(150, 300 * k));
    const band = rows.length > 0 ? plotW / rows.length : plotW;

    const gap = BAR_GAP_PX * k;
    const barW = Math.max(2, Math.min(MAX_BAR_PX * k, ((band - gap) / 2) * 0.8));

    // Hopp over aksemerker som ikke får plass ved siden av hverandre.
    const stride = Math.max(
      1,
      Math.ceil(Math.max(...rows.map((r) => textWidth(r.label, axisFont)), 1) / band)
    );

    return {
      ticks,
      pad,
      plotW,
      plotH,
      band,
      gap,
      barW,
      axisFont,
      stride,
      height: pad.top + plotH + pad.bottom,
      scale: (v: number) => plotH - (v / top) * plotH,
    };
  }, [rows, k]);

  if (rows.length === 0) return null;

  const { ticks, pad, plotW, plotH, band, gap, barW, axisFont, stride, height, scale } = layout;
  const pairW = barW * 2 + gap;

  // Merk den dyreste måneden direkte — resten leses av aksen og tooltipen.
  const peak = rows.reduce((best, r, i) => (r.costSpot > rows[best].costSpot ? i : best), 0);
  const active = hover ? rows[hover.index] : null;

  function track(index: number, event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    setHover({
      index,
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    });
  }

  return (
    <figure className="np-figure">
      <figcaption className="np-figcap">
        <h2>Månedskostnad for strøm</h2>
        <p>
          Modellert energikostnad inkl. mva, uten nettleie. Måneder før du gikk over til
          Norgespris er tonet ned.
        </p>
        <div className="np-legend" role="list">
          <span role="listitem">
            <i style={{ background: SERIES_NORGESPRIS }} aria-hidden /> Med Norgespris
          </span>
          <span role="listitem">
            <i style={{ background: SERIES_SPOT }} aria-hidden /> Uten — spot + strømstøtte
          </span>
        </div>
      </figcaption>

      <div className="np-plot" ref={ref}>
        <svg
          viewBox={`0 0 ${VB_W} ${height}`}
          className="np-svg"
          role="img"
          aria-label="Stolpediagram som sammenligner månedlig strømkostnad med og uten Norgespris"
        >
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={0}
                  x2={plotW}
                  y1={scale(t)}
                  y2={scale(t)}
                  stroke={t === 0 ? "#383835" : "#2c2c2a"}
                  strokeWidth={1}
                />
                <text
                  x={-10 * k}
                  y={scale(t)}
                  className="np-tick"
                  style={{ fontSize: axisFont }}
                  textAnchor="end"
                  dy="0.32em"
                >
                  {formatKroner(t)}
                </text>
              </g>
            ))}

            {rows.map((row, i) => {
              const cx = i * band + band / 2;
              const left = cx - pairW / 2;
              const dim = row.countedShare <= 0;
              const yN = scale(row.costNorgespris);
              const yS = scale(row.costSpot);
              const showLabel = (rows.length - 1 - i) % stride === 0;

              return (
                <g key={row.key} opacity={dim ? 0.34 : 1}>
                  <path d={barPath(left, yN, barW, plotH - yN, 4 * k)} fill={SERIES_NORGESPRIS} />
                  <path
                    d={barPath(left + barW + gap, yS, barW, plotH - yS, 4 * k)}
                    fill={SERIES_SPOT}
                  />
                  {i === peak && !dim && stride === 1 && (
                    <text
                      x={cx}
                      y={Math.min(yN, yS) - 9 * k}
                      className="np-peak"
                      style={{ fontSize: 12 * k }}
                      textAnchor="middle"
                    >
                      {formatKroner(row.costSpot)} kr
                    </text>
                  )}
                  {showLabel && (
                    <text
                      x={cx}
                      y={plotH + 20 * k}
                      className="np-axis"
                      style={{ fontSize: axisFont }}
                      textAnchor="middle"
                    >
                      {row.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Treffsonene er hele båndet, ikke bare stolpene. */}
            {rows.map((row, i) => (
              <rect
                key={`hit-${row.key}`}
                x={i * band}
                y={0}
                width={band}
                height={plotH}
                fill="transparent"
                className="np-hit"
                onPointerMove={(e) => track(i, e)}
                onPointerDown={(e) => track(i, e)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>

        {active && hover && (
          <div
            className="np-tooltip"
            style={{
              left: `${hover.x}%`,
              top: `${hover.y}%`,
              transform: `translate(${hover.x > 58 ? "-106%" : "6%"}, -50%)`,
            }}
          >
            <strong>{active.label}</strong>
            <span className="np-tip-meta">{formatKroner(active.kwh)} kWh modellert forbruk</span>
            <dl>
              <div>
                <dt>
                  <i style={{ background: SERIES_NORGESPRIS }} aria-hidden /> Med Norgespris
                </dt>
                <dd>{formatKroner(active.costNorgespris)} kr</dd>
              </div>
              <div>
                <dt>
                  <i style={{ background: SERIES_SPOT }} aria-hidden /> Uten
                </dt>
                <dd>{formatKroner(active.costSpot)} kr</dd>
              </div>
              <div className="np-tip-sum">
                <dt>Differanse</dt>
                <dd>
                  {active.savings >= 0 ? "+" : "−"}
                  {formatKroner(Math.abs(active.savings))} kr
                </dd>
              </div>
            </dl>
            {active.countedShare <= 0 && <p className="np-tip-note">Før oppstartsdatoen din</p>}
          </div>
        )}
      </div>
    </figure>
  );
}

type Point = { label: string; value: number };

/**
 * Akkumulert besparelse fra oppstartsdatoen. Bruker døgn når perioden er
 * kortere enn to måneder, ellers måneder — én serie, så ingen legende.
 */
export function CumulativeSavingsChart({
  monthRows,
  dayRows,
}: {
  monthRows: MonthRow[];
  dayRows: DayRow[];
}) {
  const { ref, k } = useViewboxScale();

  const { points, grain } = useMemo(() => {
    const countedMonths = monthRows.filter((r) => r.countedShare > 0);
    let sum = 0;

    // Begge oppløsningene summerer de samme døgnbeløpene, så kurven ender
    // på nøyaktig det tallet som står i toppen av siden.
    if (countedMonths.length >= 2) {
      return {
        grain: "måned" as const,
        points: countedMonths.map((r) => {
          sum += r.countedSavings;
          return { label: r.label, value: sum };
        }),
      };
    }

    return {
      grain: "dag" as const,
      points: dayRows
        .filter((r) => r.counted)
        .map((r) => {
          sum += r.savings;
          return { label: r.label, value: sum };
        }),
    };
  }, [monthRows, dayRows]);

  const layout = useMemo(() => {
    const axisFont = 11 * k;
    const values = points.map((p) => p.value);
    const ticks = niceTicks(Math.max(1, ...values));
    const top = ticks[ticks.length - 1];
    const floor = Math.min(0, ...values);

    const widestTick = Math.max(...ticks.map((t) => textWidth(formatKroner(t), axisFont)));
    const endLabel = points.length
      ? `${formatKroner(points[points.length - 1].value)} kr`
      : "";

    const pad = {
      top: 22 * k,
      right: Math.max(24 * k, textWidth(endLabel, 12 * k) + 22 * k),
      bottom: 32 * k,
      left: Math.max(36 * k, widestTick + 14 * k),
    };

    const plotW = VB_W - pad.left - pad.right;
    const plotH = Math.min(420, Math.max(110, 190 * k));
    const stride = Math.max(
      1,
      Math.ceil(
        (Math.max(...points.map((p) => textWidth(p.label, axisFont)), 1) + 8 * k) /
          (plotW / Math.max(points.length - 1, 1))
      )
    );

    return {
      ticks,
      pad,
      plotW,
      plotH,
      axisFont,
      stride,
      height: pad.top + plotH + pad.bottom,
      x: (i: number) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotW),
      y: (v: number) => plotH - ((v - floor) / (top - floor || 1)) * plotH,
      floor,
    };
  }, [points, k]);

  if (points.length < 2) return null;

  const { ticks, pad, plotW, plotH, axisFont, stride, height, x, y, floor } = layout;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(floor)} L${x(0)},${y(floor)} Z`;
  const last = points[points.length - 1];

  return (
    <figure className="np-figure">
      <figcaption className="np-figcap">
        <h2>Spart så langt, akkumulert</h2>
        <p>
          Summen av differansen {grain} for {grain}, fra datoen du gikk over til Norgespris.
        </p>
      </figcaption>

      <div className="np-plot" ref={ref}>
        <svg
          viewBox={`0 0 ${VB_W} ${height}`}
          className="np-svg"
          role="img"
          aria-label="Linjediagram over akkumulert besparelse med Norgespris"
        >
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={0}
                  x2={plotW}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "#383835" : "#2c2c2a"}
                  strokeWidth={1}
                />
                <text
                  x={-10 * k}
                  y={y(t)}
                  className="np-tick"
                  style={{ fontSize: axisFont }}
                  textAnchor="end"
                  dy="0.32em"
                >
                  {formatKroner(t)}
                </text>
              </g>
            ))}

            <path d={area} fill={SERIES_NORGESPRIS} opacity={0.1} />
            <path
              d={line}
              fill="none"
              stroke={SERIES_NORGESPRIS}
              strokeWidth={2 * k}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Endepunktet med ring i flatefargen, så det leses der linja krysser. */}
            <circle
              cx={x(points.length - 1)}
              cy={y(last.value)}
              r={4.5 * k}
              fill={SERIES_NORGESPRIS}
              stroke="#000"
              strokeWidth={2 * k}
            />
            <text
              x={x(points.length - 1) + 12 * k}
              y={y(last.value)}
              className="np-endlabel"
              style={{ fontSize: 12 * k }}
              dy="0.32em"
            >
              {formatKroner(last.value)} kr
            </text>

            {points.map((p, i) =>
              (points.length - 1 - i) % stride === 0 ? (
                <text
                  key={p.label}
                  x={x(i)}
                  y={plotH + 20 * k}
                  className="np-axis"
                  style={{ fontSize: axisFont }}
                  textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                >
                  {p.label}
                </text>
              ) : null
            )}
          </g>
        </svg>
      </div>
    </figure>
  );
}
