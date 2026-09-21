import type { Analysis } from "@/lib/fpl/entry";
import { money } from "@/lib/fpl/format";
import type { PlayerProjection } from "@/lib/fpl/projection";

function Column({ title, players, empty }: { title: string; players: PlayerProjection[]; empty: string }) {
	return (
		<section className="kk-card">
			<h3>{title}</h3>
			{players.length === 0 ? (
				<p className="kk-card-sub">{empty}</p>
			) : (
				<ul className="kk-list">
					{players.map((p) => (
						<li key={p.id}>
							<span>
								{p.name} <span className="kk-sub">{p.teamShort}</span>
							</span>
							<span className="kk-sub">
								{money(p.price)} · {p.priceRisk.label.toLowerCase()}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

/**
 * Prisrisiko vises som nivå, ikke som prosent. FPL publiserer selv en
 * likelihood fra −5 til 5; å regne den om til «73 % sjanse» ville vært
 * en presisjon vi ikke har backtestet.
 */
export default function PriceWatch({ analysis }: { analysis: Analysis }) {
	const owned = new Set(analysis.squad.map((p) => p.id));
	const ownedFalling = analysis.priceWatch.falling.filter((p) => owned.has(p.id));
	const ownedRising = analysis.priceWatch.rising.filter((p) => owned.has(p.id));

	return (
		<>
			<div className="kk-columns">
				<Column
					title="Egne spillere som kan falle"
					players={ownedFalling}
					empty="Ingen i troppen ligger an til prisfall i natt."
				/>
				<Column
					title="Stiger i pris"
					players={analysis.priceWatch.rising}
					empty="Ingen tydelige prisstigninger akkurat nå."
				/>
				<Column
					title="Faller i pris"
					players={analysis.priceWatch.falling}
					empty="Ingen tydelige prisfall akkurat nå."
				/>
			</div>
			{ownedRising.length > 0 ? (
				<p className="kk-note" style={{ marginTop: 12 }}>
					{ownedRising.map((p) => p.name).join(", ")} stiger trolig i pris — det øker lagverdien din, men gjør dem
					dyrere å kjøpe tilbake senere.
				</p>
			) : null}
		</>
	);
}
