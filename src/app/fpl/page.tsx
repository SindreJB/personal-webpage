import Link from "next/link";
import { Suspense } from "react";
import { FplApiError, parseEntryId } from "@/lib/fpl/api";
import { analyzeEntry, type Analysis } from "@/lib/fpl/entry";
import { ALERT_LABEL, deadlineStamp, money, rank, relativeDeadline, timestamp, xp } from "@/lib/fpl/format";
import { reviewGameweek, type GameweekReview } from "@/lib/fpl/review";
import FixtureOutlook from "./components/FixtureOutlook";
import { FixtureLegend } from "./components/Fixtures";
import Planning from "./components/Planning";
import PriceWatch from "./components/PriceWatch";
import ReviewPanel from "./components/ReviewPanel";
import SquadTable from "./components/SquadTable";
import TransferPanel, { Watchlist } from "./components/TransferPanel";
import Verdict from "./components/Verdict";
import TeamForm from "./TeamForm";

export const dynamic = "force-dynamic";

type SearchParams = { lag?: string; ft?: string; visning?: string };

function Masthead({ view, team }: { view: string; team: string }) {
	const qs = (v: string) => {
		const p = new URLSearchParams();
		if (team) p.set("lag", team);
		if (v !== "prognose") p.set("visning", v);
		return `/fpl${p.size ? `?${p.toString()}` : ""}`;
	};

	return (
		<>
			<div className="kk-masthead">
				<div>
					<p className="kk-kicker">/fpl · beslutningsstøtte</p>
					<h1 className="kk-title">Krystallkulen</h1>
				</div>
				<Link href="/" className="kk-back">
					← tilbake
				</Link>
			</div>
			{team ? (
				<nav className="kk-tabs">
					<Link className="kk-tab" data-active={view === "prognose"} href={qs("prognose")}>
						Før deadline
					</Link>
					<Link className="kk-tab" data-active={view === "oppsummering"} href={qs("oppsummering")}>
						Etter runden
					</Link>
				</nav>
			) : null}
		</>
	);
}

function Intro() {
	return (
		<>
			<p className="kk-lede">
				Lim inn lag-ID-en din, så leser krystallkulen troppen din fra det offisielle FPL-API-et og regner ut forventede
				poeng for de neste seks rundene: kaptein, ellever, ett bytteforslag, prisrisiko og hvem som er i faresonen.
			</p>
			<p className="kk-lede">
				Dette er beslutningsstøtte, ikke spådom. Tallene er forventningsverdier med stor spredning — den største
				usikkerheten er alltid spilletid.
			</p>
		</>
	);
}

function Footnotes({ analysis }: { analysis?: Analysis }) {
	return (
		<>
			<div className="kk-footnote">
				<h4>Hvordan tallene blir til</h4>
				Grunnlaget er FPL sitt eget API: spillere, priser, skadestatus, kampprogram og vanskelighetsgrad. Forventede mål
				og målgivende per 90 minutter regresseres mot et posisjonssnitt, slik at små utvalg ikke får dominere. Lagstyrken
				bygges fra sesongens data — summen av spillernes forventede mål gir angrepet, keepernes forventede baklengsmål gir
				forsvaret — regressert mot ligasnittet og justert lett med FPL sin egen vanskelighetsgrad. FPL sluttet nemlig å
				fylle ut de detaljerte styrkefeltene sine; de står på null. Clean sheets og baklengsmål modelleres som
				Poisson-fordelinger, det samme gjelder terskelen for defensive contribution. Spilletid vektes mot de fem siste
				rundene for spillerne i din egen tropp.
				{analysis ? (
					<>
						{" "}
						Til slutt kalibreres hele modellen mot FPL sin egen <em>ep_next</em> for den kommende runden — denne gangen
						med faktoren {xp(analysis.calibration, 3)}.
					</>
				) : null}
			</div>
			<div className="kk-footnote">
				<h4>Hva den ikke vet</h4>
				Den kjenner ikke pressekonferanser, treningsmeldinger eller taktiske planer. Skadeinformasjonen er FPL sin egen,
				og den oppdateres ofte sent. Antall gratis bytter er utledet fra byttehistorikken og kan være feil hvis du har
				brukt chips på uvanlige måter — du kan overstyre det i skjemaet. Salgsprisene er rekonstruert fra
				byttehistorikk og prisendring siden sesongstart, ikke hentet fra din egen konto. Prisendringer oppgis som
				risikonivå fra FPL sin egen projeksjon, ikke som en prosent vi har funnet på selv.
			</div>
		</>
	);
}

async function Prognosis({ entryId, freeTransfers }: { entryId: number; freeTransfers?: number }) {
	const analysis = await analyzeEntry(entryId, { freeTransfers });
	const beforeDeadline = analysis.hoursToDeadline > 0;

	return (
		<>
			<p className="kk-lede">
				{analysis.entry.name} — {analysis.entry.player_first_name} {analysis.entry.player_last_name}. Troppen er lest fra{" "}
				{analysis.sourceEvent.name}, og anbefalingen gjelder {analysis.targetEvent.name}.
			</p>

			<dl className="kk-stats">
				<div className="kk-stat">
					<dt>Deadline</dt>
					<dd>{relativeDeadline(analysis.deadline)}</dd>
					<small>{deadlineStamp(analysis.deadline)}</small>
				</div>
				<div className="kk-stat">
					<dt>Forventet GW{analysis.targetEvent.id}</dt>
					<dd>{xp(analysis.bestEleven.startersXp + (analysis.captain?.expectedBonusPoints ?? 0))}</dd>
					<small>med kapteinsbindet</small>
				</div>
				<div className="kk-stat">
					<dt>{analysis.horizon.length} runder</dt>
					<dd>{xp(analysis.squadXpTotal)}</dd>
					<small>uten bytter og kaptein</small>
				</div>
				<div className="kk-stat">
					<dt>Totalpoeng</dt>
					<dd>{analysis.entry.summary_overall_points}</dd>
					<small>plass {rank(analysis.entry.summary_overall_rank)}</small>
				</div>
				<div className="kk-stat">
					<dt>Lagverdi</dt>
					<dd>{money(analysis.teamValue)}</dd>
					<small>{money(analysis.bank)} i banken</small>
				</div>
				<div className="kk-stat">
					<dt>Gratis bytter</dt>
					<dd>{analysis.freeTransfers}</dd>
					<small>{analysis.freeTransfersIsEstimate ? "estimert fra historikken" : "satt av deg"}</small>
				</div>
			</dl>

			{!beforeDeadline ? (
				<p className="kk-note" style={{ marginTop: 14 }}>
					Deadline for {analysis.targetEvent.name} har passert. Anbefalingene under gjelder derfor laget slik det
					allerede er låst — se «Etter runden» for oppsummeringen.
				</p>
			) : null}

			<section className="kk-section">
				<div className="kk-section-head">
					<h2 className="kk-h2">Dommen</h2>
					<span className="kk-note">før deadline {deadlineStamp(analysis.deadline)}</span>
				</div>
				<Verdict analysis={analysis} />
			</section>

			{analysis.alerts.length > 0 ? (
				<section className="kk-section">
					<div className="kk-section-head">
						<h2 className="kk-h2">Risiko</h2>
						<span className="kk-note">{analysis.alerts.length} forhold</span>
					</div>
					<ul className="kk-alerts">
						{analysis.alerts.map((a, i) => (
							<li key={`${a.text}-${i}`} className={`kk-alert kk-alert--${a.level}`}>
								<span className="kk-alert-level">{ALERT_LABEL[a.level]}</span>
								<span>{a.text}</span>
							</li>
						))}
					</ul>
				</section>
			) : null}

			<section className="kk-section">
				<div className="kk-section-head">
					<h2 className="kk-h2">Troppen</h2>
					<span className="kk-note">forventede poeng per runde</span>
				</div>
				<SquadTable analysis={analysis} />
				<div style={{ marginTop: 10 }}>
					<FixtureLegend />
				</div>
			</section>

			<section className="kk-section">
				<div className="kk-section-head">
					<h2 className="kk-h2">Bytter</h2>
					<span className="kk-note">
						{analysis.freeTransfers} gratis · {money(analysis.bank)} i banken
					</span>
				</div>
				<TransferPanel analysis={analysis} />
			</section>

			<section className="kk-section">
				<div className="kk-section-head">
					<h2 className="kk-h2">Kampprogram</h2>
					<span className="kk-note">klubbene du eier</span>
				</div>
				<FixtureOutlook analysis={analysis} />
			</section>

			<section className="kk-section">
				<div className="kk-section-head">
					<h2 className="kk-h2">Pris</h2>
					<span className="kk-note">FPL sin egen projeksjon for i natt</span>
				</div>
				<PriceWatch analysis={analysis} />
			</section>

			<section className="kk-section">
				<div className="kk-section-head">
					<h2 className="kk-h2">Planlegging</h2>
					<span className="kk-note">chips og kalender</span>
				</div>
				<Planning analysis={analysis} />
			</section>

			<section className="kk-section">
				<div className="kk-section-head">
					<h2 className="kk-h2">Verdt å se på</h2>
					<span className="kk-note">høyest forventet over {analysis.horizon.length} runder</span>
				</div>
				<Watchlist analysis={analysis} />
			</section>

			<Footnotes analysis={analysis} />
			<p className="kk-note" style={{ marginTop: 18 }}>
				Beregnet {timestamp(analysis.generatedAt)}. Kilde: det offisielle FPL-API-et.
			</p>
		</>
	);
}

async function Retrospective({ entryId }: { entryId: number }) {
	const review: GameweekReview = await reviewGameweek(entryId);
	return (
		<>
			<p className="kk-lede">
				{review.entryName} — {review.event.name}. {review.points} poeng mot et snitt på {review.averageScore}.
			</p>
			<section className="kk-section">
				<div className="kk-section-head">
					<h2 className="kk-h2">Etter runden</h2>
					<span className="kk-note">faktisk mot forventet</span>
				</div>
				<ReviewPanel review={review} />
			</section>
			<Footnotes />
		</>
	);
}

function ErrorBox({ message }: { message: string }) {
	return (
		<div className="kk-error">
			<strong>Fikk ikke hentet laget.</strong>
			<br />
			{message}
		</div>
	);
}

async function Content({ entryId, view, freeTransfers }: { entryId: number; view: string; freeTransfers?: number }) {
	try {
		if (view === "oppsummering") return await Retrospective({ entryId });
		return await Prognosis({ entryId, freeTransfers });
	} catch (err) {
		const message =
			err instanceof FplApiError && err.status === 404
				? "FPL kjenner ikke igjen dette lag-ID-et, eller laget har ikke spilt noen runder ennå."
				: err instanceof Error
					? err.message
					: "Ukjent feil.";
		return <ErrorBox message={message} />;
	}
}

export default async function FplPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
	const sp = await searchParams;
	const teamInput = sp.lag ?? "";
	const entryId = parseEntryId(teamInput);
	const view = sp.visning === "oppsummering" ? "oppsummering" : "prognose";
	const ftRaw = Number(sp.ft);
	const freeTransfers = Number.isInteger(ftRaw) && ftRaw >= 1 && ftRaw <= 5 ? ftRaw : undefined;

	return (
		<main className="kk">
			<Masthead view={view} team={teamInput} />
			{!entryId ? <Intro /> : null}

			<Suspense fallback={null}>
				<TeamForm initialTeam={teamInput} initialFreeTransfers={freeTransfers ? String(freeTransfers) : ""} />
			</Suspense>

			{teamInput && !entryId ? (
				<ErrorBox message="Fant ingen lag-ID i det du limte inn. Prøv tallet fra lenken, for eksempel 5991938." />
			) : null}

			{entryId ? (
				<Suspense
					fallback={
						<p className="kk-note" style={{ marginTop: 28 }}>
							Henter lag, kamper og priser fra FPL …
						</p>
					}
				>
					<Content entryId={entryId} view={view} freeTransfers={freeTransfers} />
				</Suspense>
			) : (
				<Footnotes />
			)}
		</main>
	);
}
