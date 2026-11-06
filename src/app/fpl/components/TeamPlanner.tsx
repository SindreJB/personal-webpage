"use client";

import { useEffect, useMemo, useState } from "react";
import { money, signed, xp } from "@/lib/fpl/format";
import {
	affordableLimitByPosition,
	applyMove,
	initialPlan,
	isRestorablePlan,
	moveRejection,
	optimisedPlan,
	readSavedPlan,
	requirePlayer,
	savePlan,
	STARTER_COUNT,
	summarisePlan,
	withCaptain,
	withViceCaptain,
	type PlanMoveSource,
	type PlannerData,
	type PlanSummary,
	type PlayersById,
	type SquadPlan,
} from "@/lib/fpl/planner";
import type { PositionShort } from "@/lib/fpl/projection";
import { PlayerShirt, XpCells, prepareDragData, pressableProps } from "./PlannerParts";
import PlayerPool from "./PlayerPool";

const PITCH_ROW_POSITIONS: PositionShort[] = ["GKP", "DEF", "MID", "FWD"];
const DEFAULT_HINT =
	"Dra en spiller fra lista og slipp på den du vil selge, eller trykk på begge. Gjør det samme mellom bane og benk for å endre elleveren. Velg en spiller for å gi kapteinsbindet.";

const netExpectedNextGameweek = (summary: PlanSummary) => (summary.expectedPerGameweek[0] ?? 0) - summary.hitCost;
const netExpectedAllGameweeks = (summary: PlanSummary) =>
	summary.expectedPerGameweek.reduce((sum, points) => sum + points, 0) - summary.hitCost;

function comparedToStarting(difference: number, unchangedLabel: string) {
	return Math.abs(difference) < 0.05 ? unchangedLabel : `${signed(difference)} mot laget ditt`;
}

function PitchMarkings() {
	return (
		<svg className="kk-pitch-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
			<polygon points="60,4 940,4 996,996 4,996" />
			<polyline points="290,4 282,178 718,178 710,4" />
			<polyline points="400,4 396,62 604,62 600,4" />
			<path d="M 410 178 A 100 62 0 0 0 590 178" />
			<line x1="20" y1="720" x2="980" y2="720" />
			<ellipse cx="500" cy="720" rx="130" ry="112" />
			<path d="M 60 30 A 26 26 0 0 0 86 4 M 914 4 A 26 26 0 0 0 940 30" />
		</svg>
	);
}

/**
 * Lagplanleggeren: banen, benken og spillerlista. All tilstand lever i
 * nettleseren — ingenting sendes til FPL, så du kan prøve deg fram fritt.
 * Planen lagres der også, så den overlever at siden lastes på nytt.
 */
export default function TeamPlanner({
	data,
	gameweekName,
	deadlineLabel,
}: {
	data: PlannerData;
	gameweekName: string;
	deadlineLabel: string;
}) {
	const playersById: PlayersById = useMemo(() => new Map(data.players.map((player) => [player.id, player])), [data]);
	const clubsById = useMemo(() => new Map(data.clubs.map((club) => [club.id, club])), [data]);
	const startingPlan = useMemo(() => initialPlan(data), [data]);
	const startingSummary = useMemo(() => summarisePlan(startingPlan, data, playersById), [startingPlan, data, playersById]);

	const [plan, setPlan] = useState(startingPlan);
	const [moveSource, setMoveSource] = useState<PlanMoveSource | null>(null);
	const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
	const [statusWarning, setStatusWarning] = useState<string | null>(null);

	// Serveren kjenner ikke den lagrede planen, så den må hentes etter første visning.
	useEffect(() => {
		const savedPlan = readSavedPlan(data);
		if (savedPlan === null) return;
		if (isRestorablePlan(savedPlan, data, playersById)) {
			setPlan(savedPlan);
			return;
		}
		savePlan(data, initialPlan(data));
		setStatusWarning("Den lagrede planen passer ikke lenger med dataene fra FPL, så du ser laget ditt slik det står.");
	}, [data, playersById]);

	const summary = summarisePlan(plan, data, playersById);
	const rejectionBySlot = moveSource
		? plan.slotPlayerIds.map((_, slotIndex) => moveRejection(plan, moveSource, slotIndex, data, playersById))
		: null;

	function clearMove() {
		setMoveSource(null);
		setHoveredSlot(null);
	}

	function commitPlan(nextPlan: SquadPlan) {
		setPlan(nextPlan);
		savePlan(data, nextPlan);
	}

	function attemptMove(source: PlanMoveSource, targetSlot: number) {
		const rejection = moveRejection(plan, source, targetSlot, data, playersById);
		setStatusWarning(rejection);
		if (!rejection) commitPlan(applyMove(plan, source, targetSlot));
		clearMove();
	}

	function pressSlot(slotIndex: number) {
		setStatusWarning(null);
		if (moveSource?.kind === "slot" && moveSource.slotIndex === slotIndex) clearMove();
		else if (moveSource) attemptMove(moveSource, slotIndex);
		else setMoveSource({ kind: "slot", slotIndex });
	}

	function pressPoolPlayer(playerId: number) {
		setStatusWarning(null);
		if (moveSource?.kind === "slot") attemptMove({ kind: "pool", playerId }, moveSource.slotIndex);
		else if (moveSource?.kind === "pool" && moveSource.playerId === playerId) clearMove();
		else setMoveSource({ kind: "pool", playerId });
	}

	function startDragging(source: PlanMoveSource) {
		setStatusWarning(null);
		setMoveSource(source);
	}

	function changePlan(nextPlan: SquadPlan) {
		commitPlan(nextPlan);
		setStatusWarning(null);
		clearMove();
	}

	const hoverRejection = hoveredSlot !== null ? (rejectionBySlot?.[hoveredSlot] ?? null) : null;
	const warningText = hoverRejection ?? statusWarning;

	// Nettleseren fyrer ikke drop på et ulovlig mål, så grunnen må tas vare på her.
	function finishDragging() {
		if (hoverRejection) setStatusWarning(hoverRejection);
		clearMove();
	}

	function moveHint() {
		if (!moveSource) return DEFAULT_HINT;
		if (moveSource.kind === "pool") {
			const incoming = requirePlayer(playersById, moveSource.playerId);
			return `Slipp ${incoming.name} på den ${incoming.position}-en du vil selge.`;
		}
		const selected = requirePlayer(playersById, plan.slotPlayerIds[moveSource.slotIndex]);
		return `${selected.name} er valgt. Velg en annen i troppen for å bytte plass, eller en i lista for å kjøpe inn.`;
	}

	function renderSlot(slotIndex: number) {
		const player = requirePlayer(playersById, plan.slotPlayerIds[slotIndex]);
		const isSelected = moveSource?.kind === "slot" && moveSource.slotIndex === slotIndex;
		const isStarter = slotIndex < STARTER_COUNT;
		const dropState = !rejectionBySlot || isSelected ? undefined : rejectionBySlot[slotIndex] ? "illegal" : "legal";

		return (
			<div
				key={player.id}
				className="kk-slot"
				data-drop={dropState}
				data-hovered={hoveredSlot === slotIndex}
				data-selected={isSelected}
				onDragOver={(event) => {
					if (!moveSource) return;
					event.preventDefault();
					event.dataTransfer.dropEffect = rejectionBySlot?.[slotIndex] ? "none" : "move";
					setHoveredSlot(slotIndex);
				}}
				onDragLeave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHoveredSlot(null);
				}}
				onDrop={(event) => {
					event.preventDefault();
					if (moveSource) attemptMove(moveSource, slotIndex);
				}}
			>
				<div
					className="kk-slot-card"
					draggable
					onDragStart={(event) => {
						prepareDragData(event, player.name);
						startDragging({ kind: "slot", slotIndex });
					}}
					onDragEnd={finishDragging}
					{...pressableProps(() => pressSlot(slotIndex), isSelected)}
				>
					<span className="kk-slot-kit">
						<PlayerShirt player={player} club={clubsById.get(player.teamId)!} />
						{plan.captainId === player.id ? <span className="kk-armband kk-armband--captain">C</span> : null}
						{plan.viceCaptainId === player.id ? <span className="kk-armband">V</span> : null}
					</span>
					<div className="kk-plate">
						<div className="kk-plate-head" title={player.fullName}>
							<span className="kk-plate-name">{player.name}</span>
							<span className="kk-plate-price">£{money(player.price)}</span>
						</div>
						<XpCells player={player} club={clubsById.get(player.teamId)!} />
					</div>
				</div>
				{isStarter ? (
					<div className="kk-slot-actions">
						<button
							type="button"
							title={`Gjør ${player.name} til kaptein`}
							onClick={() => changePlan(withCaptain(plan, player.id))}
						>
							C
						</button>
						<button
							type="button"
							title={`Gjør ${player.name} til visekaptein`}
							onClick={() => changePlan(withViceCaptain(plan, player.id))}
						>
							V
						</button>
					</div>
				) : null}
			</div>
		);
	}

	const starterSlots = plan.slotPlayerIds.slice(0, STARTER_COUNT).map((_, slotIndex) => slotIndex);
	const benchSlots = plan.slotPlayerIds.map((_, slotIndex) => slotIndex).slice(STARTER_COUNT);
	const positionOfSlot = (slotIndex: number) => requirePlayer(playersById, plan.slotPlayerIds[slotIndex]).position;

	const firstGameweek = data.gameweeks[0];
	const lastGameweek = data.gameweeks[data.gameweeks.length - 1];
	const nextDifference = netExpectedNextGameweek(summary) - netExpectedNextGameweek(startingSummary);
	const allDifference = netExpectedAllGameweeks(summary) - netExpectedAllGameweeks(startingSummary);

	return (
		<section className="kk-planner">
			<header className="kk-planner-head">
				<h2 className="kk-h2">{gameweekName}</h2>
				<p className="kk-note">Deadline: {deadlineLabel}</p>
			</header>

			<dl className="kk-stats">
				<div className="kk-stat">
					<dt>Forventet GW{firstGameweek}</dt>
					<dd>{xp(netExpectedNextGameweek(summary))}</dd>
					<small>{comparedToStarting(nextDifference, "med kapteinsbindet")}</small>
				</div>
				<div className="kk-stat">
					<dt>
						Forventet GW{firstGameweek}–{lastGameweek}
					</dt>
					<dd>{xp(netExpectedAllGameweeks(summary))}</dd>
					<small>{comparedToStarting(allDifference, "samme ellever og kaptein")}</small>
				</div>
				<div className="kk-stat">
					<dt>Lagverdi</dt>
					<dd>£{money(summary.squadValue)}m</dd>
					<small>£{money(summary.squadValue + summary.bank)}m med banken</small>
				</div>
				<div className="kk-stat">
					<dt>I banken</dt>
					<dd>£{money(summary.bank)}m</dd>
					{summary.bank < 0 ? (
						<small className="kk-delta-neg">over budsjett etter prisendringer</small>
					) : (
						<small>
							{summary.transfers.length
								? `${signed((summary.bank - data.bank) / 10)} etter byttene`
								: "ved forrige deadline"}
						</small>
					)}
				</div>
				<div className="kk-stat">
					<dt>Bytter brukt</dt>
					<dd>
						{summary.transfers.length}
						<span className="kk-stat-of">/{data.freeTransfers}</span>
					</dd>
					{summary.hitCost > 0 ? (
						<small className="kk-delta-neg">−{summary.hitCost} i poengtrekk, trukket fra over</small>
					) : (
						<small>{data.freeTransfersIsEstimate ? "estimert fra historikken" : "satt av deg"}</small>
					)}
				</div>
			</dl>

			<div className="kk-planner-grid">
				<div>
					<p className="kk-planner-status" data-warning={warningText !== null} aria-live="polite">
						{warningText ?? moveHint()}
					</p>

					<div className="kk-pitch">
						<PitchMarkings />
						{PITCH_ROW_POSITIONS.map((position) => (
							<div className="kk-pitch-row" key={position}>
								{starterSlots.filter((slotIndex) => positionOfSlot(slotIndex) === position).map(renderSlot)}
							</div>
						))}
					</div>

					<div className="kk-bench">
						{benchSlots.map((slotIndex) => (
							<div className="kk-bench-spot" key={slotIndex}>
								<span className="kk-pool-label">{positionOfSlot(slotIndex)}</span>
								{renderSlot(slotIndex)}
							</div>
						))}
					</div>

					<div className="kk-planner-actions">
						<button type="button" className="kk-button" onClick={() => changePlan(optimisedPlan(plan, playersById))}>
							Optimal ellever
						</button>
						<button type="button" className="kk-button kk-button--ghost" onClick={() => changePlan(startingPlan)}>
							Nullstill
						</button>
						<span className="kk-note">
							(H) hjemme · (B) borte · ! tvilsom eller ute
							<br />
							Planen lagres i denne nettleseren fram til deadline.
						</span>
					</div>

					{summary.transfers.length ? (
						<ul className="kk-list kk-planned-transfers">
							{summary.transfers.map((transfer) => (
								<li key={transfer.sold.id}>
									<span>
										<span className="kk-out">{transfer.sold.name}</span> → {transfer.bought.name}
									</span>
									<span className="kk-sub">{signed(transfer.cashDelta / 10)} i banken</span>
								</li>
							))}
						</ul>
					) : null}
				</div>

				<PlayerPool
					players={data.players}
					clubsById={clubsById}
					gameweeks={data.gameweeks}
					ownedPlayerIds={new Set(plan.slotPlayerIds)}
					affordableLimitByPosition={affordableLimitByPosition(plan, data, playersById)}
					selectedPlayerId={moveSource?.kind === "pool" ? moveSource.playerId : null}
					onPlayerPress={pressPoolPlayer}
					onPlayerDragStart={(playerId) => startDragging({ kind: "pool", playerId })}
					onPlayerDragEnd={finishDragging}
				/>
			</div>
		</section>
	);
}
