import type { Analysis } from "@/lib/fpl/entry";
import { money, percent, signed, xp } from "@/lib/fpl/format";

/**
 * Konklusjonen, øverst. Alt under dette er begrunnelsen — og den skal kunne
 * motsi konklusjonen uten at siden faller fra hverandre.
 */
export default function Verdict({ analysis }: { analysis: Analysis }) {
	const { captain, bestEleven, transfers, lineup } = analysis;
	const plan =
		transfers.recommendation === "double" || transfers.recommendation === "hit"
			? (transfers.bestDouble ?? transfers.bestSingle)
			: transfers.bestSingle;

	return (
		<div className="kk-verdict">
			<section className="kk-card">
				<h3>Kaptein</h3>
				{captain ? (
					<>
						<p className="kk-card-headline">{captain.captain.name}</p>
						<p className="kk-card-sub">
							{xp(captain.captain.xp[0] ?? 0)} forventede poeng, doblet til {xp((captain.captain.xp[0] ?? 0) * 2)}.{" "}
							{percent(captain.captain.pStart)} sjanse for å starte.
							<br />
							{captain.rationale}
							{captain.viceCaptain ? (
								<>
									<br />
									Visekaptein: {captain.viceCaptain.name} ({xp(captain.viceCaptain.xp[0] ?? 0)}).
								</>
							) : null}
						</p>
					</>
				) : (
					<p className="kk-card-sub">Ingen ellever å lese kaptein fra.</p>
				)}
			</section>

			<section className="kk-card">
				<h3>Bytte</h3>
				{transfers.recommendation === "hold" || !plan ? (
					<>
						<p className="kk-card-headline">Behold laget</p>
						<p className="kk-card-sub">{transfers.summary}</p>
					</>
				) : (
					<>
						{plan.moves.map((m) => (
							<p className="kk-swap" key={m.out.id}>
								<span className="kk-out">{m.out.name}</span>
								<span className="kk-arrow">→</span>
								<span>{m.in.name}</span>
							</p>
						))}
						<p className="kk-card-sub">
							{signed(plan.netGain)} poeng over {analysis.horizon.length} runder
							{plan.hitCost > 0 ? ` etter −${plan.hitCost} i poengtrekk` : ""}, hvorav {signed(plan.gainNextGw)} allerede i GW
							{analysis.targetEvent.id}.
							<br />
							Bank etter byttet: {money(plan.moves[plan.moves.length - 1].bankAfter)}.
						</p>
					</>
				)}
			</section>

			<section className="kk-card">
				<h3>Ellever</h3>
				<p className="kk-card-headline">{bestEleven.formationLabel}</p>
				<p className="kk-card-sub">
					{xp(bestEleven.startersXp)} forventede poeng før kapteinsbindet, {xp(bestEleven.benchXp)} på benken.
					<br />
					{lineup.length === 0 ? (
						"Laget står allerede slik modellen ville satt det opp."
					) : (
						<>
							{lineup.map((c) => (
								<span key={c.in.id}>
									Inn: {c.in.name}
									{c.out ? ` for ${c.out.name}` : ""} ({signed(c.gain)}).
									<br />
								</span>
							))}
						</>
					)}
				</p>
			</section>
		</div>
	);
}
