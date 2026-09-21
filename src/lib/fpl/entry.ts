import { getBootstrap, getElementSummaries, getEntry, getEntryHistory, getEntryPicks, getEntryTransfers, getFixtures } from "./api";
import { averageDifficulty, buildFixtureContext } from "./fixtures";
import { chipLabel } from "./format";
import { projectPlayers, type PlayerProjection } from "./projection";
import { chooseCaptain, lineupChanges, pickBestEleven, sellingPriceFor, type SquadPlayer } from "./squad";
import { adviseTransfers } from "./transfers";
import type { Bootstrap, BootstrapEvent, EntryHistory, EntryPicks, EntrySummary } from "./types";

export const DEFAULT_HORIZON = 6;

export type ChipStatus = {
	name: string;
	label: string;
	used: boolean;
	usedInEvent: number | null;
	availableFrom: number | null;
	availableUntil: number | null;
};

export type TeamOutlook = {
	teamId: number;
	short: string;
	name: string;
	averageDifficulty: number | null;
	perEvent: { event: number; opponents: { short: string; isHome: boolean; difficulty: number }[] }[];
};

export type Analysis = {
	entry: EntrySummary;
	/** Gameweeken anbefalingen gjelder for. */
	targetEvent: BootstrapEvent;
	/** Siste ferdigspilte gameweek — grunnlaget for troppen vi leser. */
	sourceEvent: BootstrapEvent;
	deadline: string;
	hoursToDeadline: number;
	horizon: BootstrapEvent[];
	squad: SquadPlayer[];
	bestEleven: ReturnType<typeof pickBestEleven>;
	captain: ReturnType<typeof chooseCaptain>;
	lineup: ReturnType<typeof lineupChanges>;
	transfers: ReturnType<typeof adviseTransfers>;
	squadXpPerEvent: number[];
	squadXpTotal: number;
	bank: number;
	teamValue: number;
	freeTransfers: number;
	freeTransfersIsEstimate: boolean;
	activeChip: string | null;
	chips: ChipStatus[];
	/** Blanke og doble runder i horisonten, med lagene det gjelder. */
	blanks: { event: number; teams: string[] }[];
	doubles: { event: number; teams: string[] }[];
	watchlist: PlayerProjection[];
	priceWatch: { rising: PlayerProjection[]; falling: PlayerProjection[] };
	fixtureOutlook: TeamOutlook[];
	alerts: { level: "high" | "medium" | "low"; text: string }[];
	calibration: number;
	generatedAt: string;
	history: EntryHistory;
	picks: EntryPicks;
};

/**
 * FPL gir ett gratis bytte per runde, og lar deg spare opp til fem. Antallet
 * ligger ikke i det åpne API-et, så vi rekonstruerer det fra bytte- og
 * chiphistorikken.
 *
 * Her antar vi at oppsparte bytter beholdes gjennom en wildcard eller free hit,
 * slik regelen har vært siden banking ble utvidet til fem. Er antakelsen feil
 * for din sesong, blir estimatet for høyt — derfor kan det overstyres i
 * grensesnittet, og derfor merkes det som et estimat i visningen.
 */
export function estimateFreeTransfers(history: EntryHistory, maxFree: number): number {
	const chipByEvent = new Map(history.chips.map((c) => [c.event, c.name]));
	let free = 1;
	for (const row of history.current) {
		const chip = chipByEvent.get(row.event);
		const chipWasFree = chip === "wildcard" || chip === "freehit";
		if (!chipWasFree) free = Math.max(0, free - row.event_transfers);
		free = Math.min(maxFree, free + 1);
	}
	return Math.max(1, Math.min(maxFree, free));
}

function buildChipStatus(bootstrap: Bootstrap, history: EntryHistory, targetEvent: number): ChipStatus[] {
	const used = new Map(history.chips.map((c) => [`${c.name}:${c.event > 19 ? 2 : 1}`, c.event]));
	const seen = new Set<string>();
	const out: ChipStatus[] = [];

	for (const chip of bootstrap.chips ?? []) {
		const half = chip.start_event > 19 ? 2 : 1;
		const key = `${chip.name}:${half}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const usedInEvent = used.get(key) ?? null;
		if (targetEvent > chip.stop_event && usedInEvent === null) continue; // vinduet er forbi
		out.push({
			name: chip.name,
			label: `${chipLabel(chip.name)}${half === 2 ? " (andre halvdel)" : ""}`,
			used: usedInEvent !== null,
			usedInEvent,
			availableFrom: chip.start_event,
			availableUntil: chip.stop_event,
		});
	}
	return out;
}

/**
 * Kjøpsprisen ligger ikke i det åpne API-et, men kan rekonstrueres: spillere som
 * er byttet inn har en pris i byttehistorikken, og de som har vært med siden
 * start ble kjøpt til `now_cost − cost_change_start`.
 */
function purchasePrices(
	bootstrap: Bootstrap,
	picks: EntryPicks,
	transfers: { element_in: number; element_in_cost: number; time: string }[],
): Map<number, number> {
	const byId = new Map(bootstrap.elements.map((e) => [e.id, e]));
	const latestIn = new Map<number, { cost: number; time: number }>();
	for (const t of transfers) {
		const time = Date.parse(t.time);
		const prev = latestIn.get(t.element_in);
		if (!prev || time > prev.time) latestIn.set(t.element_in, { cost: t.element_in_cost, time });
	}

	const out = new Map<number, number>();
	for (const pick of picks.picks) {
		const el = byId.get(pick.element);
		if (!el) continue;
		const bought = latestIn.get(pick.element);
		out.set(pick.element, bought ? bought.cost : el.now_cost - el.cost_change_start);
	}
	return out;
}

function buildAlerts(squad: SquadPlayer[], analysisEvents: BootstrapEvent[]): Analysis["alerts"] {
	const alerts: Analysis["alerts"] = [];
	const nextGw = analysisEvents[0]?.id;

	for (const p of squad) {
		if (p.status === "u") alerts.push({ level: "high", text: `${p.name} er utilgjengelig${p.news ? ` — ${p.news}` : ""}.` });
		else if (p.status === "i") alerts.push({ level: "high", text: `${p.name} er skadet${p.news ? ` — ${p.news}` : ""}.` });
		else if (p.status === "s") alerts.push({ level: "high", text: `${p.name} soner karantene${p.news ? ` — ${p.news}` : ""}.` });
		else if (p.status === "d")
			alerts.push({
				level: "medium",
				text: `${p.name} er tvilsom (${Math.round(p.availabilityNext * 100)} %)${p.news ? ` — ${p.news}` : ""}.`,
			});

		if (p.status === "a" && p.pStart < 0.5 && p.squadPosition <= 11) {
			alerts.push({ level: "medium", text: `${p.name} starter i ${Math.round(p.pStart * 100)} % av modellens simuleringer, men står i elleveren.` });
		}
		if (p.priceRisk.direction === "down" && p.priceRisk.strength <= -4) {
			alerts.push({ level: "low", text: `${p.name} faller trolig i pris i natt.` });
		}
		p.fixtures.forEach((row, slot) => {
			const gw = analysisEvents[slot]?.id;
			if (gw && row.length === 0) {
				alerts.push({ level: gw === nextGw ? "high" : "low", text: `${p.name} har blank gameweek i GW${gw}.` });
			}
		});
	}

	// Samme klubb i mange spillere er en skjult risiko.
	const counts = new Map<string, number>();
	for (const p of squad) counts.set(p.teamShort, (counts.get(p.teamShort) ?? 0) + 1);
	for (const [team, n] of counts) {
		if (n >= 3) alerts.push({ level: "low", text: `Tre spillere fra ${team} — maksgrensen er nådd, og risikoen er konsentrert.` });
	}

	const order = { high: 0, medium: 1, low: 2 };
	return alerts.sort((a, b) => order[a.level] - order[b.level]).slice(0, 14);
}

export type AnalyzeOptions = {
	horizon?: number;
	/** Overstyrer det estimerte antallet gratis bytter. */
	freeTransfers?: number;
};

export async function analyzeEntry(entryId: number, options: AnalyzeOptions = {}): Promise<Analysis> {
	const horizon = options.horizon ?? DEFAULT_HORIZON;

	const [bootstrap, fixtures, entry, history, transferHistory] = await Promise.all([
		getBootstrap(),
		getFixtures(),
		getEntry(entryId),
		getEntryHistory(entryId),
		getEntryTransfers(entryId).catch(() => []),
	]);

	const events = bootstrap.events;
	const current = events.find((e) => e.is_current);
	const next = events.find((e) => e.is_next);
	const targetEvent = next ?? current ?? events[events.length - 1];
	// Troppen leses fra siste runde vi faktisk har lov til å se.
	const sourceEvent = current ?? events.find((e) => e.id === Math.max(1, targetEvent.id - 1)) ?? targetEvent;

	const picks = await getEntryPicks(entryId, sourceEvent.id);

	const ctx = buildFixtureContext(bootstrap, fixtures, targetEvent.id, horizon);

	// Kamp-for-kamp-historikk for egen tropp gir en vesentlig bedre
	// spilletidsmodell der det betyr mest. Resten av spillerpoolen bruker
	// sesongsnitt — 700 ekstra kall ville gjort siden ubrukelig treg.
	const summaries = await getElementSummaries(picks.picks.map((p) => p.element));

	const projection = projectPlayers(bootstrap, ctx, { summaries });
	const purchase = purchasePrices(bootstrap, picks, transferHistory);

	const squad: SquadPlayer[] = picks.picks
		.map((pick) => {
			const proj = projection.byId.get(pick.element);
			if (!proj) return null;
			const purchasePrice = purchase.get(pick.element) ?? proj.price;
			return {
				...proj,
				squadPosition: pick.position,
				isCaptain: pick.is_captain,
				isViceCaptain: pick.is_vice_captain,
				multiplier: pick.multiplier,
				purchasePrice,
				sellingPrice: sellingPriceFor(purchasePrice, proj.price),
			} satisfies SquadPlayer;
		})
		.filter((p): p is SquadPlayer => p !== null)
		.sort((a, b) => a.squadPosition - b.squadPosition);

	const bestEleven = pickBestEleven(squad, 0);
	const captain = chooseCaptain(bestEleven.starters, 0);
	const lineup = lineupChanges(squad, bestEleven, 0);

	const maxFree = 1 + (bootstrap.game_settings?.max_extra_free_transfers ?? 4);
	const estimated = estimateFreeTransfers(history, maxFree);
	const freeTransfers = options.freeTransfers ?? estimated;

	const bank = picks.entry_history?.bank ?? entry.last_deadline_bank ?? 0;
	const teamValue = picks.entry_history?.value ?? entry.last_deadline_value ?? 1000;

	const ownedIds = new Set(squad.map((p) => p.id));
	const transfers = adviseTransfers(squad, projection.all, {
		bank,
		freeTransfers,
		slots: ctx.events.length,
	});

	const squadXpPerEvent = ctx.events.map((_, slot) => pickBestEleven(squad, slot).startersXp);

	const watchlist = projection.all
		.filter((p) => !ownedIds.has(p.id) && p.availabilityNext > 0.5)
		.sort((a, b) => b.xpTotal - a.xpTotal)
		.slice(0, 12);

	const priceWatch = {
		rising: projection.all
			.filter((p) => p.priceRisk.direction === "up")
			.sort((a, b) => b.priceRisk.strength - a.priceRisk.strength || b.priceRisk.netTransfers - a.priceRisk.netTransfers)
			.slice(0, 8),
		falling: projection.all
			.filter((p) => p.priceRisk.direction === "down" && (ownedIds.has(p.id) || p.selectedBy > 3))
			.sort((a, b) => a.priceRisk.strength - b.priceRisk.strength || a.priceRisk.netTransfers - b.priceRisk.netTransfers)
			.slice(0, 8),
	};

	const squadTeamIds = [...new Set(squad.map((p) => p.teamId))];
	const fixtureOutlook: TeamOutlook[] = squadTeamIds
		.map((teamId) => {
			const team = ctx.teamsById.get(teamId)!;
			return {
				teamId,
				short: team.short_name,
				name: team.name,
				averageDifficulty: averageDifficulty(ctx, teamId),
				perEvent: ctx.events.map((ev, slot) => ({
					event: ev.id,
					opponents: (ctx.schedule.get(teamId)?.[slot] ?? []).map((f) => ({
						short: f.opponentShort,
						isHome: f.isHome,
						difficulty: f.difficulty,
					})),
				})),
			};
		})
		.sort((a, b) => (a.averageDifficulty ?? 9) - (b.averageDifficulty ?? 9));

	const deadline = targetEvent.deadline_time;
	const hoursToDeadline = (Date.parse(deadline) - Date.now()) / 3_600_000;

	return {
		entry,
		targetEvent,
		sourceEvent,
		deadline,
		hoursToDeadline,
		horizon: ctx.events,
		squad,
		bestEleven,
		captain,
		lineup,
		transfers,
		squadXpPerEvent,
		squadXpTotal: squadXpPerEvent.reduce((a, b) => a + b, 0),
		bank,
		teamValue,
		freeTransfers,
		freeTransfersIsEstimate: options.freeTransfers === undefined,
		activeChip: picks.active_chip,
		chips: buildChipStatus(bootstrap, history, targetEvent.id),
		blanks: ctx.blanks.map((b) => ({
			event: b.event,
			teams: b.teams.map((t) => ctx.teamsById.get(t)?.short_name ?? String(t)),
		})),
		doubles: ctx.doubles.map((d) => ({
			event: d.event,
			teams: d.teams.map((t) => ctx.teamsById.get(t)?.short_name ?? String(t)),
		})),
		watchlist,
		priceWatch,
		fixtureOutlook,
		alerts: buildAlerts(squad, ctx.events),
		calibration: projection.calibration,
		generatedAt: new Date().toISOString(),
		history,
		picks,
	};
}
