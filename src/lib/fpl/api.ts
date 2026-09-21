import type {
	Bootstrap,
	ElementSummary,
	EntryHistory,
	EntryPicks,
	EntrySummary,
	EntryTransfer,
	EventLive,
	Fixture,
} from "./types";

const BASE = "https://fantasy.premierleague.com/api";

/**
 * FPL-API-et har ingen offentlig SLA. Vi behandler det som en ustabil kilde:
 * korte timeouts, ett retry, og revalidate-vinduer som holder trafikken nede.
 */
export class FplApiError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = "FplApiError";
	}
}

const TIMEOUT_MS = 12_000;

async function fplFetch<T>(path: string, revalidate: number, attempt = 0): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(`${BASE}${path}`, {
			signal: controller.signal,
			headers: {
				// FPL blokkerer tomme/agentaktige user-agents i perioder.
				"User-Agent": "krystallkulen/1.0 (+https://github.com/SindreJB)",
				Accept: "application/json",
			},
			next: { revalidate },
		});
		if (res.status === 404) throw new FplApiError(`Fant ikke ${path}`, 404);
		if (!res.ok) throw new FplApiError(`FPL svarte ${res.status} på ${path}`, res.status);
		return (await res.json()) as T;
	} catch (err) {
		clearTimeout(timer);
		const is404 = err instanceof FplApiError && err.status === 404;
		if (!is404 && attempt < 1) {
			await new Promise((r) => setTimeout(r, 400));
			return fplFetch<T>(path, revalidate, attempt + 1);
		}
		if (err instanceof FplApiError) throw err;
		throw new FplApiError(`Fikk ikke kontakt med FPL-API-et (${path}).`);
	} finally {
		clearTimeout(timer);
	}
}

/** Spillere, lag, gameweeks, priser, skadestatus. Endres flere ganger i døgnet. */
export const getBootstrap = () => fplFetch<Bootstrap>("/bootstrap-static/", 600);

/** Alle kamper i sesongen, inkl. FDR og utsatte kamper (event = null). */
export const getFixtures = () => fplFetch<Fixture[]>("/fixtures/", 1800);

export const getEntry = (entryId: number) => fplFetch<EntrySummary>(`/entry/${entryId}/`, 600);

export const getEntryPicks = (entryId: number, event: number) =>
	fplFetch<EntryPicks>(`/entry/${entryId}/event/${event}/picks/`, 600);

export const getEntryHistory = (entryId: number) => fplFetch<EntryHistory>(`/entry/${entryId}/history/`, 600);

export const getEntryTransfers = (entryId: number) => fplFetch<EntryTransfer[]>(`/entry/${entryId}/transfers/`, 600);

export const getEventLive = (event: number) => fplFetch<EventLive>(`/event/${event}/live/`, 300);

export const getElementSummary = (elementId: number) =>
	fplFetch<ElementSummary>(`/element-summary/${elementId}/`, 1800);

/** Henter element-summary for flere spillere med tak på samtidige kall. */
export async function getElementSummaries(ids: number[], concurrency = 6): Promise<Map<number, ElementSummary>> {
	const out = new Map<number, ElementSummary>();
	const queue = [...new Set(ids)];
	const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
		for (;;) {
			const id = queue.shift();
			if (id === undefined) return;
			try {
				out.set(id, await getElementSummary(id));
			} catch {
				// Historikk er en forbedring, ikke et krav — vi faller tilbake på sesongsnitt.
			}
		}
	});
	await Promise.all(workers);
	return out;
}

/**
 * Godtar alt av det folk faktisk limer inn:
 *   5991938
 *   https://fantasy.premierleague.com/entry/5991938/event/4
 *   https://fantasy.premierleague.com/api/entry/5991938/event/4/picks/
 */
export function parseEntryId(input: string): number | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	if (/^\d{1,9}$/.test(trimmed)) return Number(trimmed);
	const match = trimmed.match(/entry\/(\d{1,9})/i);
	if (match) return Number(match[1]);
	const bare = trimmed.match(/(\d{5,9})/);
	return bare ? Number(bare[1]) : null;
}
