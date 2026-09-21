/** Formatering. Norsk tallformat, og tall som ikke later som de er sikrere enn de er. */

const nb = (digits: number) =>
	new Intl.NumberFormat("nb-NO", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** FPL oppgir priser i tideler: 105 betyr 10,5 millioner. */
export function money(tenths: number): string {
	return `${nb(1).format(tenths / 10)}`;
}

export function xp(value: number, digits = 1): string {
	return nb(digits).format(value);
}

export function signed(value: number, digits = 1): string {
	if (Math.abs(value) < 0.05) return nb(digits).format(0);
	return `${value > 0 ? "+" : "−"}${nb(digits).format(Math.abs(value))}`;
}

export function percent(fraction: number): string {
	return `${Math.round(fraction * 100)} %`;
}

export function rank(value: number | null | undefined): string {
	if (value == null) return "—";
	return new Intl.NumberFormat("nb-NO").format(value);
}

/** «om 2 dager», «om 5 timer», «for 3 timer siden». */
export function relativeDeadline(iso: string, now = Date.now()): string {
	const diffMs = Date.parse(iso) - now;
	const hours = diffMs / 3_600_000;
	const rtf = new Intl.RelativeTimeFormat("nb-NO", { numeric: "auto" });
	if (Math.abs(hours) >= 48) return rtf.format(Math.round(hours / 24), "day");
	if (Math.abs(hours) >= 1) return rtf.format(Math.round(hours), "hour");
	return rtf.format(Math.round(diffMs / 60_000), "minute");
}

export function deadlineStamp(iso: string): string {
	return new Intl.DateTimeFormat("nb-NO", {
		weekday: "long",
		day: "numeric",
		month: "long",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Oslo",
	}).format(new Date(iso));
}

export function timestamp(iso: string): string {
	return new Intl.DateTimeFormat("nb-NO", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Oslo",
	}).format(new Date(iso));
}

export const ALERT_LABEL: Record<"high" | "medium" | "low", string> = {
	high: "Viktig",
	medium: "Følg med",
	low: "Notert",
};

const CHIP_NAMES: Record<string, string> = {
	wildcard: "Wildcard",
	freehit: "Free Hit",
	bboost: "Bench Boost",
	"3xc": "Triple Captain",
	manager: "Assistant Manager",
};

export function chipLabel(name: string): string {
	return CHIP_NAMES[name] ?? name;
}
