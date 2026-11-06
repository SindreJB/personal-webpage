"use client";

import { useState } from "react";
import { money, xp } from "@/lib/fpl/format";
import type { PlannerClub, PlannerPlayer } from "@/lib/fpl/planner";
import type { PositionShort } from "@/lib/fpl/projection";
import { PlayerShirt, XpCells, prepareDragData, pressableProps } from "./PlannerParts";

/** Lista er et verktøy for å finne en spiller, ikke en database. Søk og filter gjør resten. */
const POOL_ROW_LIMIT = 60;

const POSITION_FILTERS: { value: PositionShort | "ALL"; label: string }[] = [
	{ value: "ALL", label: "Alle" },
	{ value: "GKP", label: "GKP" },
	{ value: "DEF", label: "DEF" },
	{ value: "MID", label: "MID" },
	{ value: "FWD", label: "FWD" },
];

type SortKey = "xpAllGameweeks" | "xpNextGameweek" | "price" | "ownership";

const SORT_VALUE: Record<SortKey, (player: PlannerPlayer) => number> = {
	xpAllGameweeks: (player) => sumExpectedPoints(player),
	xpNextGameweek: (player) => player.xp[0] ?? 0,
	price: (player) => player.price,
	ownership: (player) => player.selectedBy,
};

function sumExpectedPoints(player: PlannerPlayer) {
	return player.xp.reduce((sum, expectedPoints) => sum + expectedPoints, 0);
}

function normaliseForSearch(text: string) {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase();
}

export default function PlayerPool({
	players,
	clubsById,
	gameweeks,
	ownedPlayerIds,
	affordableLimitByPosition,
	selectedPlayerId,
	onPlayerPress,
	onPlayerDragStart,
	onPlayerDragEnd,
}: {
	players: PlannerPlayer[];
	clubsById: Map<number, PlannerClub>;
	gameweeks: number[];
	ownedPlayerIds: Set<number>;
	affordableLimitByPosition: Record<PositionShort, number>;
	selectedPlayerId: number | null;
	onPlayerPress: (playerId: number) => void;
	onPlayerDragStart: (playerId: number) => void;
	onPlayerDragEnd: () => void;
}) {
	const highestPrice = Math.max(...players.map((player) => player.price));
	const [positionFilter, setPositionFilter] = useState<PositionShort | "ALL">("ALL");
	const [sortKey, setSortKey] = useState<SortKey>("xpAllGameweeks");
	const [maxPrice, setMaxPrice] = useState(highestPrice);
	const [searchText, setSearchText] = useState("");
	const [affordableOnly, setAffordableOnly] = useState(false);

	const firstGameweek = gameweeks[0];
	const lastGameweek = gameweeks[gameweeks.length - 1];
	const normalisedSearch = normaliseForSearch(searchText.trim());

	const matchingPlayers = players
		.filter((player) => positionFilter === "ALL" || player.position === positionFilter)
		.filter((player) => player.price <= maxPrice)
		.filter((player) => !affordableOnly || player.price <= affordableLimitByPosition[player.position])
		.filter((player) => {
			if (!normalisedSearch) return true;
			const club = clubsById.get(player.teamId)!;
			return normaliseForSearch(`${player.name} ${player.fullName} ${club.name} ${club.short}`).includes(normalisedSearch);
		})
		.sort((a, b) => SORT_VALUE[sortKey](b) - SORT_VALUE[sortKey](a));

	return (
		<aside className="kk-pool">
			<h3 className="kk-h2">Spillere</h3>

			<div className="kk-pool-filters">
				<div className="kk-field">
					<span className="kk-pool-label">Posisjon</span>
					<div className="kk-tabs kk-tabs--flush">
						{POSITION_FILTERS.map((filter) => (
							<button
								key={filter.value}
								type="button"
								className="kk-tab"
								data-active={positionFilter === filter.value}
								onClick={() => setPositionFilter(filter.value)}
							>
								{filter.label}
							</button>
						))}
					</div>
				</div>

				<div className="kk-field">
					<label htmlFor="kk-pool-sort">Sorter etter</label>
					<select
						id="kk-pool-sort"
						className="kk-select"
						value={sortKey}
						onChange={(event) => setSortKey(event.target.value as SortKey)}
					>
						<option value="xpAllGameweeks">
							Forventede poeng, GW{firstGameweek}–{lastGameweek}
						</option>
						<option value="xpNextGameweek">Forventede poeng, GW{firstGameweek}</option>
						<option value="price">Pris</option>
						<option value="ownership">Eierandel</option>
					</select>
				</div>

				<div className="kk-field">
					<label htmlFor="kk-pool-price">Makspris: £{money(maxPrice)}m</label>
					<input
						id="kk-pool-price"
						className="kk-range"
						type="range"
						min={Math.min(...players.map((player) => player.price))}
						max={highestPrice}
						value={maxPrice}
						onChange={(event) => setMaxPrice(Number(event.target.value))}
					/>
				</div>

				<div className="kk-field">
					<label htmlFor="kk-pool-search">Søk</label>
					<input
						id="kk-pool-search"
						className="kk-input"
						value={searchText}
						onChange={(event) => setSearchText(event.target.value)}
						placeholder="Spiller eller klubb"
						autoComplete="off"
					/>
				</div>

				<label className="kk-check">
					<input type="checkbox" checked={affordableOnly} onChange={(event) => setAffordableOnly(event.target.checked)} />
					Bare de jeg har råd til
				</label>
			</div>

			<div className="kk-pool-list">
				<div className="kk-pool-row kk-pool-row--head" aria-hidden="true">
					<span />
					<span>Spiller</span>
					<span className="kk-num">Pris</span>
					<span>
						GW {firstGameweek}–{lastGameweek}
					</span>
					<span className="kk-num">Sum</span>
				</div>
				{matchingPlayers.slice(0, POOL_ROW_LIMIT).map((player) => {
					const club = clubsById.get(player.teamId)!;
					const isOwned = ownedPlayerIds.has(player.id);
					const interactionProps = isOwned
						? {}
						: {
								...pressableProps(() => onPlayerPress(player.id), selectedPlayerId === player.id),
								draggable: true,
								onDragStart: (event: React.DragEvent<HTMLElement>) => {
									prepareDragData(event, player.name);
									onPlayerDragStart(player.id);
								},
								onDragEnd: onPlayerDragEnd,
							};
					return (
						<div
							key={player.id}
							className="kk-pool-row"
							data-owned={isOwned}
							data-selected={selectedPlayerId === player.id}
							{...interactionProps}
						>
							<PlayerShirt player={player} club={club} />
							<span className="kk-pool-name">
								<span className="kk-player">{player.name}</span>
								<span className="kk-sub">
									{club.short} · {player.position}
									{isOwned ? " · eies" : ""}
								</span>
							</span>
							<span className="kk-num">{money(player.price)}</span>
							<XpCells player={player} club={club} />
							<strong className="kk-num">{xp(sumExpectedPoints(player))}</strong>
						</div>
					);
				})}
				{matchingPlayers.length === 0 ? <p className="kk-note">Ingen spillere passer filtrene.</p> : null}
			</div>

			{matchingPlayers.length > POOL_ROW_LIMIT ? (
				<p className="kk-note kk-pool-more">
					Viser {POOL_ROW_LIMIT} av {matchingPlayers.length}. Søk eller filtrer for å se resten.
				</p>
			) : null}
		</aside>
	);
}
