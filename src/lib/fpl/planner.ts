import type { FixtureContext } from "./fixtures";
import { money } from "./format";
import type { PlayerProjection, PositionShort } from "./projection";
import { captainScore, isValidFormation, pickBestEleven, type SquadPlayer } from "./squad";
import { HIT_COST, isSelectable } from "./transfers";
import type { ElementStatus } from "./types";

/** Antall runder planleggeren viser per spiller. */
const PLANNER_GAMEWEEKS = 3;
export const STARTER_COUNT = 11;
const MAX_PLAYERS_PER_CLUB = 3;

/**
 * Hele spillerpoolen sendes til nettleseren, så typene her er bevisst slanke.
 * Kampene ligger per klubb i stedet for per spiller av samme grunn.
 */
export type PlannerPlayer = {
	id: number;
	name: string;
	fullName: string;
	teamId: number;
	position: PositionShort;
	/** now_cost, i tideler av millioner. */
	price: number;
	status: ElementStatus;
	news: string;
	availabilityNext: number;
	selectedBy: number;
	/** Forventede poeng, én verdi per runde i `PlannerData.gameweeks`. */
	xp: number[];
};

export type PlannerClub = {
	id: number;
	name: string;
	short: string;
	/** Klubbkoden FPL bruker i filnavnene på draktene. Ikke det samme som `id`. */
	code: number;
	/** Én rad per runde — tom liste = blank, to = double. */
	fixtures: { opponentShort: string; isHome: boolean }[][];
};

export type PlannerData = {
	entryId: number;
	gameweeks: number[];
	players: PlannerPlayer[];
	clubs: PlannerClub[];
	/** Troppen ved forrige deadline, i FPL-rekkefølge: 1–11 starter, 12–15 er benken. */
	squad: { id: number; sellingPrice: number }[];
	captainId: number | null;
	viceCaptainId: number | null;
	bank: number;
	freeTransfers: number;
	freeTransfersIsEstimate: boolean;
};

export type SquadPlan = {
	/** Indeks 0–10 er elleveren, 11–14 er benken i innbytterekkefølge. */
	slotPlayerIds: number[];
	captainId: number | null;
	viceCaptainId: number | null;
};

export type PlanMoveSource = { kind: "pool"; playerId: number } | { kind: "slot"; slotIndex: number };

export type PlannedTransfer = {
	sold: PlannerPlayer;
	bought: PlannerPlayer;
	/** Endring i banken i tideler. Positivt = penger igjen. */
	cashDelta: number;
};

export type PlanSummary = {
	transfers: PlannedTransfer[];
	hitCost: number;
	bank: number;
	/** Markedsverdien av troppen, uten banken. */
	squadValue: number;
	/** Elleverens forventede poeng per runde med kapteinsbindet, før poengtrekk. */
	expectedPerGameweek: number[];
};

export type PlayersById = Map<number, PlannerPlayer>;

const roundToHundredths = (value: number) => Math.round(value * 100) / 100;

export function buildPlannerData(input: {
	entryId: number;
	squad: SquadPlayer[];
	pool: PlayerProjection[];
	ctx: FixtureContext;
	bank: number;
	freeTransfers: number;
	freeTransfersIsEstimate: boolean;
}): PlannerData {
	const { entryId, squad, pool, ctx, bank, freeTransfers, freeTransfersIsEstimate } = input;
	const ownedIds = new Set(squad.map((p) => p.id));

	return {
		entryId,
		gameweeks: ctx.events.slice(0, PLANNER_GAMEWEEKS).map((event) => event.id),
		players: pool
			.filter((p) => ownedIds.has(p.id) || isSelectable(p))
			.map((p) => ({
				id: p.id,
				name: p.name,
				fullName: p.fullName,
				teamId: p.teamId,
				position: p.position,
				price: p.price,
				status: p.status,
				news: p.news,
				availabilityNext: roundToHundredths(p.availabilityNext),
				selectedBy: p.selectedBy,
				xp: p.xp.slice(0, PLANNER_GAMEWEEKS).map(roundToHundredths),
			})),
		clubs: [...ctx.teamsById.values()].map((team) => ({
			id: team.id,
			name: team.name,
			short: team.short_name,
			code: team.code,
			fixtures: (ctx.schedule.get(team.id) ?? [])
				.slice(0, PLANNER_GAMEWEEKS)
				.map((row) => row.map((f) => ({ opponentShort: f.opponentShort, isHome: f.isHome }))),
		})),
		squad: squad.map((p) => ({ id: p.id, sellingPrice: p.sellingPrice })),
		captainId: squad.find((p) => p.isCaptain)?.id ?? null,
		viceCaptainId: squad.find((p) => p.isViceCaptain)?.id ?? null,
		bank,
		freeTransfers,
		freeTransfersIsEstimate,
	};
}

export function initialPlan(data: PlannerData): SquadPlan {
	return {
		slotPlayerIds: data.squad.map((member) => member.id),
		captainId: data.captainId,
		viceCaptainId: data.viceCaptainId,
	};
}

/** Keepere har egen drakt, med suffikset _1 i filnavnet. */
export function shirtUrl(clubCode: number, position: PositionShort): string {
	const keeperSuffix = position === "GKP" ? "_1" : "";
	return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${clubCode}${keeperSuffix}-110.webp`;
}

/** Fargetrinn 1–5 for forventede poeng i én runde. */
export function xpHeatLevel(expectedPoints: number): number {
	if (expectedPoints < 1.5) return 1;
	if (expectedPoints < 3) return 2;
	if (expectedPoints < 4.5) return 3;
	if (expectedPoints < 6) return 4;
	return 5;
}

export function requirePlayer(playersById: PlayersById, playerId: number): PlannerPlayer {
	const player = playersById.get(playerId);
	if (!player) throw new Error(`Planleggeren kjenner ikke spiller ${playerId}.`);
	return player;
}

/**
 * Banken regnes alltid på nytt fra forskjellen mot den opprinnelige troppen, ikke
 * akkumulert per bytte. Selges en spiller og kjøpes tilbake, får du derfor igjen
 * den opprinnelige salgsprisen — slik FPL selv oppfører seg før du bekrefter.
 */
function bankAfterPlan(plan: SquadPlan, data: PlannerData, playersById: PlayersById): number {
	const plannedIds = new Set(plan.slotPlayerIds);
	const originalIds = new Set(data.squad.map((member) => member.id));
	const proceeds = data.squad
		.filter((member) => !plannedIds.has(member.id))
		.reduce((sum, member) => sum + member.sellingPrice, 0);
	const costs = plan.slotPlayerIds
		.filter((id) => !originalIds.has(id))
		.reduce((sum, id) => sum + requirePlayer(playersById, id).price, 0);
	return data.bank + proceeds - costs;
}

export function expectedPointsForPlan(plan: SquadPlan, playersById: PlayersById, gameweekSlot: number): number {
	const startersPoints = plan.slotPlayerIds
		.slice(0, STARTER_COUNT)
		.reduce((sum, id) => sum + (requirePlayer(playersById, id).xp[gameweekSlot] ?? 0), 0);
	const captainPoints = plan.captainId === null ? 0 : (requirePlayer(playersById, plan.captainId).xp[gameweekSlot] ?? 0);
	return startersPoints + captainPoints;
}

export function summarisePlan(plan: SquadPlan, data: PlannerData, playersById: PlayersById): PlanSummary {
	const plannedIds = new Set(plan.slotPlayerIds);
	const originalIds = new Set(data.squad.map((member) => member.id));
	const unmatchedBought = plan.slotPlayerIds
		.filter((id) => !originalIds.has(id))
		.map((id) => requirePlayer(playersById, id));

	// Et bytte er alltid innenfor samme posisjon, så salg og kjøp kan pares på den.
	const transfers = data.squad
		.filter((member) => !plannedIds.has(member.id))
		.map((member): PlannedTransfer => {
			const sold = requirePlayer(playersById, member.id);
			const matchIndex = unmatchedBought.findIndex((p) => p.position === sold.position);
			const [bought] = unmatchedBought.splice(matchIndex, 1);
			return { sold, bought, cashDelta: member.sellingPrice - bought.price };
		});

	return {
		transfers,
		hitCost: Math.max(0, transfers.length - data.freeTransfers) * HIT_COST,
		bank: bankAfterPlan(plan, data, playersById),
		squadValue: plan.slotPlayerIds.reduce((sum, id) => sum + requirePlayer(playersById, id).price, 0),
		expectedPerGameweek: data.gameweeks.map((_, slot) => expectedPointsForPlan(plan, playersById, slot)),
	};
}

/** Høyeste pris du har råd til per posisjon, gitt at du selger den dyreste i troppen på samme plass. */
export function affordableLimitByPosition(
	plan: SquadPlan,
	data: PlannerData,
	playersById: PlayersById,
): Record<PositionShort, number> {
	const bank = bankAfterPlan(plan, data, playersById);
	const sellingPriceById = new Map(data.squad.map((member) => [member.id, member.sellingPrice]));
	const limits: Record<PositionShort, number> = { GKP: bank, DEF: bank, MID: bank, FWD: bank };
	for (const id of plan.slotPlayerIds) {
		const player = requirePlayer(playersById, id);
		const sellingPrice = sellingPriceById.get(id) ?? player.price;
		limits[player.position] = Math.max(limits[player.position], bank + sellingPrice);
	}
	return limits;
}

function replaceInSlot(plan: SquadPlan, incomingId: number, targetSlot: number): SquadPlan {
	const outgoingId = plan.slotPlayerIds[targetSlot];
	return {
		slotPlayerIds: plan.slotPlayerIds.map((id, slot) => (slot === targetSlot ? incomingId : id)),
		captainId: plan.captainId === outgoingId ? incomingId : plan.captainId,
		viceCaptainId: plan.viceCaptainId === outgoingId ? incomingId : plan.viceCaptainId,
	};
}

function swapSlots(plan: SquadPlan, firstSlot: number, secondSlot: number): SquadPlan {
	const slotPlayerIds = [...plan.slotPlayerIds];
	[slotPlayerIds[firstSlot], slotPlayerIds[secondSlot]] = [slotPlayerIds[secondSlot], slotPlayerIds[firstSlot]];

	// Går kapteinen på benken, arver den som kommer inn bindet. Laveste plass er
	// den i elleveren når byttet går mellom bane og benk.
	const starters = new Set(slotPlayerIds.slice(0, STARTER_COUNT));
	const promotedId = slotPlayerIds[Math.min(firstSlot, secondSlot)];
	const inheritIfBenched = (id: number | null) => (id !== null && !starters.has(id) ? promotedId : id);

	return {
		slotPlayerIds,
		captainId: inheritIfBenched(plan.captainId),
		viceCaptainId: inheritIfBenched(plan.viceCaptainId),
	};
}

export function applyMove(plan: SquadPlan, source: PlanMoveSource, targetSlot: number): SquadPlan {
	return source.kind === "pool"
		? replaceInSlot(plan, source.playerId, targetSlot)
		: swapSlots(plan, source.slotIndex, targetSlot);
}

function lineupRejection(plan: SquadPlan, playersById: PlayersById): string | null {
	const positions = plan.slotPlayerIds.map((id) => requirePlayer(playersById, id).position);
	const starters = positions.slice(0, STARTER_COUNT);
	const countAt = (position: PositionShort) => starters.filter((p) => p === position).length;

	if (countAt("GKP") !== 1) return "En keeper kan bare bytte plass med den andre keeperen.";
	if (positions[STARTER_COUNT] !== "GKP") return "Reservekeeperen må stå først på benken.";
	const formation = { DEF: countAt("DEF"), MID: countAt("MID"), FWD: countAt("FWD") };
	if (!isValidFormation(formation)) {
		return `${formation.DEF}-${formation.MID}-${formation.FWD} er ikke en lovlig formasjon. Du må ha minst 3 forsvarere, 2 midtbanespillere og 1 spiss.`;
	}
	return null;
}

/** Hvorfor et trekk ikke er lov, eller null hvis det er det. */
export function moveRejection(
	plan: SquadPlan,
	source: PlanMoveSource,
	targetSlot: number,
	data: PlannerData,
	playersById: PlayersById,
): string | null {
	if (source.kind === "slot") return lineupRejection(applyMove(plan, source, targetSlot), playersById);

	const incoming = requirePlayer(playersById, source.playerId);
	const outgoing = requirePlayer(playersById, plan.slotPlayerIds[targetSlot]);

	if (plan.slotPlayerIds.includes(incoming.id)) return `${incoming.name} er allerede i troppen.`;
	if (incoming.position !== outgoing.position) {
		return `${incoming.name} er ${incoming.position} og kan ikke erstatte ${outgoing.name}, som er ${outgoing.position}.`;
	}

	const clubmatesAfterSale = plan.slotPlayerIds.filter(
		(id) => id !== outgoing.id && requirePlayer(playersById, id).teamId === incoming.teamId,
	).length;
	if (clubmatesAfterSale >= MAX_PLAYERS_PER_CLUB) {
		const club = data.clubs.find((c) => c.id === incoming.teamId);
		return `Du kan ikke ha flere enn ${MAX_PLAYERS_PER_CLUB} spillere fra ${club?.name ?? "samme klubb"}.`;
	}

	const bankAfterMove = bankAfterPlan(applyMove(plan, source, targetSlot), data, playersById);
	if (bankAfterMove < 0) return `Du mangler £${money(-bankAfterMove)}m for å bytte ${outgoing.name} med ${incoming.name}.`;

	return null;
}

export function withCaptain(plan: SquadPlan, playerId: number): SquadPlan {
	return {
		...plan,
		captainId: playerId,
		viceCaptainId: plan.viceCaptainId === playerId ? plan.captainId : plan.viceCaptainId,
	};
}

export function withViceCaptain(plan: SquadPlan, playerId: number): SquadPlan {
	return {
		...plan,
		viceCaptainId: playerId,
		captainId: plan.captainId === playerId ? plan.viceCaptainId : plan.captainId,
	};
}

const planStorageKey = (entryId: number) => `krystallkulen-plan:${entryId}`;

/**
 * Planen lagres i nettleseren, én per lag. Lagring kan være blokkert, for eksempel
 * i privat modus — da virker planleggeren som før, men planen forsvinner ved neste lasting.
 */
export function savePlan(data: PlannerData, plan: SquadPlan) {
	try {
		window.localStorage.setItem(planStorageKey(data.entryId), JSON.stringify({ gameweek: data.gameweeks[0], plan }));
	} catch {
		// Se over: planen lever videre i minnet.
	}
}

/** Planen gjelder bare runden den ble lagt for. Etter deadline er det en ny tropp å ta utgangspunkt i. */
export function readSavedPlan(data: PlannerData): unknown {
	try {
		const stored = JSON.parse(window.localStorage.getItem(planStorageKey(data.entryId)) ?? "null");
		return stored?.gameweek === data.gameweeks[0] ? stored.plan : null;
	} catch {
		return null;
	}
}

/**
 * En lagret plan kan være utdatert selv innenfor samme runde, for eksempel hvis en
 * spiller i planen har forlatt ligaen. Prisendringer er derimot ikke grunn til å
 * forkaste den: banken regnes på nytt, og overtrekk vises i stedet.
 */
export function isRestorablePlan(candidate: unknown, data: PlannerData, playersById: PlayersById): candidate is SquadPlan {
	if (typeof candidate !== "object" || candidate === null) return false;
	const { slotPlayerIds, captainId, viceCaptainId } = candidate as Partial<SquadPlan>;
	if (!Array.isArray(slotPlayerIds) || slotPlayerIds.length !== data.squad.length) return false;
	if (new Set(slotPlayerIds).size !== slotPlayerIds.length) return false;
	if (!slotPlayerIds.every((id) => playersById.has(id))) return false;

	const starters = slotPlayerIds.slice(0, STARTER_COUNT);
	const isStarterOrEmpty = (id: number | null | undefined) => id === null || starters.includes(id as number);
	if (!isStarterOrEmpty(captainId) || !isStarterOrEmpty(viceCaptainId)) return false;

	return lineupRejection({ slotPlayerIds, captainId: captainId ?? null, viceCaptainId: viceCaptainId ?? null }, playersById) === null;
}

/** Beste ellever og kaptein for neste runde, med samme modell som «Dommen». */
export function optimisedPlan(plan: SquadPlan, playersById: PlayersById): SquadPlan {
	const squad = plan.slotPlayerIds.map((id) => requirePlayer(playersById, id));
	const best = pickBestEleven(squad, 0);
	const captainRanking = [...best.starters].sort((a, b) => captainScore(b, 0) - captainScore(a, 0));
	return {
		slotPlayerIds: [...best.starters, ...(best.benchGoalkeeper ? [best.benchGoalkeeper] : []), ...best.bench].map((p) => p.id),
		captainId: captainRanking[0]?.id ?? null,
		viceCaptainId: captainRanking[1]?.id ?? null,
	};
}
