import Link from "next/link";

type Entry = {
  href: string;
  number: string;
  title: string;
  detail?: string;
  className: string;
  external?: boolean;
};

const entries: Entry[] = [
  { href: "/fpl", number: "①", title: "Fantasy Premier League", detail: "krystallkulen", className: "tile-fpl" },
  { href: "/wishlist", number: "②", title: "Ønskeliste", detail: "wishlist", className: "tile-wishlist" },
  {
    href: "https://www.instagram.com/",
    number: "③",
    title: "Instagram",
    detail: "@sindrejentoftboe",
    className: "tile-instagram",
    external: true,
  },
  {
    href: "https://www.linkedin.com/",
    number: "④",
    title: "LinkedIn",
    detail: "professional profile",
    className: "tile-linkedin",
    external: true,
  },
  { href: "/cv", number: "⑤", title: "CV", detail: "curriculum vitae", className: "tile-cv" },
  {
    href: "https://github.com/SindreJB",
    number: "⑥",
    title: "GitHub",
    detail: "code & projects",
    className: "tile-github",
    external: true,
  },
];

function Entry({ entry }: { entry: Entry }) {
  const content = (
    <>
      <span className="catalog-number">{entry.number}</span>
      <span className={`catalog-title ${entry.className}`}>{entry.title}</span>
    </>
  );

  if (entry.external) {
    return (
      <a href={entry.href} target="_blank" rel="noreferrer" className="catalog-tile">
        {content}
      </a>
    );
  }

  return (
    <Link href={entry.href} className="catalog-tile">
      {content}
    </Link>
  );
}

export default function Home() {
  return (
    <main className="catalog-home">
      <header className="catalog-header">
        <Link href="/" className="catalog-brand">
          Sindre Jentoft Bøe
        </Link>
        <div className="catalog-intro">
          <p>
            Her finner du en liten samling av prosjekter, profiler
            <br className="desktop-break" /> og andre ting fra Sindre Jentoft Bøe.
            <br />
            Velg en rute for å gå videre.
          </p>
          <em>
            Dette er et personlig arkiv. Se deg rundt,
            <br className="desktop-break" /> og kom gjerne tilbake senere.
          </em>
        </div>
        <nav className="catalog-meta" aria-label="Utility links">
          <a href="mailto:hello@jantelov.no">Info</a>
          <a href="mailto:hello@jantelov.no">Kontakt</a>
          <a href="https://github.com/SindreJB" target="_blank" rel="noreferrer">
            Redux
          </a>
        </nav>
      </header>

      <section className="catalog-grid" aria-label="Site navigation">
        {entries.map((entry) => (
          <Entry key={entry.href} entry={entry} />
        ))}
      </section>
    </main>
  );
}
