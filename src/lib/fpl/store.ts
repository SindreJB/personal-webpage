import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase";
import type { Analysis } from "./entry";

/**
 * Lagring er valgfri. Uten Supabase fungerer krystallkulen fortsatt — den
 * mister bare evnen til å sammenligne det den trodde før deadline med det som
 * faktisk skjedde. Henter vi bare dagens data, kan vi aldri i ettertid
 * rekonstruere hva modellen visste.
 */
export const storageEnabled = () => hasSupabaseAdminConfig;

export type StoredProjection = {
	element: number;
	xp: number;
	in_starting_xi: boolean;
	multiplier: number;
};

/** Lagrer forventede poeng for runden som kommer, slik at de kan etterprøves. */
export async function saveProjections(analysis: Analysis): Promise<{ saved: number } | { error: string }> {
	if (!storageEnabled()) return { error: "Supabase er ikke konfigurert." };

	const starterIds = new Set(analysis.bestEleven.starters.map((p) => p.id));
	const rows = analysis.squad.map((p) => ({
		entry_id: analysis.entry.id,
		event: analysis.targetEvent.id,
		element: p.id,
		xp: Number(p.xp[0]?.toFixed(3) ?? 0),
		xp_horizon: Number(p.xpTotal.toFixed(3)),
		in_starting_xi: starterIds.has(p.id),
		multiplier: p.isCaptain ? 2 : 1,
		captured_at: analysis.generatedAt,
	}));

	const db = supabaseAdmin();
	const { error } = await db.from("fpl_projections").upsert(rows, { onConflict: "entry_id,event,element" });
	if (error) return { error: error.message };
	return { saved: rows.length };
}

/** Lagrer hele anbefalingen som den så ut før deadline. */
export async function saveRecommendation(analysis: Analysis): Promise<{ ok: true } | { error: string }> {
	if (!storageEnabled()) return { error: "Supabase er ikke konfigurert." };
	const db = supabaseAdmin();
	const payload = {
		captain: analysis.captain?.captain.name ?? null,
		formation: analysis.bestEleven.formationLabel,
		startersXp: Number(analysis.bestEleven.startersXp.toFixed(2)),
		horizonXp: Number(analysis.squadXpTotal.toFixed(2)),
		recommendation: analysis.transfers.recommendation,
		summary: analysis.transfers.summary,
		moves:
			analysis.transfers.bestSingle?.moves.map((m) => ({ out: m.out.name, in: m.in.name })) ?? [],
		freeTransfers: analysis.freeTransfers,
		bank: analysis.bank,
		calibration: Number(analysis.calibration.toFixed(3)),
		alerts: analysis.alerts,
	};
	const { error } = await db.from("fpl_recommendations").upsert(
		{
			entry_id: analysis.entry.id,
			event: analysis.targetEvent.id,
			payload,
			captured_at: analysis.generatedAt,
		},
		{ onConflict: "entry_id,event" },
	);
	if (error) return { error: error.message };
	return { ok: true };
}

export async function loadProjections(entryId: number, event: number): Promise<Map<number, StoredProjection>> {
	if (!storageEnabled()) return new Map();
	const db = supabaseAdmin();
	const { data, error } = await db
		.from("fpl_projections")
		.select("element, xp, in_starting_xi, multiplier")
		.eq("entry_id", entryId)
		.eq("event", event);
	if (error || !data) return new Map();
	return new Map(data.map((r) => [r.element as number, r as StoredProjection]));
}

export type PriceSnapshotRow = {
	element: number;
	now_cost: number;
	price_change_percent: number;
	transfers_in_event: number;
	transfers_out_event: number;
	selected_by_percent: number;
};

/**
 * Øyeblikksbilde av eierskap og prisbevegelse. Kjøres jevnlig gjennom døgnet,
 * så vi bygger opp vår egen tidsserie i stedet for å stole blindt på at FPL
 * sine projeksjoner alltid ligger der.
 */
export async function savePriceSnapshot(rows: PriceSnapshotRow[]): Promise<{ saved: number } | { error: string }> {
	if (!storageEnabled()) return { error: "Supabase er ikke konfigurert." };
	const capturedAt = new Date().toISOString();
	const db = supabaseAdmin();
	const { error } = await db.from("fpl_price_snapshots").insert(rows.map((r) => ({ ...r, captured_at: capturedAt })));
	if (error) return { error: error.message };
	return { saved: rows.length };
}
