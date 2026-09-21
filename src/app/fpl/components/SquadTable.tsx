import type { Analysis } from "@/lib/fpl/entry";
import { money, percent, xp } from "@/lib/fpl/format";
import type { SquadPlayer } from "@/lib/fpl/squad";
import { FixtureCell } from "./Fixtures";

function StatusTag({ player }: { player: SquadPlayer }) {
	if (player.status === "a") return null;
	const label =
		player.status === "i" ? "skadet" : player.status === "s" ? "karantene" : player.status === "u" ? "ute" : "tvilsom";
	return <span className="kk-tag">{label}</span>;
}

function Row({
	player,
	captainId,
	viceId,
	bench,
	horizon,
}: {
	player: SquadPlayer;
	captainId?: number;
	viceId?: number;
	bench: boolean;
	horizon: { id: number }[];
}) {
	return (
		<tr className={bench ? "kk-row-bench" : undefined}>
			<td>
				<span className="kk-player">{player.name}</span>
				{player.id === captainId ? <span className="kk-tag kk-tag--c">C</span> : null}
				{player.id === viceId ? <span className="kk-tag">V</span> : null}
				<StatusTag player={player} />
				<br />
				<span className="kk-sub">
					{player.position} · {player.teamShort} · {money(player.price)}
					{player.sellingPrice !== player.price ? ` (selges ${money(player.sellingPrice)})` : ""}
				</span>
			</td>
			<td className="kk-num">{percent(player.pStart)}</td>
			{horizon.map((ev, slot) => (
				<td key={ev.id} className="kk-num">
					{xp(player.xp[slot] ?? 0)}
				</td>
			))}
			<td className="kk-num">
				<strong>{xp(player.xpTotal)}</strong>
			</td>
			{horizon.map((ev, slot) => (
				<td key={`f-${ev.id}`}>
					<FixtureCell fixtures={player.fixtures[slot] ?? []} />
				</td>
			))}
		</tr>
	);
}

/** Troppen i modellens rekkefølge: ellever først, så benk i innbytterekkefølge. */
export default function SquadTable({ analysis }: { analysis: Analysis }) {
	const { bestEleven, horizon, captain } = analysis;
	const benchOrder = [...(bestEleven.benchGoalkeeper ? [bestEleven.benchGoalkeeper] : []), ...bestEleven.bench];

	return (
		<div className="kk-scroll">
			<table className="kk-table">
				<thead>
					<tr>
						<th>Spiller</th>
						<th className="kk-num">Start</th>
						{horizon.map((ev) => (
							<th key={ev.id} className="kk-num">
								GW{ev.id}
							</th>
						))}
						<th className="kk-num">Sum</th>
						{horizon.map((ev) => (
							<th key={`h-${ev.id}`}>Kamp {ev.id}</th>
						))}
					</tr>
				</thead>
				<tbody>
					<tr className="kk-divider">
						<td colSpan={2 + horizon.length * 2 + 1}>Anbefalt ellever — {bestEleven.formationLabel}</td>
					</tr>
					{bestEleven.starters.map((p) => (
						<Row
							key={p.id}
							player={p}
							captainId={captain?.captain.id}
							viceId={captain?.viceCaptain?.id}
							bench={false}
							horizon={horizon}
						/>
					))}
					<tr className="kk-divider">
						<td colSpan={2 + horizon.length * 2 + 1}>Benk</td>
					</tr>
					{benchOrder.map((p) => (
						<Row key={p.id} player={p} bench horizon={horizon} />
					))}
				</tbody>
			</table>
		</div>
	);
}
