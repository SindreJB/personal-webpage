import type { Analysis } from "@/lib/fpl/entry";
import { chipLabel, xp } from "@/lib/fpl/format";

/**
 * Chips og kalenderen framover. Krystallkulen anbefaler ikke chipbruk av seg
 * selv — den peker bare på rundene der det kan bli aktuelt, og lar deg
 * bestemme. En chipanbefaling seks runder fram er gjetning forkledd som råd.
 */
export default function Planning({ analysis }: { analysis: Analysis }) {
	const benchBoostWorth = analysis.bestEleven.benchXp;
	const captainXp = analysis.captain?.expectedBonusPoints ?? 0;
	// Bare chips som faktisk kan spilles i den kommende runden — ellers ville vi
	// gitt råd om andrehalvdelens Bench Boost i september.
	const target = analysis.targetEvent.id;
	const available = analysis.chips.filter(
		(c) => !c.used && (c.availableFrom ?? 1) <= target && target <= (c.availableUntil ?? 38),
	);

	const hints: string[] = [];
	if (analysis.activeChip) {
		hints.push(`Du hadde ${chipLabel(analysis.activeChip)} aktiv i ${analysis.sourceEvent.name}.`);
	}
	if (available.some((c) => c.name === "bboost")) {
		hints.push(
			benchBoostWorth >= 14
				? `Benken er verdt ${xp(benchBoostWorth)} poeng i ${analysis.targetEvent.name} — uvanlig høyt for et bench boost.`
				: `Benken er verdt ${xp(benchBoostWorth)} poeng. Bench Boost bør normalt vente til den ligger nærmere 15.`,
		);
	}
	if (available.some((c) => c.name === "3xc") && analysis.captain) {
		hints.push(
			captainXp >= 9
				? `${analysis.captain.captain.name} ligger på ${xp(captainXp)} forventede poeng — i det området Triple Captain begynner å svare seg.`
				: `Beste kaptein er på ${xp(captainXp)} forventede poeng. Triple Captain er normalt verdt å spare til en dobbel runde.`,
		);
	}
	for (const d of analysis.doubles) {
		hints.push(`Dobbel runde i GW${d.event}: ${d.teams.join(", ")}.`);
	}
	for (const b of analysis.blanks) {
		hints.push(`Blank runde i GW${b.event}: ${b.teams.join(", ")}.`);
	}
	if (analysis.blanks.length === 0 && analysis.doubles.length === 0) {
		hints.push(`Ingen blanke eller doble runder de neste ${analysis.horizon.length} rundene, slik kalenderen ser ut nå.`);
	}

	return (
		<div className="kk-columns">
			<section className="kk-card">
				<h3>Chips</h3>
				<ul className="kk-list">
					{analysis.chips.map((c) => (
						<li key={`${c.name}-${c.availableFrom}`}>
							<span>{c.label}</span>
							<span className="kk-sub">
								{c.used ? `brukt i GW${c.usedInEvent}` : `GW${c.availableFrom}–${c.availableUntil}`}
							</span>
						</li>
					))}
					{analysis.chips.length === 0 ? <li>Ingen chips igjen i denne halvdelen.</li> : null}
				</ul>
			</section>
			<section className="kk-card">
				<h3>Kalenderen framover</h3>
				<ul className="kk-list">
					{hints.map((h) => (
						<li key={h}>
							<span>{h}</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
