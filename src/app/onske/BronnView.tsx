"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { WishView } from "@/lib/onske";
import {
	addWish,
	cancelReservation,
	ownerLogin,
	ownerLogout,
	removeWish,
	reserveWish,
} from "./actions";

const CATEGORIES = ["alle", "books", "tech", "home", "clothing", "beauty", "games", "food", "outdoor", "other"];
const STATUS = ["alle", "ledige", "reservert"] as const;
const SORTS = ["nyeste", "pris opp", "pris ned"] as const;

type Status = (typeof STATUS)[number];
type Sort = (typeof SORTS)[number];

function formatPrice(amount: number | null, currency: string | null) {
	if (amount == null) return "—";
	const cur = currency || "NOK";
	try {
		return new Intl.NumberFormat("nb-NO", { style: "currency", currency: cur }).format(amount);
	} catch {
		return `${amount} ${cur}`;
	}
}

export default function BronnView({ wishes, owner }: { wishes: WishView[]; owner: boolean }) {
	const [category, setCategory] = useState("alle");
	const [status, setStatus] = useState<Status>("alle");
	const [sort, setSort] = useState<Sort>("nyeste");
	const [query, setQuery] = useState("");
	const [maxPrice, setMaxPrice] = useState<number | "">("");

	const filtered = useMemo(() => {
		let r = wishes;
		if (category !== "alle") r = r.filter((i) => i.category === category);
		const taken = (i: WishView) => !!(i.reserved || i.reserved_by);
		if (status === "ledige") r = r.filter((i) => !taken(i));
		if (status === "reservert") r = r.filter(taken);
		if (query.trim()) {
			const q = query.toLowerCase();
			r = r.filter(
				(i) =>
					i.title.toLowerCase().includes(q) ||
					(i.vendor || "").toLowerCase().includes(q) ||
					(i.note || "").toLowerCase().includes(q),
			);
		}
		if (typeof maxPrice === "number") {
			r = r.filter((i) => (i.price_amount ?? Infinity) <= maxPrice);
		}
		if (sort === "pris opp") r = [...r].sort((a, b) => (a.price_amount ?? Infinity) - (b.price_amount ?? Infinity));
		if (sort === "pris ned") r = [...r].sort((a, b) => (b.price_amount ?? -Infinity) - (a.price_amount ?? -Infinity));
		return r;
	}, [wishes, category, status, query, sort, maxPrice]);

	const stats = useMemo(() => {
		const total = wishes.length;
		const taken = wishes.filter((i) => i.reserved || i.reserved_by).length;
		return { total, taken, free: total - taken };
	}, [wishes]);

	return (
		<main className="brønn">
			<header className="brønn-masthead">
				<p className="brønn-kicker">
					<Link href="/">sindrejentoftboe.no</Link> · kast en mynt
				</p>
				<h1 className="brønn-title">Ønskebrønnen</h1>
				<p className="brønn-lede">
					{owner
						? "Dette er brønnen din. Du ser hvilke ønsker som er reservert — men aldri av hvem. Det er hele poenget."
						: "Legg merke til: eieren kan ikke se hvem som har reservert. Kast mynten din ved å skrive navnet ditt — det er hele registreringen."}
				</p>
				<div className="brønn-stats">
					<span>{stats.total} ønsker</span>
					<span>{stats.free} ledige</span>
					<span>{stats.taken} reservert</span>
				</div>
				{owner ? <OwnerBar /> : <GiverHint />}
			</header>

			{owner && <AddForm />}

			<div className="brønn-filters">
				<label>
					<span>søk</span>
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="tittel, merke…"
					/>
				</label>
				<label>
					<span>kategori</span>
					<select value={category} onChange={(e) => setCategory(e.target.value)}>
						{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
					</select>
				</label>
				<label>
					<span>status</span>
					<select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
						{STATUS.map((s) => <option key={s}>{s}</option>)}
					</select>
				</label>
				<label>
					<span>maks pris</span>
					<input
						type="number"
						min={0}
						value={maxPrice}
						onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
						placeholder="∞"
					/>
				</label>
				<label>
					<span>sorter</span>
					<select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
						{SORTS.map((s) => <option key={s}>{s}</option>)}
					</select>
				</label>
			</div>

			{filtered.length === 0 ? (
				<p className="brønn-empty">
					Bønnen er tom. {owner ? "Legg inn noe med skjemaet over." : "Kom tilbende senere!"} <span className="blink">_</span>
				</p>
			) : (
				<section className="brønn-grid" aria-label="Ønsker">
					{filtered.map((it) => <WishCard key={it.id} item={it} owner={owner} />)}
				</section>
			)}

			<footer className="brønn-footer">
				<p>
					Ingen reklame. Ingen sporere. Ingen cookies — bortsett fra én til eieren av brønnen.
					Åpen kildekode, som resten av siden.
				</p>
			</footer>
		</main>
	);
}

/* ------------------------------ eier ------------------------------- */

function OwnerBar() {
	const [pending, start] = useTransition();
	return (
		<div className="brønn-ownerbar">
			<span>du er eieren ✦</span>
			<button onClick={() => start(async () => { await ownerLogout(); })} disabled={pending}>
				{pending ? "…" : "logg ut"}
			</button>
		</div>
	);
}

function AddForm() {
	const [open, setOpen] = useState(false);
	const [pending, start] = useTransition();
	const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

	function submit(formData: FormData) {
		setMsg(null);
		start(async () => {
			const res = await addWish(formData);
			if (res?.error) setMsg({ type: "err", text: res.error });
			else {
				setMsg({ type: "ok", text: "ønsket ligger i brønnen" });
				(document.getElementById("add-wish-form") as HTMLFormElement)?.reset();
			}
		});
	}

	return (
		<section className="brønn-add">
			<button className="brønn-add-toggle" onClick={() => setOpen((o) => !o)}>
				<span>＋ nytt ønske</span>
				<span>{open ? "▴" : "▾"}</span>
			</button>
			{open && (
				<form id="add-wish-form" action={submit} className="brønn-add-form">
					<label>
						<span>lenke til produktet</span>
						<input name="url" required placeholder="https://…" />
					</label>
					<div className="brønn-add-row">
						<label>
							<span>kategori (valgfritt)</span>
							<select name="category" defaultValue="">
								<option value="">— auto —</option>
								{CATEGORIES.filter((c) => c !== "alle").map((c) => <option key={c}>{c}</option>)}
							</select>
						</label>
						<label>
							<span>notat (valgfritt)</span>
							<input name="note" placeholder="f.eks. størrelse 42" />
						</label>
					</div>
					<button disabled={pending} className="brønn-add-submit">
						{pending ? "henter fra nettsiden…" : "kast ønsket i brønnen"}
					</button>
					{msg && <p className={`brønn-msg ${msg.type}`}>{msg.text}</p>}
				</form>
			)}
		</section>
	);
}

/* ------------------------------ giver ------------------------------ */

function GiverHint() {
	return (
		<p className="brønn-giverhint">
			Er det deg som eier brønnen? <OwnerLoginLink />
		</p>
	);
}

function OwnerLoginLink() {
	const [open, setOpen] = useState(false);
	const [pending, start] = useTransition();
	const [msg, setMsg] = useState<string | null>(null);

	function submit(formData: FormData) {
		setMsg(null);
		start(async () => {
			const res = await ownerLogin(formData);
			if (res?.error) setMsg(res.error);
		});
	}

	if (!open) {
		return (
			<button className="brønn-linklike" onClick={() => setOpen(true)}>
				Logg inn her
			</button>
		);
	}
	return (
		<form action={submit} className="brønn-login">
			<input name="owner_key" type="password" placeholder="eiernøkkel" autoFocus />
			<button disabled={pending}>{pending ? "…" : "åpne brønnen"}</button>
			{msg && <span className="brønn-msg err">{msg}</span>}
		</form>
	);
}

/* ------------------------------ kort ------------------------------- */

function WishCard({ item, owner }: { item: WishView; owner: boolean }) {
	const taken = !!(item.reserved || item.reserved_by);
	const [showReserve, setShowReserve] = useState(false);
	const [name, setName] = useState("");
	const [pending, start] = useTransition();
	const [msg, setMsg] = useState<string | null>(null);
	const [receipt, setReceipt] = useState<string | null>(null);

	function doReserve() {
		if (!name.trim()) return;
		const fd = new FormData();
		fd.append("wish_id", item.id);
		fd.append("giver_name", name.trim());
		setMsg(null);
		start(async () => {
			const res = await reserveWish(fd);
			if (res?.error) setMsg(res.error);
			else {
				setReceipt(res.signature ?? null);
				setShowReserve(false);
			}
		});
	}

	function doCancel(sig: string) {
		const fd = new FormData();
		fd.append("wish_id", item.id);
		fd.append("signature", sig);
		start(async () => {
			const res = await cancelReservation(fd);
			if (res?.error) setMsg(res.error);
			else setReceipt(null);
		});
	}

	function doRemove() {
		const fd = new FormData();
		fd.append("wish_id", item.id);
		start(async () => {
			const res = await removeWish(fd);
			if (res?.error) setMsg(res.error);
		});
	}

	return (
		<article className={`brønn-card ${taken ? "reservert" : ""}`}>
			<div className="brønn-card-img">
				{item.image_url ? (
					<Image
						src={item.image_url}
						alt={item.title}
						fill
						sizes="(max-width: 768px) 100vw, 33vw"
						className={taken ? "dimmed" : ""}
						unoptimized
					/>
				) : (
					<span className="brønn-card-noimg">ingen bilde</span>
				)}
				<span className="brønn-card-cat">{item.category}</span>
				{taken && <span className="brønn-card-taken">reservert ✦</span>}
			</div>
			<div className="brønn-card-body">
				<h3>{item.title}</h3>
				<div className="brønn-card-meta">
					<span>{item.vendor || "—"}</span>
					<span className="brønn-price">{formatPrice(item.price_amount, item.price_currency)}</span>
				</div>
				{item.note && <p className="brønn-card-note">notat: {item.note}</p>}

				{owner ? (
					<div className="brønn-card-actions">
						<a href={item.url} target="_blank" rel="noreferrer">til produktet ↗</a>
						<button onClick={doRemove} disabled={pending} className="danger">
							{pending ? "…" : "fjern"}
						</button>
					</div>
				) : taken ? (
					<div className="brønn-card-actions">
						<p className="brønn-card-takenby">
							{item.reserved_by ? (
								<>reservert av <strong>{item.reserved_by}</strong></>
							) : (
								<>noen har kastet mynten sin her</>
							)}
						</p>
						<a href={item.url} target="_blank" rel="noreferrer">til produktet ↗</a>
					</div>
				) : showReserve ? (
					<div className="brønn-card-reserve">
						<input
							autoFocus
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && doReserve()}
							maxLength={60}
							placeholder="navnet ditt"
						/>
						<div className="brønn-card-actions">
							<button onClick={doReserve} disabled={pending || !name.trim()} className="primary">
								{pending ? "…" : "reserver"}
							</button>
							<button onClick={() => setShowReserve(false)}>avbryt</button>
						</div>
					</div>
				) : (
					<div className="brønn-card-actions">
						<a href={item.url} target="_blank" rel="noreferrer">til produktet ↗</a>
						<button onClick={() => setShowReserve(true)} className="primary">
							dette får jeg til →
						</button>
					</div>
				)}

				{receipt && (
					<div className="brønn-receipt">
						<p>reservert! signaturen din er kvitteringen:</p>
						<code>{receipt.slice(0, 24)}…</code>
						<button onClick={() => doCancel(receipt)} disabled={pending}>
							{pending ? "…" : "angre"}
						</button>
					</div>
				)}
				{msg && <p className="brønn-msg err">{msg}</p>}
			</div>
		</article>
	);
}
