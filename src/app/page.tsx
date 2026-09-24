import Link from 'next/link';
import AsciiPortrait from '@/components/AsciiPortrait';
import CatalogMenu from '@/components/CatalogMenu';

type Entry = {
	href: string;
	number: string;
	title: string;
	detail?: string;
	className: string;
	external?: boolean;
};

const entries: Entry[] = [
	{
		href: '/fpl',
		number: '①',
		title: 'Fantasy Premier League',
		detail: 'krystallkulen',
		className: 'tile-fpl',
	},
	{
		href: '/norgespris',
		number: '②',
		title: 'Norgespris index',
		detail: 'strøm',
		className: 'tile-norgespris',
	},
	{
		href: 'https://www.instagram.com/',
		number: '③',
		title: 'Instagram',
		detail: '@sindrejentoftboe',
		className: 'tile-instagram',
		external: true,
	},
	{
		href: 'https://www.linkedin.com/',
		number: '④',
		title: 'LinkedIn',
		detail: 'professional profile',
		className: 'tile-linkedin',
		external: true,
	},
	{
		href: 'https://studplan.no',
		number: '⑤',
		title: 'studplan.no',
		detail: 'school schedule tool',
		className: 'tile-studplan',
		external: true,
	},
	{
		href: 'https://github.com/SindreJB',
		number: '⑥',
		title: 'GitHub',
		detail: 'code & projects',
		className: 'tile-github',
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
				<AsciiPortrait />
				<div className="catalog-meta">
					<CatalogMenu />
				</div>
			</header>

			<section className="catalog-grid" aria-label="Site navigation">
				{entries.map((entry) => (
					<Entry key={entry.href} entry={entry} />
				))}
			</section>
		</main>
	);
}
