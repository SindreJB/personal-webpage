import type { DragEvent, KeyboardEvent } from "react";
import { xp } from "@/lib/fpl/format";
import { shirtUrl, xpHeatLevel, type PlannerClub, type PlannerPlayer } from "@/lib/fpl/planner";

/** Klubbens drakt, eller keeperdrakten for keepere, med varsel hvis spilleren er tvilsom. */
export function PlayerShirt({ player, club }: { player: PlannerPlayer; club: PlannerClub }) {
	return (
		<span className="kk-kit">
			{/* Vanlig img: FPL serverer allerede små webp-filer, og next/image ville bare brukt opp optimeringskvoten. */}
			<img
				className="kk-shirt"
				src={shirtUrl(club.code, player.position)}
				alt={`Drakt, ${club.short}`}
				draggable={false}
				loading="lazy"
				referrerPolicy="no-referrer"
			/>
			{player.status !== "a" ? (
				<span
					className={`kk-status-flag kk-status-flag--${player.status === "d" ? "doubt" : "out"}`}
					title={player.news || `${Math.round(player.availabilityNext * 100)} % sjanse for å spille`}
				>
					!
				</span>
			) : null}
		</span>
	);
}

/** Forventede poeng og motstander, én celle per runde. Tom rad = blank, to rader = double. */
export function XpCells({ player, club }: { player: PlannerPlayer; club: PlannerClub }) {
	return (
		<div className="kk-xp-cells">
			{player.xp.map((expectedPoints, gameweekSlot) => {
				const fixtures = club.fixtures[gameweekSlot] ?? [];
				return (
					<div key={gameweekSlot} className={`kk-xp kk-xp-${xpHeatLevel(expectedPoints)}`}>
						<strong>{xp(expectedPoints)}</strong>
						{fixtures.length ? (
							fixtures.map((fixture) => (
								<small
									key={`${fixture.opponentShort}-${fixture.isHome}`}
									title={`${fixture.isHome ? "Hjemme mot" : "Borte mot"} ${fixture.opponentShort}`}
								>
									{fixture.opponentShort} ({fixture.isHome ? "H" : "B"})
								</small>
							))
						) : (
							<small>blank</small>
						)}
					</div>
				);
			})}
		</div>
	);
}

/**
 * Dra og slipp finnes ikke på berøringsskjerm, så alt som kan dras kan også
 * trykkes på: først det du vil flytte, så dit det skal.
 */
export function pressableProps(onPress: () => void, isPressed: boolean) {
	return {
		role: "button",
		tabIndex: 0,
		"aria-pressed": isPressed,
		onClick: onPress,
		onKeyDown: (event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			onPress();
		},
	};
}

export function prepareDragData(event: DragEvent<HTMLElement>, playerName: string) {
	// Firefox starter ikke en dra-operasjon uten data.
	event.dataTransfer.setData("text/plain", playerName);
	event.dataTransfer.effectAllowed = "move";
	const shirt = event.currentTarget.querySelector("img");
	if (shirt) event.dataTransfer.setDragImage(shirt, shirt.naturalWidth / 2, shirt.naturalHeight / 2);
}
