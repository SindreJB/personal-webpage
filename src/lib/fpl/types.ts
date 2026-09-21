/**
 * Typer for det offisielle (uoffisielt dokumenterte) FPL-API-et.
 * Kun feltene krystallkulen faktisk bruker er typet — API-et returnerer mer.
 */

export type ElementStatus = "a" | "d" | "i" | "s" | "u" | "n";

export type PriceChangeProjection = {
	/** Antall døgn fram i tid, 0 = i natt. */
	offset: number;
	projected_percent: string;
	/** −5 … 5. Negativt = fall, positivt = stigning, tallet er styrken. */
	likelihood: number;
};

export type ScoutRisk = {
	property: string;
	notes: string;
	gameweek: number | null;
	url: string | null;
};

export type BootstrapElement = {
	id: number;
	code: number;
	web_name: string;
	first_name: string;
	second_name: string;
	team: number;
	team_code: number;
	element_type: number;
	now_cost: number;
	cost_change_start: number;
	cost_change_event: number;
	status: ElementStatus;
	news: string;
	news_added: string | null;
	chance_of_playing_this_round: number | null;
	chance_of_playing_next_round: number | null;
	minutes: number;
	starts: number;
	total_points: number;
	event_points: number;
	points_per_game: string;
	form: string;
	ep_this: string | null;
	ep_next: string | null;
	goals_scored: number;
	assists: number;
	clean_sheets: number;
	goals_conceded: number;
	saves: number;
	bonus: number;
	bps: number;
	yellow_cards: number;
	red_cards: number;
	penalties_order: number | null;
	direct_freekicks_order: number | null;
	corners_and_indirect_freekicks_order: number | null;
	expected_goals: string;
	expected_assists: string;
	expected_goals_conceded: string;
	expected_goals_per_90: number;
	expected_assists_per_90: number;
	expected_goals_conceded_per_90: number;
	saves_per_90: number;
	defensive_contribution: number;
	defensive_contribution_per_90: number;
	starts_per_90: number;
	selected_by_percent: string;
	transfers_in_event: number;
	transfers_out_event: number;
	price_change_percent: string;
	price_change_projections: PriceChangeProjection[];
	price_change_locked_until: string | null;
	price_change_calibrating: boolean;
	scout_risks: ScoutRisk[];
	scout_news_link: string;
	removed: boolean;
	can_select: boolean;
};

export type BootstrapTeam = {
	id: number;
	name: string;
	short_name: string;
	code: number;
	/** Ikke lenger fylt ut av FPL — kan være null. */
	strength: number | null;
	/** Alle fire står på 0 i inneværende sesong. Se `buildTeamStrength`. */
	strength_attack_home: number;
	strength_attack_away: number;
	strength_defence_home: number;
	strength_defence_away: number;
	strength_overall_home: number;
	strength_overall_away: number;
};

export type BootstrapEvent = {
	id: number;
	name: string;
	deadline_time: string;
	deadline_time_epoch: number;
	finished: boolean;
	data_checked: boolean;
	is_previous: boolean;
	is_current: boolean;
	is_next: boolean;
	average_entry_score: number;
	highest_score: number | null;
	most_captained: number | null;
	chip_plays: { chip_name: string; num_played: number }[];
};

export type ElementType = {
	id: number;
	singular_name_short: "GKP" | "DEF" | "MID" | "FWD";
	plural_name: string;
	squad_select: number;
	squad_min_play: number;
	squad_max_play: number;
};

export type ScoringConfig = {
	long_play: number;
	short_play: number;
	assists: number;
	bonus: number;
	saves: number;
	yellow_cards: number;
	red_cards: number;
	own_goals: number;
	penalties_missed: number;
	penalties_saved: number;
	goals_scored: Record<string, number>;
	clean_sheets: Record<string, number>;
	goals_conceded: Record<string, number>;
	defensive_contribution: Record<string, number>;
};

export type ChipDefinition = {
	id: number;
	name: string;
	number: number;
	start_event: number;
	stop_event: number;
	chip_type: string;
};

export type Bootstrap = {
	chips: ChipDefinition[];
	events: BootstrapEvent[];
	teams: BootstrapTeam[];
	elements: BootstrapElement[];
	element_types: ElementType[];
	total_players: number;
	game_config: { scoring: ScoringConfig; settings?: Record<string, unknown> };
	game_settings: {
		squad_squadsize: number;
		squad_squadplay: number;
		squad_team_limit: number;
		squad_total_spend: number;
		transfers_sell_on_fee: number;
		max_extra_free_transfers: number;
	};
};

export type Fixture = {
	id: number;
	code: number;
	event: number | null;
	kickoff_time: string | null;
	finished: boolean;
	started: boolean;
	minutes: number;
	provisional_start_time: boolean;
	team_h: number;
	team_a: number;
	team_h_score: number | null;
	team_a_score: number | null;
	team_h_difficulty: number;
	team_a_difficulty: number;
};

export type EntrySummary = {
	id: number;
	name: string;
	player_first_name: string;
	player_last_name: string;
	started_event: number;
	current_event: number | null;
	summary_overall_points: number;
	summary_overall_rank: number | null;
	summary_event_points: number;
	summary_event_rank: number | null;
	last_deadline_bank: number | null;
	last_deadline_value: number | null;
	last_deadline_total_transfers: number | null;
};

export type EntryPick = {
	element: number;
	position: number;
	multiplier: number;
	is_captain: boolean;
	is_vice_captain: boolean;
	element_type: number;
};

export type EntryHistoryRow = {
	event: number;
	points: number;
	total_points: number;
	rank: number | null;
	overall_rank: number | null;
	bank: number;
	value: number;
	event_transfers: number;
	event_transfers_cost: number;
	points_on_bench: number;
};

export type EntryPicks = {
	active_chip: string | null;
	automatic_subs: { element_in: number; element_out: number; event: number }[];
	entry_history: EntryHistoryRow;
	picks: EntryPick[];
};

export type EntryHistory = {
	current: EntryHistoryRow[];
	past: { season_name: string; total_points: number; rank: number }[];
	chips: { name: string; event: number; time: string }[];
};

export type EntryTransfer = {
	element_in: number;
	element_in_cost: number;
	element_out: number;
	element_out_cost: number;
	entry: number;
	event: number;
	time: string;
};

export type LiveElement = {
	id: number;
	stats: {
		minutes: number;
		goals_scored: number;
		assists: number;
		clean_sheets: number;
		goals_conceded: number;
		saves: number;
		bonus: number;
		bps: number;
		yellow_cards: number;
		red_cards: number;
		defensive_contribution: number;
		starts: number;
		total_points: number;
	};
};

export type EventLive = { elements: LiveElement[] };

export type ElementSummary = {
	history: {
		round: number;
		minutes: number;
		starts: number;
		total_points: number;
		was_home: boolean;
		opponent_team: number;
		kickoff_time: string;
		bonus: number;
	}[];
};
