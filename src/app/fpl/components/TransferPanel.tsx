import type { Analysis } from "@/lib/fpl/entry";
import { money, signed, xp } from "@/lib/fpl/format";
import type { TransferPlan } from "@/lib/fpl/transfers";

function PlanRow({ plan, label }: { plan: TransferPlan; label: string }) {
	const last = plan.moves[plan.moves.length - 1];
	return (
		<tr>
			<td>
				<span className="kk-sub">{label}</span>
				<br />
				{plan.moves.map((m) => (
					<span key={m.out.id} className="kk-player">
						<span className="kk-out">{m.out.name}</span> → {m.in.name}
						{plan.moves.length > 1 ? <br /> : null}
					</span>
				))}
				<br />
				<span className="kk-sub">
					{plan.moves
						.map((m) => `${m.out.teamShort} ${money(m.out.sellingPrice)} → ${m.in.teamShort} ${money(m.in.price)}`)
						.join(" · ")}
				</span>
			</td>
			<td className="kk-num">{signed(plan.gainNextGw)}</td>
			<td className="kk-num">{signed(plan.rawGain)}</td>
			<td className="kk-num">{plan.hitCost ? `−${plan.hitCost}` : "0"}</td>
			<td className={`kk-num ${plan.netGain >= 0 ? "kk-delta-pos" : "kk-delta-neg"}`}>
				<strong>{signed(plan.netGain)}</strong>
			</td>
			<td className="kk-num">{money(last.bankAfter)}</td>
		</tr>
	);
}

export default function TransferPanel({ analysis }: { analysis: Analysis }) {
	const { transfers, horizon } = analysis;
	const rows: { plan: TransferPlan; label: string }[] = [];
	if (transfers.bestSingle) rows.push({ plan: transfers.bestSingle, label: "Beste enkeltbytte" });
	if (transfers.bestDouble) rows.push({ plan: transfers.bestDouble, label: "Beste dobbeltbytte" });
	for (const [i, plan] of transfers.alternatives.entries()) {
		rows.push({ plan, label: `Alternativ ${i + 1}` });
	}

	return (
		<>
			<p className="kk-note" style={{ marginTop: 14 }}>
				{transfers.summary} Sammenligningen er gjort på startelleveren, ikke på hele troppen — et bytte er bare verdt
				noe hvis spilleren faktisk kommer inn på laget. Runder lenger fram vektes litt lavere enn de nærmeste.
			</p>
			<div className="kk-scroll">
				<table className="kk-table">
					<thead>
						<tr>
							<th>Bytte</th>
							<th className="kk-num">GW{horizon[0]?.id}</th>
							<th className="kk-num">{horizon.length} runder</th>
							<th className="kk-num">Trekk</th>
							<th className="kk-num">Netto</th>
							<th className="kk-num">Bank</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ? (
							<tr>
								<td colSpan={6}>Ingen lovlige bytter innenfor budsjettet.</td>
							</tr>
						) : (
							rows.map((r, i) => <PlanRow key={`${r.label}-${i}`} plan={r.plan} label={r.label} />)
						)}
					</tbody>
				</table>
			</div>
		</>
	);
}

export function Watchlist({ analysis }: { analysis: Analysis }) {
	return (
		<div className="kk-scroll">
			<table className="kk-table">
				<thead>
					<tr>
						<th>Spiller</th>
						<th className="kk-num">Pris</th>
						<th className="kk-num">Eid av</th>
						<th className="kk-num">GW{analysis.horizon[0]?.id}</th>
						<th className="kk-num">{analysis.horizon.length} runder</th>
						<th>Merknad</th>
					</tr>
				</thead>
				<tbody>
					{analysis.watchlist.map((p) => (
						<tr key={p.id}>
							<td>
								<span className="kk-player">{p.name}</span>
								<br />
								<span className="kk-sub">
									{p.position} · {p.teamShort}
								</span>
							</td>
							<td className="kk-num">{money(p.price)}</td>
							<td className="kk-num">{p.selectedBy.toFixed(1)} %</td>
							<td className="kk-num">{xp(p.xp[0] ?? 0)}</td>
							<td className="kk-num">
								<strong>{xp(p.xpTotal)}</strong>
							</td>
							<td className="kk-sub">{p.flags.find((f) => f.kind !== "price")?.text ?? p.priceRisk.label}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
