const socials = [
  { name: "github", handle: "@yourname", url: "https://github.com", bg: "bg-white" },
  { name: "twitter / x", handle: "@yourname", url: "https://x.com", bg: "bg-cyber" },
  { name: "instagram", handle: "@yourname", url: "https://instagram.com", bg: "bg-bubblegum" },
  { name: "linkedin", handle: "you", url: "https://linkedin.com", bg: "bg-violet text-white" },
  { name: "email", handle: "you@example.com", url: "mailto:you@example.com", bg: "bg-lime" },
];

export default function SocialsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-12 pb-20">
      <div className="brutal bg-violet text-white shadow-chunk-lg p-6 mb-8">
        <p className="font-mono text-xs bg-white text-black brutal inline-block px-2 py-0.5 shadow-chunk-sm">/socials</p>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">find me online 🌐</h1>
        <p className="mt-3 font-body opacity-90">edit src/app/socials/page.tsx and swap these for your real handles.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {socials.map((s, i) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className={`brutal ${s.bg} shadow-chunk p-5 flex justify-between items-center hover:-translate-y-1 transition-transform ${i % 2 ? "rotate-1" : "-rotate-1"} hover:rotate-0`}
          >
            <div>
              <div className="font-display text-3xl">{s.name}</div>
              <div className="font-mono text-xs opacity-80">{s.handle}</div>
            </div>
            <span className="font-mono">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
