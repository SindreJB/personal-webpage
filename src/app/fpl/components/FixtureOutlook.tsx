import type { Analysis } from "@/lib/fpl/entry";
import { xp } from "@/lib/fpl/format";

/** Kampprogrammet for klubbene du faktisk eier spillere fra, sortert på snitt-FDR. */
export default function FixtureOutlook({ analysis }: { analysis: Analysis }) {
	const countByTeam = new Map<number, number>();
	for (const p of analysis.squad) countByTeam.set(p.teamId, (countByTeam.get(p.teamId) ?? 0) + 1);

	return (
		<div className="kk-scroll">
			<table className="kk-table">
				<thead>
					<tr>
						<th>Klubb</th>
						<th className="kk-num">Spillere</th>
						<th className="kk-num">Snitt-FDR</th>
						{analysis.horizon.map((ev) => (
							<th key={ev.id}>GW{ev.id}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{analysis.fixtureOutlook.map((t) => (
						<tr key={t.teamId}>
							<td>
								<span className="kk-player">{t.name}</span>
							</td>
							<td className="kk-num">{countByTeam.get(t.teamId) ?? 0}</td>
							<td className="kk-num">{t.averageDifficulty === null ? "—" : xp(t.averageDifficulty, 2)}</td>
							{t.perEvent.map((ev) => (
								<td key={ev.event}>
									{ev.opponents.length === 0 ? (
										<span className="kk-blank">blank</span>
									) : (
										ev.opponents.map((o) => (
											<span
												key={`${ev.event}-${o.short}-${o.isHome}`}
												className={`kk-fdr kk-fdr-${Math.min(5, Math.max(1, o.difficulty))}`}
												title={`${o.isHome ? "Hjemme mot" : "Borte mot"} ${o.short}`}
											>
												{o.isHome ? o.short.toUpperCase() : o.short.toLowerCase()}
											</span>
										))
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
