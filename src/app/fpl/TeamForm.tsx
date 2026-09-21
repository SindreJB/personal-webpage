"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Laget hentes fra URL-en, ikke fra en database. Det holder /fpl statsløs og
 * lar hvem som helst analysere sitt eget lag uten innlogging.
 */
export default function TeamForm({ initialTeam, initialFreeTransfers }: { initialTeam: string; initialFreeTransfers: string }) {
	const router = useRouter();
	const params = useSearchParams();
	const [team, setTeam] = useState(initialTeam);
	const [freeTransfers, setFreeTransfers] = useState(initialFreeTransfers);
	const [pending, startTransition] = useTransition();

	function submit(e: React.FormEvent) {
		e.preventDefault();
		const next = new URLSearchParams(params.toString());
		if (team.trim()) next.set("lag", team.trim());
		else next.delete("lag");
		if (freeTransfers) next.set("ft", freeTransfers);
		else next.delete("ft");
		startTransition(() => router.push(`/fpl?${next.toString()}`));
	}

	return (
		<form className="kk-form" onSubmit={submit}>
			<div className="kk-field">
				<label htmlFor="kk-team">Lag-ID eller FPL-lenke</label>
				<input
					id="kk-team"
					className="kk-input kk-input--wide"
					value={team}
					onChange={(e) => setTeam(e.target.value)}
					placeholder="5991938 eller https://fantasy.premierleague.com/entry/5991938/event/4"
					inputMode="text"
					autoComplete="off"
				/>
			</div>
			<div className="kk-field">
				<label htmlFor="kk-ft">Gratis bytter</label>
				<select id="kk-ft" className="kk-select" value={freeTransfers} onChange={(e) => setFreeTransfers(e.target.value)}>
					<option value="">Beregn selv</option>
					{[1, 2, 3, 4, 5].map((n) => (
						<option key={n} value={String(n)}>
							{n}
						</option>
					))}
				</select>
			</div>
			<button className="kk-button" type="submit" disabled={pending}>
				{pending ? "Ser i kulen …" : "Se i kulen"}
			</button>
		</form>
	);
}
