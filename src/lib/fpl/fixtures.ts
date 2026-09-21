import type { Bootstrap, BootstrapEvent, BootstrapTeam, Fixture } from "./types";

export type NormalizedFixture = {
	fixtureId: number;
	event: number;
	opponentId: number;
	opponentShort: string;
	isHome: boolean;
	difficulty: number;
	kickoff: string | null;
	/** Forventede mål for laget i denne kampen. */
	xGF: number;
	/** Forventede baklengsmål for laget i denne kampen. */
	xGA: number;
};

/** Én rad per lag per gameweek — tom liste = blank, to eller flere = double. */
export type TeamSchedule = Map<number, NormalizedFixture[][]>;

export type TeamStrength = {
	teamId: number;
	/** Forventede mål per kamp, nøytral bane. */
	attack: number;
	/** Forventede baklengsmål per kamp, nøytral bane. */
	defence: number;
	gamesPlayed: number;
};

export type FixtureContext = {
	/** Gameweeks i horisonten, i rekkefølge. */
	events: BootstrapEvent[];
	schedule: TeamSchedule;
	teamsById: Map<number, BootstrapTeam>;
	strength: Map<number, TeamStrength>;
	/** Antall ferdigspilte kamper per lag denne sesongen. */
	gamesPlayed: Map<number, number>;
	blanks: { event: number; teams: number[] }[];
	doubles: { event: number; teams: number[] }[];
};

/** Premier League scorer historisk rundt 1,45 mål per lag per kamp. */
const BASE_GOALS = 1.45;
const HOME_ATTACK = 1.1;
const AWAY_ATTACK = 0.9;
const HOME_DEFENCE = 0.92;
const AWAY_DEFENCE = 1.09;
/** Etter fire kamper teller sesongdata omtrent halvt. */
const STRENGTH_REGRESSION_GAMES = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * FPL sluttet å fylle ut `strength_attack_*` og `strength_defence_*` — feltene
 * ligger der, men står på null. Lagstyrken må derfor bygges fra data vi faktisk
 * har: summen av spillernes forventede mål gir lagets xG, og keepernes
 * `expected_goals_conceded` gir lagets xG mot. Begge regresseres mot ligasnittet
 * og mot FPL sin grove 1–5-rangering, som fortsatt er der.
 */
export function buildTeamStrength(bootstrap: Bootstrap, fixtures: Fixture[]): Map<number, TeamStrength> {
	const games = new Map<number, number>();
	const goalsFor = new Map<number, number>();
	const goalsAgainst = new Map<number, number>();

	for (const f of fixtures) {
		if (!f.finished || f.team_h_score === null || f.team_a_score === null) continue;
		for (const [team, scored, conceded] of [
			[f.team_h, f.team_h_score, f.team_a_score],
			[f.team_a, f.team_a_score, f.team_h_score],
		] as const) {
			games.set(team, (games.get(team) ?? 0) + 1);
			goalsFor.set(team, (goalsFor.get(team) ?? 0) + scored);
			goalsAgainst.set(team, (goalsAgainst.get(team) ?? 0) + conceded);
		}
	}

	const teamXg = new Map<number, number>();
	const keeperXgc = new Map<number, number>();
	const keeperMinutes = new Map<number, number>();
	for (const el of bootstrap.elements) {
		const xg = parseFloat(String(el.expected_goals ?? 0)) || 0;
		teamXg.set(el.team, (teamXg.get(el.team) ?? 0) + xg);
		if (el.element_type === 1) {
			const xgc = parseFloat(String(el.expected_goals_conceded ?? 0)) || 0;
			keeperXgc.set(el.team, (keeperXgc.get(el.team) ?? 0) + xgc);
			keeperMinutes.set(el.team, (keeperMinutes.get(el.team) ?? 0) + el.minutes);
		}
	}

	// FPL sin 1–5-rangering brukes som prior mens sesongen er ung.
	const ratings = bootstrap.teams.map((t) => (t.strength_overall_home + t.strength_overall_away) / 2);
	const ratingAvg = ratings.reduce((a, b) => a + b, 0) / Math.max(ratings.length, 1);

	const out = new Map<number, TeamStrength>();
	for (const team of bootstrap.teams) {
		const gp = games.get(team.id) ?? 0;
		const rating = (team.strength_overall_home + team.strength_overall_away) / 2;
		const ratingTilt = ratingAvg > 0 ? clamp(1 + (rating - ratingAvg) * 0.14, 0.7, 1.4) : 1;
		const priorAttack = BASE_GOALS * ratingTilt;
		const priorDefence = BASE_GOALS / ratingTilt;

		let observedAttack = priorAttack;
		let observedDefence = priorDefence;
		if (gp > 0) {
			const xgPerGame = (teamXg.get(team.id) ?? 0) / gp;
			const gkNineties = (keeperMinutes.get(team.id) ?? 0) / 90;
			const xgcPerGame = gkNineties > 0.5 ? (keeperXgc.get(team.id) ?? 0) / gkNineties : null;
			// Faktiske mål blandes lett inn — xG alene undervurderer lag som
			// konsekvent overpresterer, og overvurderer de som ikke setter dem.
			observedAttack = 0.75 * (xgPerGame || BASE_GOALS) + 0.25 * ((goalsFor.get(team.id) ?? 0) / gp);
			observedDefence =
				0.75 * (xgcPerGame ?? BASE_GOALS) + 0.25 * ((goalsAgainst.get(team.id) ?? 0) / gp);
		}

		const w = gp / (gp + STRENGTH_REGRESSION_GAMES);
		out.set(team.id, {
			teamId: team.id,
			attack: clamp(w * observedAttack + (1 - w) * priorAttack, 0.55, 3),
			defence: clamp(w * observedDefence + (1 - w) * priorDefence, 0.55, 3),
			gamesPlayed: gp,
		});
	}

	// Normaliser slik at ligasnittet lander på BASE_GOALS.
	const avgAttack = [...out.values()].reduce((a, s) => a + s.attack, 0) / Math.max(out.size, 1);
	const avgDefence = [...out.values()].reduce((a, s) => a + s.defence, 0) / Math.max(out.size, 1);
	for (const s of out.values()) {
		s.attack *= BASE_GOALS / (avgAttack || BASE_GOALS);
		s.defence *= BASE_GOALS / (avgDefence || BASE_GOALS);
	}
	return out;
}

/** Forventede mål begge veier i én bestemt kamp. */
export function expectedGoalsFor(
	strength: Map<number, TeamStrength>,
	teamId: number,
	opponentId: number,
	isHome: boolean,
	difficulty: number,
): { xGF: number; xGA: number } {
	const team = strength.get(teamId);
	const opponent = strength.get(opponentId);
	if (!team || !opponent) return { xGF: BASE_GOALS, xGA: BASE_GOALS };

	let xGF = ((team.attack * opponent.defence) / BASE_GOALS) * (isHome ? HOME_ATTACK : AWAY_ATTACK);
	let xGA = ((opponent.attack * team.defence) / BASE_GOALS) * (isHome ? HOME_DEFENCE : AWAY_DEFENCE);

	// FPL sin egen vanskelighetsgrad (1–5) fanger opp ting tallene våre ikke gjør
	// — skader i motstanderlaget, europacup midt i uka. Den får justere lett.
	const fdrTilt = 1 + (difficulty - 3) * 0.05;
	xGF /= fdrTilt;
	xGA *= fdrTilt;

	return { xGF: clamp(xGF, 0.25, 4), xGA: clamp(xGA, 0.25, 4) };
}

/** Gameweeks framover, fra og med `startEvent`, maks `horizon` stykker. */
export function horizonEvents(bootstrap: Bootstrap, startEvent: number, horizon: number): BootstrapEvent[] {
	return bootstrap.events.filter((e) => e.id >= startEvent).slice(0, horizon);
}

export function buildFixtureContext(
	bootstrap: Bootstrap,
	fixtures: Fixture[],
	startEvent: number,
	horizon: number,
): FixtureContext {
	const teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
	const events = horizonEvents(bootstrap, startEvent, horizon);
	const eventIds = events.map((e) => e.id);
	const strength = buildTeamStrength(bootstrap, fixtures);

	const gamesPlayed = new Map<number, number>();
	for (const f of fixtures) {
		if (!f.finished) continue;
		gamesPlayed.set(f.team_h, (gamesPlayed.get(f.team_h) ?? 0) + 1);
		gamesPlayed.set(f.team_a, (gamesPlayed.get(f.team_a) ?? 0) + 1);
	}

	const schedule: TeamSchedule = new Map();
	for (const team of bootstrap.teams) {
		schedule.set(
			team.id,
			eventIds.map(() => []),
		);
	}

	for (const f of fixtures) {
		if (f.event === null) continue; // utsatt kamp uten ny dato
		const slot = eventIds.indexOf(f.event);
		if (slot === -1) continue;

		for (const isHome of [true, false]) {
			const teamId = isHome ? f.team_h : f.team_a;
			const opponentId = isHome ? f.team_a : f.team_h;
			const opponent = teamsById.get(opponentId);
			if (!teamsById.has(teamId) || !opponent) continue;
			const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
			const { xGF, xGA } = expectedGoalsFor(strength, teamId, opponentId, isHome, difficulty);
			schedule.get(teamId)?.[slot].push({
				fixtureId: f.id,
				event: f.event,
				opponentId,
				opponentShort: opponent.short_name,
				isHome,
				difficulty,
				kickoff: f.kickoff_time,
				xGF,
				xGA,
			});
		}
	}

	const blanks: FixtureContext["blanks"] = [];
	const doubles: FixtureContext["doubles"] = [];
	eventIds.forEach((eventId, slot) => {
		const blankTeams: number[] = [];
		const doubleTeams: number[] = [];
		for (const [teamId, rows] of schedule) {
			const n = rows[slot].length;
			if (n === 0) blankTeams.push(teamId);
			if (n > 1) doubleTeams.push(teamId);
		}
		if (blankTeams.length) blanks.push({ event: eventId, teams: blankTeams });
		if (doubleTeams.length) doubles.push({ event: eventId, teams: doubleTeams });
	});

	return { events, schedule, teamsById, strength, gamesPlayed, blanks, doubles };
}

/** Gjennomsnittlig FDR over horisonten — brukes til å rangere kampprogram. */
export function averageDifficulty(ctx: FixtureContext, teamId: number): number | null {
	const rows = ctx.schedule.get(teamId);
	if (!rows) return null;
	const all = rows.flat();
	if (!all.length) return null;
	return all.reduce((a, f) => a + f.difficulty, 0) / all.length;
}
