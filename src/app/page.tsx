import Link from "next/link";

const tiles = [
  {
    href: "/projects",
    label: "side projects",
    desc: "things I built when I should've been sleeping",
    bg: "bg-cyber",
    rotate: "-rotate-2",
    emoji: "💾",
  },
  {
    href: "/wishlist",
    label: "birthday wishlist",
    desc: "spoil me (kindly) — duplicates auto-blocked",
    bg: "bg-lime",
    rotate: "rotate-1",
    emoji: "🎁",
  },
  {
    href: "/apartment",
    label: "new apartment",
    desc: "moodboards & 3D plans for the empty box",
    bg: "bg-sunset",
    rotate: "-rotate-1",
    emoji: "🏠",
  },
  {
    href: "/cv",
    label: "curriculum vitae",
    desc: "the professional™ version of me",
    bg: "bg-bubblegum",
    rotate: "rotate-2",
    emoji: "📄",
  },
  {
    href: "/socials",
    label: "find me online",
    desc: "links to the usual suspects",
    bg: "bg-violet text-white",
    rotate: "-rotate-2",
    emoji: "🌐",
  },
];

export default function Home() {
  return (
    <div className="relative">
      {/* Marquee */}
      <div className="border-y-[3px] border-black bg-black text-lime overflow-hidden py-2 font-mono uppercase tracking-widest">
        <div className="flex marquee whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-8 px-4">
              {Array.from({ length: 12 }).map((_, j) => (
                <span key={j}>★ welcome to the internet ★ now loading ★ please wait ★ </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="max-w-6xl mx-auto px-4 pt-16 pb-12 relative">
        {/* Decorative orbits */}
        <div className="absolute -top-4 right-4 w-32 h-32 rounded-full bg-bubblegum brutal shadow-chunk-lg wobble opacity-90 hidden md:block" />
        <div className="absolute top-40 -left-6 w-20 h-20 brutal bg-cyber shadow-chunk wobble hidden md:block" />

        <p className="font-mono text-sm bg-white brutal inline-block px-2 py-1 shadow-chunk-sm mb-6">
          C:\&gt; loading personality.exe<span className="blink">_</span>
        </p>

        <h1 className="font-display text-7xl md:text-9xl leading-[0.85] tracking-tight">
          hey, <br />
          i'm <span className="holo-text">building</span> <br />
          a little <br />
          corner of <br />
          the web.
        </h1>

        <p className="mt-8 max-w-xl font-body text-lg">
          welcome to my <span className="bg-lime brutal px-1.5">home base</span> — part portfolio, part
          junk drawer. poke around the buttons below. things may wobble. that's intentional.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/wishlist"
            className="glossy brutal bg-bubblegum text-black font-mono px-5 py-3 inline-flex items-center gap-2"
          >
            🎁 see the wishlist
          </Link>
          <Link
            href="/projects"
            className="glossy brutal bg-white text-black font-mono px-5 py-3 inline-flex items-center gap-2"
          >
            ▸ browse projects
          </Link>
        </div>
      </section>

      {/* Tile grid */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-[3px] flex-1 bg-black" />
          <h2 className="font-display text-4xl">pick a destination ▾</h2>
          <div className="h-[3px] flex-1 bg-black" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`group brutal ${t.bg} ${t.rotate} shadow-chunk p-5 hover:rotate-0 hover:-translate-y-1 transition-all duration-200`}
            >
              <div className="text-5xl mb-3">{t.emoji}</div>
              <div className="font-display text-3xl leading-none">{t.label}</div>
              <p className="font-mono text-xs mt-2 opacity-80">{t.desc}</p>
              <div className="mt-4 font-mono text-xs underline">open →</div>
            </Link>
          ))}

          {/* "Easter egg" tile */}
          <div className="brutal bg-white shadow-chunk p-5 rotate-1 flex flex-col">
            <div className="text-5xl mb-3">📟</div>
            <div className="font-display text-3xl leading-none">status</div>
            <div className="mt-3 font-mono text-xs space-y-1">
              <div className="flex justify-between"><span>mood:</span><span className="bg-lime brutal px-1">caffeinated</span></div>
              <div className="flex justify-between"><span>reading:</span><span>something fiction</span></div>
              <div className="flex justify-between"><span>listening:</span><span>too much techno</span></div>
              <div className="flex justify-between"><span>online:</span><span className="text-bubblegum">●</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
