import { NextResponse } from "next/server";
import { getBootstrap } from "@/lib/fpl/api";
import { analyzeEntry } from "@/lib/fpl/entry";
import { savePriceSnapshot, saveProjections, saveRecommendation, storageEnabled } from "@/lib/fpl/store";

export const dynamic = "force-dynamic";

/**
 * Planlagt kjøring. Tanken er å kalle denne
 *   – et par ganger i døgnet for pris- og eierskapsserien, og
 *   – én gang like før hver deadline for å fryse prognosen.
 *
 * Uten det siste kan vi aldri i ettertid måle modellen mot fasit: henter vi
 * bare dagens data, er det umulig å rekonstruere hva den trodde på forhånd.
 */
function authorize(request: Request): boolean {
	// Vercel Cron sender selv `Authorization: Bearer $CRON_SECRET`. Kjører du
	// den manuelt eller fra en annen planlegger, bruk FPL_CRON_KEY.
	const secrets = [process.env.FPL_CRON_KEY, process.env.CRON_SECRET].filter(Boolean);
	if (!secrets.length) return false;
	const url = new URL(request.url);
	const provided =
		url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
	return provided !== null && secrets.includes(provided);
}

export async function GET(request: Request) {
	if (!authorize(request)) {
		return NextResponse.json({ error: "Ugyldig eller manglende nøkkel." }, { status: 401 });
	}
	if (!storageEnabled()) {
		return NextResponse.json({ error: "Supabase er ikke konfigurert — ingenting å lagre til." }, { status: 503 });
	}

	const url = new URL(request.url);
	const entryParam = url.searchParams.get("entry") ?? process.env.FPL_ENTRY_ID;
	const result: Record<string, unknown> = { ranAt: new Date().toISOString() };

	try {
		const bootstrap = await getBootstrap();
		const rows = bootstrap.elements
			// Spillere uten eierskap av betydning gir bare støy i tidsserien.
			.filter((e) => parseFloat(e.selected_by_percent) >= 0.3 || Math.abs(e.transfers_in_event - e.transfers_out_event) > 5000)
			.map((e) => ({
				element: e.id,
				now_cost: e.now_cost,
				price_change_percent: parseFloat(e.price_change_percent) || 0,
				transfers_in_event: e.transfers_in_event,
				transfers_out_event: e.transfers_out_event,
				selected_by_percent: parseFloat(e.selected_by_percent) || 0,
			}));
		result.prices = await savePriceSnapshot(rows);
	} catch (err) {
		result.prices = { error: err instanceof Error ? err.message : "Ukjent feil." };
	}

	const entryId = Number(entryParam);
	if (Number.isInteger(entryId) && entryId > 0) {
		try {
			const analysis = await analyzeEntry(entryId);
			result.entry = entryId;
			result.event = analysis.targetEvent.id;
			result.hoursToDeadline = Number(analysis.hoursToDeadline.toFixed(1));
			result.projections = await saveProjections(analysis);
			result.recommendation = await saveRecommendation(analysis);
		} catch (err) {
			result.entryError = err instanceof Error ? err.message : "Ukjent feil.";
		}
	}

	return NextResponse.json(result);
}
