import type { NormalizedFixture } from "@/lib/fpl/fixtures";

/**
 * Én celle per gameweek. Tom celle = blank runde, to merker = double.
 * Bortekamper vises i små bokstaver, slik FPL-folk er vant til å lese dem.
 */
export function FixtureCell({ fixtures }: { fixtures: NormalizedFixture[] }) {
	if (!fixtures.length) return <span className="kk-blank">blank</span>;
	return (
		<>
			{fixtures.map((f) => (
				<span
					key={f.fixtureId}
					className={`kk-fdr kk-fdr-${Math.min(5, Math.max(1, f.difficulty))}`}
					title={`${f.isHome ? "Hjemme mot" : "Borte mot"} ${f.opponentShort} — vanskelighetsgrad ${f.difficulty}`}
				>
					{f.isHome ? f.opponentShort.toUpperCase() : f.opponentShort.toLowerCase()}
				</span>
			))}
		</>
	);
}

export function FixtureLegend() {
	return (
		<p className="kk-note">
			Store bokstaver = hjemmekamp, små = borte. Fargen er FPL sin egen vanskelighetsgrad, fra{" "}
			<span className="kk-fdr kk-fdr-1">1</span> <span className="kk-fdr kk-fdr-3">3</span>{" "}
			<span className="kk-fdr kk-fdr-5">5</span>.
		</p>
	);
}
