import { getBootstrap, getEntry, getEntryHistory, getEntryPicks, getEventLive } from "./api";
import { chipLabel } from "./format";
import { loadProjections } from "./store";
import type { BootstrapEvent, EntryHistoryRow } from "./types";

export type ReviewPlayer = {
	element: number;
	name: string;
	teamShort: string;
	position: string;
	minutes: number;
	actual: number;
	/** Poeng slik de telte for laget (kaptein doblet, benk = 0). */
	counted: number;
	expected: number | null;
	delta: number | null;
	multiplier: number;
	started: boolean;
	wasAutoSubbed: boolean;
};

export type GameweekReview = {
	event: BootstrapEvent;
	entryName: string;
	points: number;
	averageScore: number;
	highestScore: number | null;
	overallRank: number | null;
	rankMovement: number | null;
	benchPoints: number;
	transfersCost: number;
	transfersMade: number;
	activeChip: string | null;
	captain: ReviewPlayer | null;
	viceCaptain: ReviewPlayer | null;
	captainAlternativeBest: ReviewPlayer | null;
	players: ReviewPlayer[];
	autoSubs: { in: string; out: string }[];
	/** Sum forventede poeng for elleveren, hvis prognosen ble lagret før deadline. */
	expectedTotal: number | null;
	expectedDelta: number | null;
	best: ReviewPlayer[];
	worst: ReviewPlayer[];
	/** Poeng laget gikk glipp av fordi feil spillere startet. */
	benchRegret: number;
	notes: string[];
};

const POSITION_NAMES: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

/** Oppsummerer en ferdigspilt gameweek, og måler modellen mot fasit. */
export async function reviewGameweek(entryId: number, eventId?: number): Promise<GameweekReview> {
	const bootstrap = await getBootstrap();
	const finished = bootstrap.events.filter((e) => e.finished);
	const event = eventId
		? bootstrap.events.find((e) => e.id === eventId)
		: (finished[finished.length - 1] ?? bootstrap.events[0]);
	if (!event) throw new Error("Fant ingen ferdigspilt gameweek å oppsummere.");

	const [entry, picks, live, history, stored] = await Promise.all([
		getEntry(entryId),
		getEntryPicks(entryId, event.id),
		getEventLive(event.id),
		getEntryHistory(entryId),
		loadProjections(entryId, event.id),
	]);

	const elementsById = new Map(bootstrap.elements.map((e) => [e.id, e]));
	const teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
	const liveById = new Map(live.elements.map((e) => [e.id, e]));
	const autoSubIn = new Set(picks.automatic_subs.map((s) => s.element_in));
	const autoSubOut = new Set(picks.automatic_subs.map((s) => s.element_out));

	const players: ReviewPlayer[] = picks.picks.map((pick) => {
		const el = elementsById.get(pick.element);
		const stats = liveById.get(pick.element)?.stats;
		const actual = stats?.total_points ?? 0;
		const projection = stored.get(pick.element);
		// Auto-bytter endrer multiplikatoren i etterkant; picks-endepunktet viser
		// laget slik det så ut ved deadline.
		const effectiveMultiplier = autoSubIn.has(pick.element)
			? 1
			: autoSubOut.has(pick.element)
				? 0
				: pick.multiplier;
		return {
			element: pick.element,
			name: el?.web_name ?? `#${pick.element}`,
			teamShort: el ? (teamsById.get(el.team)?.short_name ?? "") : "",
			position: POSITION_NAMES[pick.element_type] ?? "",
			minutes: stats?.minutes ?? 0,
			actual,
			counted: actual * effectiveMultiplier,
			expected: projection?.xp ?? null,
			delta: projection ? actual - projection.xp : null,
			multiplier: effectiveMultiplier,
			started: pick.position <= 11,
			wasAutoSubbed: autoSubIn.has(pick.element) || autoSubOut.has(pick.element),
		};
	});

	const captain = players.find((p) => picks.picks.find((x) => x.element === p.element)?.is_captain) ?? null;
	const viceCaptain = players.find((p) => picks.picks.find((x) => x.element === p.element)?.is_vice_captain) ?? null;
	const onPitch = players.filter((p) => p.multiplier > 0);
	const captainAlternativeBest = [...onPitch].sort((a, b) => b.actual - a.actual)[0] ?? null;

	const row: EntryHistoryRow | undefined = history.current.find((r) => r.event === event.id);
	const prevRow = history.current.find((r) => r.event === event.id - 1);
	const rankMovement =
		row?.overall_rank != null && prevRow?.overall_rank != null ? prevRow.overall_rank - row.overall_rank : null;

	const expectedRows = players.filter((p) => p.expected !== null && p.multiplier > 0);
	const expectedTotal = expectedRows.length
		? expectedRows.reduce((a, p) => a + (p.expected ?? 0) * p.multiplier, 0)
		: null;

	const benchPoints = picks.entry_history?.points_on_bench ?? 0;
	const points = picks.entry_history?.points ?? row?.points ?? 0;

	// Hvor mange poeng ville den beste lovlige elleveren gitt, i etterpåklokskap?
	const benchRegret = computeBenchRegret(players, picks.picks.map((p) => ({ element: p.element, type: p.element_type })));

	const graded = players.filter((p) => p.delta !== null);
	const best = [...graded].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 3);
	const worst = [...graded].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, 3);

	const notes: string[] = [];
	if (!stored.size) {
		notes.push(
			"Prognosen for denne runden ble ikke lagret før deadline, så modellen kan ikke etterprøves. Kjør lagringen før hver deadline for å få med denne sammenligningen.",
		);
	}
	if (captain && captainAlternativeBest && captainAlternativeBest.element !== captain.element) {
		const missed = (captainAlternativeBest.actual - captain.actual) * (picks.active_chip === "3xc" ? 2 : 1);
		if (missed > 0) {
			notes.push(`Kapteinsbindet på ${captainAlternativeBest.name} i stedet for ${captain.name} ville gitt ${missed} poeng til.`);
		}
	}
	if (benchRegret > 0) notes.push(`${benchRegret} poeng gikk tapt på benken etter automatiske innbytter.`);
	if ((picks.entry_history?.event_transfers_cost ?? 0) > 0) {
		notes.push(`${picks.entry_history.event_transfers_cost} poeng gikk til poengtrekk for ekstra bytter.`);
	}
	if (picks.active_chip) notes.push(`Chip brukt: ${chipLabel(picks.active_chip)}.`);

	return {
		event,
		entryName: entry.name,
		points,
		averageScore: event.average_entry_score,
		highestScore: event.highest_score,
		overallRank: row?.overall_rank ?? null,
		rankMovement,
		benchPoints,
		transfersCost: picks.entry_history?.event_transfers_cost ?? 0,
		transfersMade: picks.entry_history?.event_transfers ?? 0,
		activeChip: picks.active_chip,
		captain,
		viceCaptain,
		captainAlternativeBest,
		players,
		autoSubs: picks.automatic_subs.map((s) => ({
			in: elementsById.get(s.element_in)?.web_name ?? `#${s.element_in}`,
			out: elementsById.get(s.element_out)?.web_name ?? `#${s.element_out}`,
		})),
		expectedTotal,
		expectedDelta: expectedTotal !== null ? points + (picks.entry_history?.event_transfers_cost ?? 0) - expectedTotal : null,
		best,
		worst,
		benchRegret,
		notes,
	};
}

/**
 * Poengene den beste lovlige elleveren ville gitt, minus de vi faktisk fikk.
 * Automatiske innbytter er allerede regnet med i `counted`.
 */
function computeBenchRegret(players: ReviewPlayer[], types: { element: number; type: number }[]): number {
	const typeById = new Map(types.map((t) => [t.element, t.type]));
	const actualCounted = players.reduce((a, p) => a + (p.multiplier > 0 ? p.actual : 0), 0);

	const keepers = players.filter((p) => typeById.get(p.element) === 1).sort((a, b) => b.actual - a.actual);
	const defs = players.filter((p) => typeById.get(p.element) === 2).sort((a, b) => b.actual - a.actual);
	const mids = players.filter((p) => typeById.get(p.element) === 3).sort((a, b) => b.actual - a.actual);
	const fwds = players.filter((p) => typeById.get(p.element) === 4).sort((a, b) => b.actual - a.actual);

	let best = -Infinity;
	for (let d = 3; d <= 5; d++) {
		for (let m = 2; m <= 5; m++) {
			const f = 10 - d - m;
			if (f < 1 || f > 3) continue;
			if (defs.length < d || mids.length < m || fwds.length < f || !keepers.length) continue;
			const total =
				keepers[0].actual +
				defs.slice(0, d).reduce((a, p) => a + p.actual, 0) +
				mids.slice(0, m).reduce((a, p) => a + p.actual, 0) +
				fwds.slice(0, f).reduce((a, p) => a + p.actual, 0);
			best = Math.max(best, total);
		}
	}
	return best === -Infinity ? 0 : Math.max(0, best - actualCounted);
}
