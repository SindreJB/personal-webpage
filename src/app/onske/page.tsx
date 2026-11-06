import type { Metadata } from "next";
import BronnView from "./BronnView";
import { isOwner, wishesForGiver, wishesForOwner } from "@/lib/onske";

export const metadata: Metadata = {
	title: "Ønskebrønnen — Sindre",
	description:
		"En privat ønskebrønn: legg inn en lenke, så finner brønnen pris og bilde. Besøkende kan reservere — men eieren ser aldri hvem.",
};

export const dynamic = "force-dynamic";

export default async function OnskePage() {
	const owner = await isOwner();

	// Brønnen er mørk for eieren: navn på givere filtreres bort på serveren.
	const wishes = owner ? await wishesForOwner() : await wishesForGiver();

	return <BronnView wishes={wishes} owner={owner} />;
}
