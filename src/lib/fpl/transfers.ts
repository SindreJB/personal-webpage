import { signed } from "./format";
import type { PlayerProjection } from "./projection";
import { pickBestEleven, type SquadPlayer } from "./squad";

export type TransferMove = {
	out: SquadPlayer;
	in: PlayerProjection;
	/** Endring i lagverdi i tideler. Positivt = penger igjen i banken. */
	cashDelta: number;
	bankAfter: number;
};

export type TransferPlan = {
	moves: TransferMove[];
	/** Forventet gevinst på startelleveren over hele horisonten, før poengtrekk. */
	rawGain: number;
	hitCost: number;
	/** rawGain minus poengtrekk. Dette er tallet anbefalingen rangeres på. */
	netGain: number;
	gainNextGw: number;
	transfersUsed: number;
};

export type TransferAdvice = {
	baselineHorizonXp: number;
	baselineNextGw: number;
	freeTransfers: number;
	bank: number;
	/** Beste enkeltbytte, uansett om det lønner seg. */
	bestSingle: TransferPlan | null;
	/** Nest beste alternativer, til sammenligning. */
	alternatives: TransferPlan[];
	/** Beste dobbeltbytte — tas bare med hvis det slår enkeltbyttet. */
	bestDouble: TransferPlan | null;
	recommendation: "hold" | "single" | "double" | "hit";
	summary: string;
};

/** Hvor mye mindre en gameweek langt fram teller. */
const DECAY = 0.93;
/** Under dette er gevinsten for liten til å bruke et bytte på. */
const HOLD_THRESHOLD = 1.2;
const HIT_COST = 4;

function horizonValue(squad: SquadPlayer[], slots: number): { total: number; next: number } {
	let total = 0;
	let next = 0;
	for (let slot = 0; slot < slots; slot++) {
		const xi = pickBestEleven(squad, slot).startersXp;
		if (slot === 0) next = xi;
		total += xi * Math.pow(DECAY, slot);
	}
	return { total, next };
}

function toSquadPlayer(p: PlayerProjection, template: SquadPlayer): SquadPlayer {
	return {
		...p,
		squadPosition: template.squadPosition,
		isCaptain: false,
		isViceCaptain: false,
		multiplier: template.multiplier,
		purchasePrice: p.price,
		sellingPrice: p.price,
	};
}

function clubCounts(squad: { teamId: number }[]) {
	const counts = new Map<number, number>();
	for (const p of squad) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
	return counts;
}

/** Spillere det aldri gir mening å foreslå: sluttet i klubben, langtidsskadet, ikke valgbare. */
function isSelectable(p: PlayerProjection) {
	if (p.status === "u") return false;
	if (p.availabilityNext <= 0 && p.xpTotal < 1) return false;
	return true;
}

type Candidate = { player: PlayerProjection; out: SquadPlayer };

/**
 * Plukker ut et håndterbart kandidatfelt. Uten dette blir søket 15 × 700
 * kombinasjoner per gameweek, og sidelastingen merkbar.
 */
function candidateField(
	squad: SquadPlayer[],
	pool: PlayerProjection[],
	bank: number,
	perPosition: number,
): Candidate[] {
	const owned = new Set(squad.map((p) => p.id));
	const counts = clubCounts(squad);
	const out: Candidate[] = [];

	for (const seller of squad) {
		const budget = bank + seller.sellingPrice;
		const affordable = pool
			.filter(
				(p) =>
					!owned.has(p.id) &&
					p.elementType === seller.elementType &&
					p.price <= budget &&
					isSelectable(p) &&
					// Maks tre fra samme klubb, etter at selgeren er ute.
					(counts.get(p.teamId) ?? 0) - (p.teamId === seller.teamId ? 1 : 0) < 3,
			)
			.sort((a, b) => b.xpTotal - a.xpTotal)
			.slice(0, perPosition);
		for (const player of affordable) out.push({ player, out: seller });
	}
	return out;
}

function planFor(
	squad: SquadPlayer[],
	moves: TransferMove[],
	baseline: { total: number; next: number },
	slots: number,
	freeTransfers: number,
): TransferPlan {
	let next = [...squad];
	for (const m of moves) {
		next = next.map((p) => (p.id === m.out.id ? toSquadPlayer(m.in, m.out) : p));
	}
	const value = horizonValue(next, slots);
	const hitCost = Math.max(0, moves.length - freeTransfers) * HIT_COST;
	const rawGain = value.total - baseline.total;
	return {
		moves,
		rawGain,
		hitCost,
		netGain: rawGain - hitCost,
		gainNextGw: value.next - baseline.next,
		transfersUsed: moves.length,
	};
}

export function adviseTransfers(
	squad: SquadPlayer[],
	pool: PlayerProjection[],
	opts: { bank: number; freeTransfers: number; slots: number; perPosition?: number },
): TransferAdvice {
	const { bank, freeTransfers, slots } = opts;
	const perPosition = opts.perPosition ?? 25;
	const baseline = horizonValue(squad, slots);

	const singles: TransferPlan[] = [];
	for (const c of candidateField(squad, pool, bank, perPosition)) {
		const cashDelta = c.out.sellingPrice - c.player.price;
		const move: TransferMove = { out: c.out, in: c.player, cashDelta, bankAfter: bank + cashDelta };
		singles.push(planFor(squad, [move], baseline, slots, freeTransfers));
	}
	singles.sort((a, b) => b.netGain - a.netGain);

	const bestSingle = singles[0] ?? null;

	// Dobbeltbytte søkes grådig: legg beste enkeltbytte til grunn og let videre.
	let bestDouble: TransferPlan | null = null;
	if (bestSingle && squad.length === 15) {
		const first = bestSingle.moves[0];
		const afterFirst = squad.map((p) => (p.id === first.out.id ? toSquadPlayer(first.in, first.out) : p));
		const bankAfter = first.bankAfter;
		const secondField = candidateField(afterFirst, pool, bankAfter, Math.max(10, Math.floor(perPosition / 2)));
		let best: TransferPlan | null = null;
		for (const c of secondField) {
			if (c.out.id === first.in.id) continue; // ikke selg spilleren vi nettopp kjøpte
			const cashDelta = c.out.sellingPrice - c.player.price;
			const move: TransferMove = { out: c.out, in: c.player, cashDelta, bankAfter: bankAfter + cashDelta };
			const plan = planFor(squad, [first, move], baseline, slots, freeTransfers);
			if (!best || plan.netGain > best.netGain) best = plan;
		}
		bestDouble = best;
	}

	let recommendation: TransferAdvice["recommendation"] = "hold";
	if (bestDouble && bestSingle && bestDouble.netGain > bestSingle.netGain && bestDouble.netGain > HOLD_THRESHOLD) {
		recommendation = bestDouble.hitCost > 0 ? "hit" : "double";
	} else if (bestSingle && bestSingle.netGain > HOLD_THRESHOLD) {
		recommendation = bestSingle.hitCost > 0 ? "hit" : "single";
	}

	const chosen = recommendation === "double" || recommendation === "hit" ? (bestDouble ?? bestSingle) : bestSingle;

	const summary =
		recommendation === "hold"
			? bestSingle
				? `Ingen bytter peker seg ut. Beste alternativ (${bestSingle.moves[0].out.name} → ${bestSingle.moves[0].in.name}) gir bare ${signed(bestSingle.netGain)} poeng over ${slots} runder — spar byttet.`
				: "Ingen lovlige bytter innenfor budsjettet."
			: chosen
				? `${chosen.moves.map((m) => `${m.out.name} → ${m.in.name}`).join(" og ")} gir ${signed(chosen.netGain)} poeng netto over ${slots} runder${chosen.hitCost ? ` (etter −${chosen.hitCost} i poengtrekk)` : ""}.`
				: "Ingen lovlige bytter innenfor budsjettet.";

	return {
		baselineHorizonXp: baseline.total,
		baselineNextGw: baseline.next,
		freeTransfers,
		bank,
		bestSingle,
		alternatives: singles.slice(1, 6),
		bestDouble,
		recommendation,
		summary,
	};
}
