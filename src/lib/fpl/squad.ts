import { xp as fmtXp } from "./format";
import type { PlayerProjection, PositionShort } from "./projection";

export type SquadPlayer = PlayerProjection & {
	/** 1–15, slik FPL sorterer troppen. */
	squadPosition: number;
	isCaptain: boolean;
	isViceCaptain: boolean;
	multiplier: number;
	/** Kjøpspris i tideler. Utledet, se `entry.ts`. */
	purchasePrice: number;
	/** Salgspris i tideler: kjøpspris pluss halvparten av gevinsten, rundet ned. */
	sellingPrice: number;
};

export type Formation = { DEF: number; MID: number; FWD: number };

export type BestEleven = {
	starters: SquadPlayer[];
	bench: SquadPlayer[];
	/** Reservekeeper kommer alltid først på benken i FPL. */
	benchGoalkeeper: SquadPlayer | null;
	formation: Formation;
	formationLabel: string;
	startersXp: number;
	benchXp: number;
};

const VALID_FORMATIONS: Formation[] = [];
for (let d = 3; d <= 5; d++) {
	for (let m = 2; m <= 5; m++) {
		const f = 10 - d - m;
		if (f >= 1 && f <= 3) VALID_FORMATIONS.push({ DEF: d, MID: m, FWD: f });
	}
}

/** Salgspris etter FPL-regelen: kjøpspris + gulv(halv gevinst). */
export function sellingPriceFor(purchasePrice: number, nowCost: number): number {
	if (nowCost <= purchasePrice) return nowCost;
	return purchasePrice + Math.floor((nowCost - purchasePrice) / 2);
}

function byPosition(players: SquadPlayer[], pos: PositionShort) {
	return players.filter((p) => p.position === pos);
}

/**
 * Velger elleveren som maksimerer forventede poeng for én gameweek, over alle
 * lovlige formasjoner. Med 15 spillere er uttømmende søk trivielt billig.
 */
export function pickBestEleven(squad: SquadPlayer[], slot = 0): BestEleven {
	const xpAt = (p: SquadPlayer) => p.xp[slot] ?? 0;
	const keepers = byPosition(squad, "GKP").sort((a, b) => xpAt(b) - xpAt(a));
	const defs = byPosition(squad, "DEF").sort((a, b) => xpAt(b) - xpAt(a));
	const mids = byPosition(squad, "MID").sort((a, b) => xpAt(b) - xpAt(a));
	const fwds = byPosition(squad, "FWD").sort((a, b) => xpAt(b) - xpAt(a));

	let best: BestEleven | null = null;

	for (const f of VALID_FORMATIONS) {
		if (defs.length < f.DEF || mids.length < f.MID || fwds.length < f.FWD || keepers.length < 1) continue;
		const starters = [...keepers.slice(0, 1), ...defs.slice(0, f.DEF), ...mids.slice(0, f.MID), ...fwds.slice(0, f.FWD)];
		const total = starters.reduce((a, p) => a + xpAt(p), 0);
		if (!best || total > best.startersXp) {
			const startIds = new Set(starters.map((p) => p.id));
			const benchOutfield = squad
				.filter((p) => !startIds.has(p.id) && p.position !== "GKP")
				.sort((a, b) => xpAt(b) - xpAt(a));
			const benchKeeper = keepers.find((p) => !startIds.has(p.id)) ?? null;
			best = {
				starters: sortStarters(starters),
				bench: benchOutfield,
				benchGoalkeeper: benchKeeper,
				formation: f,
				formationLabel: `${f.DEF}-${f.MID}-${f.FWD}`,
				startersXp: total,
				benchXp: [...benchOutfield, ...(benchKeeper ? [benchKeeper] : [])].reduce((a, p) => a + xpAt(p), 0),
			};
		}
	}

	if (best) return best;

	// Nødløsning hvis troppen er ufullstendig (f.eks. midt i et bytte).
	const starters = [...squad].sort((a, b) => xpAt(b) - xpAt(a)).slice(0, 11);
	return {
		starters,
		bench: squad.filter((p) => !starters.includes(p)),
		benchGoalkeeper: null,
		formation: { DEF: 0, MID: 0, FWD: 0 },
		formationLabel: "ukjent",
		startersXp: starters.reduce((a, p) => a + xpAt(p), 0),
		benchXp: 0,
	};
}

const ORDER: Record<PositionShort, number> = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };

function sortStarters(players: SquadPlayer[]) {
	return [...players].sort((a, b) => ORDER[a.position] - ORDER[b.position] || (b.xp[0] ?? 0) - (a.xp[0] ?? 0));
}

export type CaptainAdvice = {
	captain: SquadPlayer;
	viceCaptain: SquadPlayer | null;
	alternatives: SquadPlayer[];
	/** Poengene kapteinsvalget legger til, altså xp for neste runde. */
	expectedBonusPoints: number;
	currentCaptain: SquadPlayer | null;
	changeRecommended: boolean;
	rationale: string;
};

/**
 * Kaptein velges på forventede poeng, men et valg med lav startsjanse straffes
 * hardt: en kaptein som ikke spiller koster dobbelt.
 */
export function chooseCaptain(starters: SquadPlayer[], slot = 0): CaptainAdvice | null {
	if (!starters.length) return null;
	const score = (p: SquadPlayer) => (p.xp[slot] ?? 0) * (0.6 + 0.4 * p.availabilityNext);
	const ranked = [...starters].sort((a, b) => score(b) - score(a));
	const captain = ranked[0];
	const viceCaptain = ranked[1] ?? null;
	const currentCaptain = starters.find((p) => p.isCaptain) ?? null;
	const changeRecommended = !!currentCaptain && currentCaptain.id !== captain.id;

	const gap = currentCaptain ? (captain.xp[slot] ?? 0) - (currentCaptain.xp[slot] ?? 0) : 0;
	const rationale = !currentCaptain
		? `${captain.name} har høyest forventet uttelling i troppen.`
		: changeRecommended
			? `${captain.name} ligger ${fmtXp(gap)} poeng foran ${currentCaptain.name} i modellen.`
			: `${captain.name} er allerede kaptein og holder stand i modellen.`;

	return {
		captain,
		viceCaptain,
		alternatives: ranked.slice(1, 4),
		expectedBonusPoints: captain.xp[slot] ?? 0,
		currentCaptain,
		changeRecommended,
		rationale,
	};
}

export type LineupChange = { out: SquadPlayer | null; in: SquadPlayer; gain: number };

/** Sammenligner anbefalt ellever med laget slik det står nå. */
export function lineupChanges(squad: SquadPlayer[], best: BestEleven, slot = 0): LineupChange[] {
	const currentStarterIds = new Set(squad.filter((p) => p.squadPosition <= 11).map((p) => p.id));
	const recommendedIds = new Set(best.starters.map((p) => p.id));

	const dropped = squad
		.filter((p) => currentStarterIds.has(p.id) && !recommendedIds.has(p.id))
		.sort((a, b) => (a.xp[slot] ?? 0) - (b.xp[slot] ?? 0));
	const promoted = squad
		.filter((p) => !currentStarterIds.has(p.id) && recommendedIds.has(p.id))
		.sort((a, b) => (b.xp[slot] ?? 0) - (a.xp[slot] ?? 0));

	return promoted.map((p, i) => {
		const out = dropped[i] ?? null;
		return { out, in: p, gain: (p.xp[slot] ?? 0) - (out?.xp[slot] ?? 0) };
	});
}
