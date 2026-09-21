import type { FixtureContext, NormalizedFixture } from "./fixtures";
import type { Bootstrap, BootstrapElement, ElementSummary, ScoringConfig } from "./types";

export type PositionShort = "GKP" | "DEF" | "MID" | "FWD";

export type PlayerFlag = {
	kind: "injury" | "doubt" | "suspended" | "unavailable" | "rotation" | "blank" | "double" | "price" | "cards" | "risk";
	text: string;
};

export type PriceRisk = {
	direction: "up" | "down" | "stable";
	/** −5 … 5 fra FPL sin egen prisprojeksjon. */
	strength: number;
	label: string;
	progressPercent: number;
	netTransfers: number;
	lockedUntil: string | null;
};

export type PlayerProjection = {
	id: number;
	name: string;
	fullName: string;
	teamId: number;
	teamShort: string;
	position: PositionShort;
	elementType: number;
	/** now_cost, i tideler av millioner. */
	price: number;
	status: BootstrapElement["status"];
	news: string;
	availabilityNext: number;
	pStart: number;
	expectedMinutes: number;
	form: number;
	selectedBy: number;
	epNextOfficial: number | null;
	/** Forventede poeng per gameweek i horisonten. */
	xp: number[];
	xpTotal: number;
	fixtures: NormalizedFixture[][];
	flags: PlayerFlag[];
	priceRisk: PriceRisk;
};

const DEFAULT_SCORING: ScoringConfig = {
	long_play: 2,
	short_play: 1,
	assists: 3,
	bonus: 1,
	saves: 1,
	yellow_cards: -1,
	red_cards: -3,
	own_goals: -2,
	penalties_missed: -2,
	penalties_saved: 5,
	goals_scored: { GKP: 10, DEF: 6, MID: 5, FWD: 4 },
	clean_sheets: { GKP: 4, DEF: 4, MID: 1, FWD: 0 },
	goals_conceded: { GKP: -1, DEF: -1, MID: 0, FWD: 0 },
	defensive_contribution: { GKP: 0, DEF: 2, MID: 2, FWD: 2 },
};

/** Terskel for defensive contribution-poenget (2025/26-reglene). */
const DEFCON_THRESHOLD: Record<PositionShort, number> = { GKP: 99, DEF: 10, MID: 12, FWD: 12 };

const RATE_PRIORS: Record<PositionShort, { xg90: number; xa90: number; bonus90: number }> = {
	GKP: { xg90: 0.0, xa90: 0.01, bonus90: 0.12 },
	DEF: { xg90: 0.05, xa90: 0.06, bonus90: 0.15 },
	MID: { xg90: 0.13, xa90: 0.13, bonus90: 0.18 },
	FWD: { xg90: 0.32, xa90: 0.12, bonus90: 0.22 },
};

/** Vekten sesongdata får mot prior. 400 minutter gir omtrent 50/50. */
const REGRESSION_MINUTES = 400;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const num = (v: string | number | null | undefined, fallback = 0) => {
	const n = typeof v === "number" ? v : parseFloat(v ?? "");
	return Number.isFinite(n) ? n : fallback;
};

function poissonPmf(k: number, lambda: number) {
	let logp = -lambda + k * Math.log(Math.max(lambda, 1e-9));
	for (let i = 2; i <= k; i++) logp -= Math.log(i);
	return Math.exp(logp);
}

/** P(X >= k) for X ~ Poisson(lambda). */
function poissonAtLeast(k: number, lambda: number) {
	if (k <= 0) return 1;
	let cdf = 0;
	for (let i = 0; i < k; i++) cdf += poissonPmf(i, lambda);
	return clamp(1 - cdf, 0, 1);
}

/** E[floor(X / 2)] for X ~ Poisson(lambda) — FPL trekker 1 poeng per 2 baklengsmål. */
function expectedConcedeDeduction(lambda: number) {
	let sum = 0;
	for (let k = 2; k <= 12; k++) sum += Math.floor(k / 2) * poissonPmf(k, lambda);
	return sum;
}

type MinutesModel = {
	pStart: number;
	pSub: number;
	avgStartMinutes: number;
	p60GivenStart: number;
	expectedMinutes: number;
};

/**
 * Spilletidsmodell. Sesongsnittet er grunnlaget, men har vi kamp-for-kamp-historikk
 * vektes de siste rundene tyngre — rollen til en spiller endrer seg gjennom sesongen,
 * og spilletid er den desidert største usikkerheten i en poengprognose.
 */
function minutesModel(el: BootstrapElement, teamGames: number, summary?: ElementSummary): MinutesModel {
	const games = Math.max(teamGames, 1);
	const seasonStartRate = clamp(el.starts / games, 0, 1);
	const startMinutesGuess = el.starts > 0 ? clamp(el.minutes / el.starts, 30, 90) : 72;
	const subMinutes = Math.max(0, el.minutes - el.starts * startMinutesGuess);
	const seasonSubRate = clamp(subMinutes / (18 * games), 0, 1 - seasonStartRate);

	let pStart = seasonStartRate;
	let pSub = seasonSubRate;
	let avgStartMinutes = startMinutesGuess;

	const rows = summary?.history ?? [];
	if (rows.length >= 2) {
		// Slå sammen doble gameweeks til én rad per runde.
		const byRound = new Map<number, { minutes: number; starts: number }>();
		for (const r of rows) {
			const cur = byRound.get(r.round) ?? { minutes: 0, starts: 0 };
			byRound.set(r.round, { minutes: cur.minutes + r.minutes, starts: cur.starts + r.starts });
		}
		const recent = [...byRound.entries()].sort((a, b) => b[0] - a[0]).slice(0, 5);
		const weights = [5, 4, 3, 2, 1];
		let wSum = 0;
		let wStart = 0;
		let wPlay = 0;
		let startMinutes = 0;
		let startCount = 0;
		recent.forEach(([, v], i) => {
			const w = weights[i] ?? 1;
			wSum += w;
			if (v.starts > 0) {
				wStart += w;
				startMinutes += v.minutes;
				startCount += v.starts;
			} else if (v.minutes > 0) {
				wPlay += w;
			}
		});
		const recentStart = wSum ? wStart / wSum : seasonStartRate;
		const recentSub = wSum ? wPlay / wSum : seasonSubRate;
		pStart = clamp(0.65 * recentStart + 0.35 * seasonStartRate, 0, 1);
		pSub = clamp(0.65 * recentSub + 0.35 * seasonSubRate, 0, 1 - pStart);
		if (startCount > 0) avgStartMinutes = clamp(startMinutes / startCount, 30, 90);
	}

	const p60GivenStart = clamp((avgStartMinutes - 40) / 45, 0.25, 0.97);
	return {
		pStart,
		pSub,
		avgStartMinutes,
		p60GivenStart,
		expectedMinutes: pStart * avgStartMinutes + pSub * 18,
	};
}

/**
 * Hvor sannsynlig er det at spilleren er tilgjengelig i gameweek nummer `slot`
 * (0 = neste)? Skader tines gradvis opp utover i horisonten, karantener gjelder
 * normalt bare første runde.
 */
function availability(el: BootstrapElement, slot: number): number {
	if (el.removed) return 0;
	if (el.status === "a") return 1;
	if (el.status === "u") return 0;
	if (el.status === "s") return slot === 0 ? 0 : 0.95;

	const stated = el.chance_of_playing_next_round ?? el.chance_of_playing_this_round;
	const base = stated !== null && stated !== undefined ? stated / 100 : el.status === "d" ? 0.6 : 0.15;
	if (slot === 0) return clamp(base, 0, 1);
	const recovery = el.status === "i" ? 0.22 : 0.3;
	return clamp(base + (1 - base) * Math.min(1, slot * recovery), 0, 1);
}

/**
 * FPL publiserer selv `price_change_projections` med en likelihood fra −5 til 5.
 * Vi videreformidler den som et risikonivå i stedet for å finne på vår egen
 * prosent — en tallverdi vi ikke har backtestet ville vært falsk presisjon.
 */
function priceRisk(el: BootstrapElement): PriceRisk {
	const tonight = el.price_change_projections?.find((p) => p.offset === 0);
	const strength = tonight?.likelihood ?? 0;
	const progress = num(tonight?.projected_percent ?? el.price_change_percent);
	const netTransfers = el.transfers_in_event - el.transfers_out_event;
	const direction: PriceRisk["direction"] = strength >= 3 ? "up" : strength <= -3 ? "down" : "stable";
	const label =
		strength >= 5
			? "Stiger trolig i natt"
			: strength >= 3
				? "Høy sjanse for prisøkning"
				: strength <= -5
					? "Faller trolig i natt"
					: strength <= -3
						? "Høy risiko for prisfall"
						: Math.abs(strength) === 2
							? "Middels prisrisiko"
							: "Lav prisrisiko";
	return { direction, strength, label, progressPercent: progress, netTransfers, lockedUntil: el.price_change_locked_until };
}

function buildFlags(
	el: BootstrapElement,
	minutes: MinutesModel,
	fixtures: NormalizedFixture[][],
	risk: PriceRisk,
	events: FixtureContext["events"],
): PlayerFlag[] {
	const flags: PlayerFlag[] = [];
	const news = el.news?.trim();

	if (el.status === "i") flags.push({ kind: "injury", text: news || "Skadet" });
	else if (el.status === "s") flags.push({ kind: "suspended", text: news || "Utestengt" });
	else if (el.status === "u") flags.push({ kind: "unavailable", text: news || "Utilgjengelig" });
	else if (el.status === "d") {
		const pct = el.chance_of_playing_next_round;
		flags.push({ kind: "doubt", text: news || (pct !== null ? `${pct} % sjanse for å spille` : "Tvilsom") });
	}

	if (el.status === "a" && minutes.pStart < 0.6 && minutes.expectedMinutes > 5) {
		flags.push({
			kind: "rotation",
			text: `Rotasjonsrisiko — ${Math.round(minutes.pStart * 100)} % sjanse for å starte`,
		});
	}

	fixtures.forEach((row, slot) => {
		const gw = events[slot]?.id;
		if (!gw) return;
		if (row.length === 0) flags.push({ kind: "blank", text: `Blank i GW${gw}` });
		if (row.length > 1) {
			flags.push({ kind: "double", text: `Double i GW${gw} (${row.map((f) => f.opponentShort).join(", ")})` });
		}
	});

	if (risk.direction !== "stable") flags.push({ kind: "price", text: risk.label });

	if (el.yellow_cards === 4) flags.push({ kind: "cards", text: "4 gule kort — ett fra karantene" });

	for (const r of el.scout_risks ?? []) {
		if (r.notes) flags.push({ kind: "risk", text: r.notes });
	}

	return flags;
}

export type ProjectionResult = {
	byId: Map<number, PlayerProjection>;
	all: PlayerProjection[];
	/** Skaleringsfaktoren modellen ble kalibrert med mot FPL sin egen ep_next. */
	calibration: number;
	horizonEvents: FixtureContext["events"];
};

export type ProjectionOptions = {
	/** Kamp-for-kamp-historikk for utvalgte spillere. Gir en bedre spilletidsmodell. */
	summaries?: Map<number, ElementSummary>;
	/** Hvor mye FPL sin egen ep_next skal telle for første gameweek. 0–1. */
	blendOfficialNextGw?: number;
};

export function projectPlayers(
	bootstrap: Bootstrap,
	ctx: FixtureContext,
	options: ProjectionOptions = {},
): ProjectionResult {
	const scoring: ScoringConfig = { ...DEFAULT_SCORING, ...(bootstrap.game_config?.scoring ?? {}) };
	const typeById = new Map(bootstrap.element_types.map((t) => [t.id, t.singular_name_short]));
	const slots = ctx.events.length;
	const blend = options.blendOfficialNextGw ?? 0.5;

	// Nøytral forventet målscore per lag — brukes til å normalisere kampvekten,
	// slik at en gjennomsnittlig kamp gir multiplikator 1.
	const neutral = new Map<number, { xGF: number; xGA: number }>();
	for (const [teamId, rows] of ctx.schedule) {
		const all = rows.flat();
		neutral.set(
			teamId,
			all.length
				? {
						xGF: all.reduce((a, f) => a + f.xGF, 0) / all.length,
						xGA: all.reduce((a, f) => a + f.xGA, 0) / all.length,
					}
				: { xGF: 1.45, xGA: 1.45 },
		);
	}

	const raw: { proj: PlayerProjection; modelNext: number }[] = [];

	for (const el of bootstrap.elements) {
		const pos = (typeById.get(el.element_type) ?? "MID") as PositionShort;
		const team = ctx.teamsById.get(el.team);
		if (!team) continue;

		const fixtures = ctx.schedule.get(el.team) ?? Array.from({ length: slots }, () => [] as NormalizedFixture[]);
		const teamGames = ctx.gamesPlayed.get(el.team) ?? 0;
		const minutes = minutesModel(el, teamGames, options.summaries?.get(el.id));

		const prior = RATE_PRIORS[pos];
		const w = el.minutes / (el.minutes + REGRESSION_MINUTES);
		let xg90 = w * num(el.expected_goals_per_90) + (1 - w) * prior.xg90;
		const xa90 = w * num(el.expected_assists_per_90) + (1 - w) * prior.xa90;
		const bonus90 = w * (el.minutes > 0 ? el.bonus / (el.minutes / 90) : prior.bonus90) + (1 - w) * prior.bonus90;
		const yellow90 = el.minutes > 0 ? el.yellow_cards / (el.minutes / 90) : 0.12;
		const dc90 = w * num(el.defensive_contribution_per_90) + (1 - w) * (pos === "DEF" ? 6 : pos === "MID" ? 5 : 3);
		const saves90 = num(el.saves_per_90);

		// Fast straffetaker som ennå ikke har rukket å samle xG fra straffer.
		if (el.penalties_order === 1) xg90 += 0.09;

		const neutralTeam = neutral.get(el.team) ?? { xGF: 1.45, xGA: 1.45 };
		const xp: number[] = [];

		for (let slot = 0; slot < slots; slot++) {
			const avail = availability(el, slot);
			let slotPoints = 0;

			for (const fx of fixtures[slot]) {
				const attackMult = clamp(fx.xGF / neutralTeam.xGF, 0.5, 1.8);
				const pStart = minutes.pStart * avail;
				const pSub = minutes.pSub * avail;
				const startShare = minutes.avgStartMinutes / 90;

				// Opptreden
				const p60 = pStart * minutes.p60GivenStart;
				const pShort = pStart * (1 - minutes.p60GivenStart) + pSub;
				let pts = p60 * scoring.long_play + pShort * scoring.short_play;

				// Angrepspoeng
				const attackingMinutes = pStart * startShare + pSub * 0.2;
				pts += xg90 * attackMult * attackingMinutes * (scoring.goals_scored[pos] ?? 4);
				pts += xa90 * attackMult * attackingMinutes * scoring.assists;

				// Clean sheet og baklengsmål
				const csPoints = scoring.clean_sheets[pos] ?? 0;
				if (csPoints > 0) pts += Math.exp(-fx.xGA) * p60 * csPoints;
				const concede = scoring.goals_conceded[pos] ?? 0;
				if (concede < 0) pts += concede * expectedConcedeDeduction(fx.xGA) * p60;

				// Redninger
				if (pos === "GKP" && saves90 > 0) {
					const savesScale = clamp(fx.xGA / Math.max(neutralTeam.xGA, 0.1), 0.6, 1.6);
					pts += (saves90 * savesScale * pStart * startShare) / 3;
				}

				// Defensive contribution
				const dcPoints = scoring.defensive_contribution[pos] ?? 0;
				if (dcPoints > 0) {
					pts += pStart * poissonAtLeast(DEFCON_THRESHOLD[pos], dc90 * startShare) * dcPoints;
				}

				// Bonus og kort
				pts += bonus90 * Math.sqrt(attackMult) * (pStart * startShare + pSub * 0.15) * 0.9;
				pts += yellow90 * (pStart * startShare + pSub * 0.2) * scoring.yellow_cards;

				slotPoints += Math.max(pts, 0);
			}
			xp.push(slotPoints);
		}

		const risk = priceRisk(el);
		raw.push({
			modelNext: xp[0] ?? 0,
			proj: {
				id: el.id,
				name: el.web_name,
				fullName: `${el.first_name} ${el.second_name}`.trim(),
				teamId: el.team,
				teamShort: team.short_name,
				position: pos,
				elementType: el.element_type,
				price: el.now_cost,
				status: el.status,
				news: el.news ?? "",
				availabilityNext: availability(el, 0),
				pStart: minutes.pStart * availability(el, 0),
				expectedMinutes: minutes.expectedMinutes * availability(el, 0),
				form: num(el.form),
				selectedBy: num(el.selected_by_percent),
				epNextOfficial: el.ep_next !== null ? num(el.ep_next, 0) : null,
				xp,
				xpTotal: xp.reduce((a, b) => a + b, 0),
				fixtures,
				flags: buildFlags(el, minutes, fixtures, risk, ctx.events),
				priceRisk: risk,
			},
		});
	}

	// Kalibrering: skaler modellen slik at summen for neste gameweek matcher FPL
	// sin egen ep_next. Det fanger opp systematisk skjevhet uten å låse resten av
	// horisonten til deres tall.
	const sample = raw.filter((r) => r.modelNext > 0.5 && r.proj.epNextOfficial !== null);
	const modelSum = sample.reduce((a, r) => a + r.modelNext, 0);
	const officialSum = sample.reduce((a, r) => a + (r.proj.epNextOfficial ?? 0), 0);
	const calibration = modelSum > 0 && officialSum > 0 ? clamp(officialSum / modelSum, 0.7, 1.4) : 1;

	for (const { proj } of raw) {
		proj.xp = proj.xp.map((v) => v * calibration);
		// Blanding med ep_next kun i enkeltkamp-runder: FPL sitt tall dekker bare
		// én kamp, så det ville underdrevet doble gameweeks.
		if (proj.epNextOfficial !== null && blend > 0 && proj.fixtures[0]?.length === 1) {
			proj.xp[0] = (1 - blend) * proj.xp[0] + blend * proj.epNextOfficial;
		}
		proj.xpTotal = proj.xp.reduce((a, b) => a + b, 0);
	}

	const all = raw.map((r) => r.proj);
	return { byId: new Map(all.map((p) => [p.id, p])), all, calibration, horizonEvents: ctx.events };
}
