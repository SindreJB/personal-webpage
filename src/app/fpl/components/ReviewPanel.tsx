import { rank, signed, xp } from "@/lib/fpl/format";
import type { GameweekReview } from "@/lib/fpl/review";

function Delta({ value }: { value: number | null }) {
	if (value === null) return <span className="kk-sub">—</span>;
	return <span className={value >= 0 ? "kk-delta-pos" : "kk-delta-neg"}>{signed(value)}</span>;
}

/**
 * Etter runden: hva laget faktisk fikk, og — hvis prognosen ble lagret før
 * deadline — hvor langt unna modellen var. Uten den lagringen kan ingen av oss
 * i ettertid vite hva modellen egentlig trodde.
 */
export default function ReviewPanel({ review }: { review: GameweekReview }) {
	const sorted = [...review.players].sort((a, b) => b.counted - a.counted || b.actual - a.actual);

	return (
		<>
			<dl className="kk-stats">
				<div className="kk-stat">
					<dt>Poeng</dt>
					<dd>{review.points}</dd>
					<small>snitt {review.averageScore}</small>
				</div>
				<div className="kk-stat">
					<dt>Mot forventet</dt>
					<dd>{review.expectedTotal === null ? "—" : signed(review.expectedDelta ?? 0)}</dd>
					<small>{review.expectedTotal === null ? "ikke lagret" : `forventet ${xp(review.expectedTotal)}`}</small>
				</div>
				<div className="kk-stat">
					<dt>Benk</dt>
					<dd>{review.benchPoints}</dd>
					<small>{review.benchRegret > 0 ? `${review.benchRegret} tapt på feil ellever` : "riktig ellever"}</small>
				</div>
				<div className="kk-stat">
					<dt>Kaptein</dt>
					<dd>{review.captain ? review.captain.actual * review.captain.multiplier : "—"}</dd>
					<small>{review.captain?.name ?? "ukjent"}</small>
				</div>
				<div className="kk-stat">
					<dt>Total plassering</dt>
					<dd>{rank(review.overallRank)}</dd>
					<small>
						{review.rankMovement === null
							? "—"
							: review.rankMovement > 0
								? `opp ${rank(review.rankMovement)}`
								: `ned ${rank(Math.abs(review.rankMovement))}`}
					</small>
				</div>
				<div className="kk-stat">
					<dt>Bytter</dt>
					<dd>{review.transfersMade}</dd>
					<small>{review.transfersCost ? `−${review.transfersCost} i trekk` : "ingen trekk"}</small>
				</div>
			</dl>

			{review.notes.length > 0 ? (
				<ul className="kk-alerts">
					{review.notes.map((n) => (
						<li className="kk-alert kk-alert--low" key={n}>
							<span className="kk-alert-level">Notert</span>
							<span>{n}</span>
						</li>
					))}
				</ul>
			) : null}

			{review.expectedTotal !== null ? (
				<div className="kk-columns">
					<section className="kk-card">
						<h3>Overpresterte</h3>
						<ul className="kk-list">
							{review.best.map((p) => (
								<li key={p.element}>
									<span>{p.name}</span>
									<span className="kk-sub">
										{p.actual} mot {xp(p.expected ?? 0)} forventet
									</span>
								</li>
							))}
						</ul>
					</section>
					<section className="kk-card">
						<h3>Underpresterte</h3>
						<ul className="kk-list">
							{review.worst.map((p) => (
								<li key={p.element}>
									<span>{p.name}</span>
									<span className="kk-sub">
										{p.actual} mot {xp(p.expected ?? 0)} forventet
									</span>
								</li>
							))}
						</ul>
					</section>
				</div>
			) : null}

			<div className="kk-scroll">
				<table className="kk-table">
					<thead>
						<tr>
							<th>Spiller</th>
							<th className="kk-num">Min</th>
							<th className="kk-num">Poeng</th>
							<th className="kk-num">Telte</th>
							<th className="kk-num">Forventet</th>
							<th className="kk-num">Avvik</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map((p) => (
							<tr key={p.element} className={p.multiplier === 0 ? "kk-row-bench" : undefined}>
								<td>
									<span className="kk-player">{p.name}</span>
									{p.multiplier > 1 ? <span className="kk-tag kk-tag--c">C</span> : null}
									{p.wasAutoSubbed ? <span className="kk-tag">auto</span> : null}
									<br />
									<span className="kk-sub">
										{p.position} · {p.teamShort}
									</span>
								</td>
								<td className="kk-num">{p.minutes}</td>
								<td className="kk-num">{p.actual}</td>
								<td className="kk-num">{p.counted}</td>
								<td className="kk-num">{p.expected === null ? "—" : xp(p.expected)}</td>
								<td className="kk-num">
									<Delta value={p.delta} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{review.autoSubs.length > 0 ? (
				<p className="kk-note" style={{ marginTop: 12 }}>
					Automatiske innbytter: {review.autoSubs.map((s) => `${s.in} inn for ${s.out}`).join(", ")}.
				</p>
			) : null}
		</>
	);
}
