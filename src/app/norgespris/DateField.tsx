"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MONTH_NAMES } from "@/lib/strom/norgespris";
import {
  addDays,
  addMonths,
  clampDate as clamp,
  daysInMonth as daysIn,
  isoDate as iso,
  isValidDate as isValid,
  monthWeeks,
  parseDate as parse,
} from "@/lib/strom/dato";

/* ---------------------------------------------------------------
   Datofelt med egen kalender.

   Du kan fortsatt skrive datoen rett inn — feltet er et vanlig
   date-input — men kalenderen er vår egen, ikke nettleserens. Den
   native ser lys ut på svart bakgrunn, ikonet blir svart på svart,
   og Safari har lenge manglet den helt. Her tegner vi den selv og
   får samme oppførsel overalt.
   --------------------------------------------------------------- */

const WEEKDAYS = ["ma", "ti", "on", "to", "fr", "lø", "sø"];

type Props = {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
};

export default function DateField({ label, value, min, max, onChange }: Props) {
  // `draft` lar deg skrive ferdig uten at feltet hopper tilbake underveis.
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parse(value));
  const [focusDate, setFocusDate] = useState(value);

  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wantGridFocus = useRef(true);
  const dialogId = useId();

  useEffect(() => setDraft(value), [value]);

  // Lukk på Escape og klikk utenfor, og gi fokus tilbake til knappen.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Flytt fokus til dagen som er «aktiv» i rutenettet — men bare når den
  // flyttet seg fordi noen navigerte med tastaturet. Blar du med måneds-
  // knappene, skal fokus bli værende på knappen så du kan klikke videre.
  useEffect(() => {
    if (!open || !wantGridFocus.current) return;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')?.focus();
  }, [open, focusDate]);

  /** Brukes når verdien er ferdig: kalendervalg og når feltet forlates. */
  function commit(next: string) {
    const clamped = clamp(next, min, max);
    setDraft(clamped);
    onChange(clamped);
  }

  function openCalendar() {
    const start = clamp(isValid(draft) ? draft : value, min, max);
    wantGridFocus.current = true;
    setView(parse(start));
    setFocusDate(start);
    setOpen(true);
  }

  function pick(date: string) {
    commit(date);
    setOpen(false);
    buttonRef.current?.focus();
  }

  /** Tastaturnavigasjon i rutenettet — fokus følger med. */
  function moveFocus(next: string) {
    const clamped = clamp(next, min, max);
    wantGridFocus.current = true;
    setFocusDate(clamped);
    setView(parse(clamped));
  }

  /** Bla måned med knappene — fokus blir stående på knappen. */
  function goMonth(delta: number) {
    const next = clamp(addMonths(focusDate, delta), min, max);
    wantGridFocus.current = false;
    setFocusDate(next);
    setView(parse(next));
  }

  function onGridKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (moves[event.key] !== undefined) {
      event.preventDefault();
      moveFocus(addDays(focusDate, moves[event.key]));
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      moveFocus(addMonths(focusDate, event.key === "PageUp" ? -1 : 1));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const { y, m } = parse(focusDate);
      moveFocus(event.key === "Home" ? iso(y, m, 1) : iso(y, m, daysIn(y, m)));
    }
  }

  const monthStart = iso(view.y, view.m, 1);
  const monthEnd = iso(view.y, view.m, daysIn(view.y, view.m));
  const prevDisabled = addDays(monthStart, -1) < min;
  const nextDisabled = addDays(monthEnd, 1) > max;

  // Hele uker med mandag først; tomrom før den 1. og etter den siste.
  const weeks = monthWeeks(view.y, view.m);

  return (
    <div className="np-datefield" ref={wrapRef}>
      <span className="np-datefield-label">{label}</span>

      <div className="np-datefield-row">
        <input
          type="date"
          className="np-dateinput"
          value={draft}
          min={min}
          max={max}
          aria-label={label}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);

            // Mens du skriver lar vi feltet være i fred. Tom verdi betyr
            // «ikke ferdig skrevet», og årstallet er innom 0002 og 0202 på
            // vei til 2026 — klemmer vi mot min/max her, hopper feltet
            // under fingrene dine. Utenfor perioden sendes bare ikke
            // videre; blur rydder opp.
            if (isValid(next) && next >= min && next <= max) onChange(next);
          }}
          onBlur={() => {
            if (isValid(draft)) commit(draft);
            else setDraft(value);
          }}
        />

        <button
          type="button"
          ref={buttonRef}
          className="np-cal-open"
          aria-label={open ? "Lukk kalender" : "Velg dato i kalender"}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? dialogId : undefined}
          onClick={() => (open ? setOpen(false) : openCalendar())}
        >
          <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden focusable="false">
            <rect x="2.5" y="4" width="15" height="13.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2.5 8h15" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="np-cal" role="dialog" aria-modal="false" aria-label="Velg dato" id={dialogId}>
          <div className="np-cal-head">
            <button
              type="button"
              aria-label="Forrige måned"
              disabled={prevDisabled}
              onClick={() => goMonth(-1)}
            >
              ‹
            </button>
            <strong aria-live="polite">
              {MONTH_NAMES[view.m]} {view.y}
            </strong>
            <button
              type="button"
              aria-label="Neste måned"
              disabled={nextDisabled}
              onClick={() => goMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="np-cal-weekdays" aria-hidden>
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="np-cal-grid" ref={gridRef} role="grid" onKeyDown={onGridKeyDown}>
            {weeks.map((week, w) => (
              // Radene er `display: contents`, så rutenettet forblir sju
              // kolonner selv om ARIA krever et rad-nivå her.
              <div className="np-cal-row" role="row" key={week.find(Boolean) ?? `w${w}`}>
                {week.map((date, i) => {
                  if (!date) {
                    return <span key={`pad-${w}-${i}`} role="gridcell" className="np-cal-pad" />;
                  }

                  const disabled = date < min || date > max;
                  const selected = date === value;
                  const { d } = parse(date);

                  return (
                    <button
                      key={date}
                      type="button"
                      role="gridcell"
                      className="np-cal-day"
                      // Bare én dag er i tab-rekkefølgen; pilene flytter fokus.
                      tabIndex={date === focusDate ? 0 : -1}
                      data-active={date === focusDate}
                      data-selected={selected}
                      aria-selected={selected}
                      aria-current={selected ? "date" : undefined}
                      disabled={disabled}
                      onClick={() => pick(date)}
                      onFocus={() => setFocusDate(date)}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="np-cal-foot">
            <button type="button" onClick={() => pick(max)}>
              I dag
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
