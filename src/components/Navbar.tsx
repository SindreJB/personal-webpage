"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "home", color: "bg-bubblegum" },
  { href: "/projects", label: "projects", color: "bg-cyber" },
  { href: "/wishlist", label: "wishlist", color: "bg-lime" },
  { href: "/apartment", label: "apartment", color: "bg-sunset" },
  { href: "/cv", label: "cv", color: "bg-violet text-white" },
  { href: "/socials", label: "socials", color: "bg-white" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-black bg-chrome-50/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 brutal bg-holo bg-[length:300%_300%] animate-[holoshift_4s_ease_infinite] shadow-chunk-sm" />
          <span className="font-display text-3xl leading-none tracking-tight">home.exe</span>
        </Link>

        <button
          aria-label="menu"
          onClick={() => setOpen((o) => !o)}
          className="md:hidden brutal bg-white px-3 py-1 font-mono shadow-chunk-sm"
        >
          {open ? "✕" : "☰"}
        </button>

        <nav className="hidden md:flex items-center gap-2">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`brutal font-mono text-sm px-3 py-1.5 ${l.color} ${
                  active ? "shadow-chunk-sm translate-x-[2px] translate-y-[2px]" : "shadow-chunk-sm hover:-translate-y-0.5 transition-transform"
                }`}
              >
                {active && "▸ "}{l.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {open && (
        <nav className="md:hidden border-t-[3px] border-black bg-chrome-50 px-4 py-3 flex flex-col gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`brutal font-mono text-sm px-3 py-2 ${l.color} shadow-chunk-sm`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
