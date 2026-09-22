"use client";

import { useEffect, useRef } from "react";
import { PORTRAIT, RAMP } from "@/lib/ascii-portrait";

// Tegn som kan dukke opp helt inntil musepekeren — litt støy gjør at effekten
// leser som "forstyrrelse" og ikke bare som lysere piksler.
const SCRAMBLE = "/\\|_-=+*#%@";

const ROWS = PORTRAIT.length;
const COLS = PORTRAIT[0].length;
const BASE_TEXT = PORTRAIT.join("\n");

// Tetthetsverdien bak hvert tegn, slik at vi kan flytte oss opp og ned rampen.
const BASE: number[] = [];
for (const row of PORTRAIT) {
  for (const char of row) {
    const index = RAMP.indexOf(char);
    BASE.push(index < 0 ? 0 : index);
  }
}

const RADIUS = 15; // hvor mange tegn ut fra pekeren bølgen når
const CELL_RATIO = 1.35; // linjehøyde delt på tegnbredde, se .catalog-portrait

export default function AsciiPortrait() {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const node = preRef.current;
    if (!node) return;
    const pre: HTMLPreElement = node;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let strength = 0; // 0 = uberørt bilde, 1 = full effekt
    let target = 0;
    let pointer = { col: -999, row: -999 };
    let start = 0;

    function paint(time: number) {
      const chars: string[] = [];
      const phase = reduceMotion ? 0 : (time - start) * 0.005;

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const base = BASE[row * COLS + col];

          if (strength < 0.002) {
            chars.push(RAMP[base]);
            continue;
          }

          const dx = col - pointer.col;
          const dy = (row - pointer.row) * CELL_RATIO;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const influence = Math.max(0, 1 - distance / RADIUS);

          if (influence <= 0) {
            chars.push(RAMP[base]);
            continue;
          }

          const wave = Math.sin(distance * 0.8 - phase);
          const shift = strength * influence * (2.8 * wave + 1.6 * influence);
          // Tomme felt får bare så vidt lov til å tennes, ellers mister
          // silhuetten formen sin.
          const ceiling = base === 0 ? 2 : RAMP.length - 1;
          let next = Math.round(base + shift);
          if (next < 0) next = 0;
          if (next > ceiling) next = ceiling;

          if (influence > 0.72 && Math.random() < 0.1 * strength) {
            chars.push(SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0]);
          } else {
            chars.push(RAMP[next]);
          }
        }
        if (row < ROWS - 1) chars.push("\n");
      }

      pre.textContent = chars.join("");
    }

    function tick(time: number) {
      if (!start) start = time;
      strength += (target - strength) * 0.12;
      paint(time);

      if (target > 0 || strength > 0.002) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        strength = 0;
        pre.textContent = BASE_TEXT;
      }
    }

    function ensureLoop() {
      if (!frame) frame = requestAnimationFrame(tick);
    }

    function onPointerMove(event: PointerEvent) {
      const rect = pre.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer = {
        col: ((event.clientX - rect.left) / rect.width) * COLS,
        row: ((event.clientY - rect.top) / rect.height) * ROWS,
      };
      target = 1;
      ensureLoop();
    }

    function onPointerLeave() {
      target = 0;
      ensureLoop();
    }

    pre.addEventListener("pointermove", onPointerMove);
    pre.addEventListener("pointerleave", onPointerLeave);
    pre.addEventListener("pointercancel", onPointerLeave);

    return () => {
      pre.removeEventListener("pointermove", onPointerMove);
      pre.removeEventListener("pointerleave", onPointerLeave);
      pre.removeEventListener("pointercancel", onPointerLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="catalog-portrait" role="img" aria-label="ASCII-portrett av Sindre Jentoft Bøe">
      <pre ref={preRef} aria-hidden="true">
        {BASE_TEXT}
      </pre>
    </div>
  );
}
