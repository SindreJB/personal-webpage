"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import type { ItemWithMark } from "@/lib/supabase";
import { addItem, markBought, unmarkBought, deleteItem } from "./actions";

const CATEGORIES = ["all", "books", "tech", "home", "clothing", "beauty", "games", "food", "outdoor", "other"];
const STATUS = ["all", "available", "claimed"] as const;
const SORTS = ["newest", "price-low", "price-high"] as const;

type Status = (typeof STATUS)[number];
type Sort = (typeof SORTS)[number];

function formatPrice(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(amount);
  } catch {
    return `${amount} ${cur}`;
  }
}

export default function WishlistView({ items }: { items: ItemWithMark[] }) {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");

  const filtered = useMemo(() => {
    let r = items;
    if (category !== "all") r = r.filter((i) => i.category === category);
    if (status === "available") r = r.filter((i) => !i.bought_by);
    if (status === "claimed") r = r.filter((i) => i.bought_by);
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
    if (sort === "price-low") r = [...r].sort((a, b) => (a.price_amount ?? Infinity) - (b.price_amount ?? Infinity));
    if (sort === "price-high") r = [...r].sort((a, b) => (b.price_amount ?? -Infinity) - (a.price_amount ?? -Infinity));
    return r;
  }, [items, category, status, query, sort, maxPrice]);

  const stats = useMemo(() => {
    const total = items.length;
    const claimed = items.filter((i) => i.bought_by).length;
    return { total, claimed, available: total - claimed };
  }, [items]);

  return (
    <div className="max-w-6xl mx-auto px-4 pt-10 pb-20">
      {/* Header */}
      <div className="brutal bg-lime shadow-chunk-lg p-6 mb-8 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 brutal bg-bubblegum rotate-12 hidden md:block" />
        <p className="font-mono text-xs bg-white brutal inline-block px-2 py-0.5 shadow-chunk-sm">
          /wishlist · birthday edition
        </p>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">the wishlist ✿</h1>
        <p className="mt-3 font-body max-w-xl">
          drop a product link, the page figures out the rest. if you're buying something, hit{" "}
          <span className="bg-white brutal px-1">claim</span> so no one doubles up.
        </p>
        <div className="mt-4 flex gap-2 flex-wrap font-mono text-xs">
          <span className="brutal bg-white px-2 py-1 shadow-chunk-sm">total: {stats.total}</span>
          <span className="brutal bg-white px-2 py-1 shadow-chunk-sm">available: {stats.available}</span>
          <span className="brutal bg-violet text-white px-2 py-1 shadow-chunk-sm">claimed: {stats.claimed}</span>
        </div>
      </div>

      <AddForm />

      {/* Filters */}
      <div className="brutal bg-white shadow-chunk p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <label className="block">
          <span className="font-mono text-xs uppercase">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="title, brand…"
            className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase">category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1 bg-white"
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase">status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1 bg-white"
          >
            {STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase">max price</span>
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="∞"
            className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase">sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1 bg-white"
          >
            {SORTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="brutal bg-white shadow-chunk p-8 text-center font-mono">
          nothing matches those filters. <span className="blink">_</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((it) => <ItemCard key={it.id} item={it} />)}
        </div>
      )}
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
      const res = await addItem(formData);
      if (res?.error) setMsg({ type: "err", text: res.error });
      else {
        setMsg({ type: "ok", text: "added!" });
        (document.getElementById("add-form") as HTMLFormElement)?.reset();
      }
    });
  }

  return (
    <div className="brutal bg-cyber shadow-chunk mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-4 py-3 font-mono text-sm flex justify-between items-center"
      >
        <span>＋ add item (owner only)</span>
        <span>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <form id="add-form" action={submit} className="border-t-[3px] border-black p-4 bg-white space-y-3">
          <label className="block">
            <span className="font-mono text-xs uppercase">product URL</span>
            <input
              name="url"
              required
              placeholder="https://..."
              className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1"
            />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-xs uppercase">category override (optional)</span>
              <select name="category" defaultValue="" className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1 bg-white">
                <option value="">— auto-detect —</option>
                {CATEGORIES.filter((c) => c !== "all").map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="font-mono text-xs uppercase">owner key</span>
              <input
                name="admin_key"
                type="password"
                required
                className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1"
              />
            </label>
          </div>
          <label className="block">
            <span className="font-mono text-xs uppercase">private note (optional)</span>
            <input name="note" className="brutal w-full px-2 py-1.5 font-mono text-sm mt-1" />
          </label>
          <button
            disabled={pending}
            className="glossy brutal bg-bubblegum font-mono px-4 py-2 disabled:opacity-50"
          >
            {pending ? "fetching…" : "add to wishlist"}
          </button>
          {msg && (
            <p className={`font-mono text-xs brutal px-2 py-1 inline-block shadow-chunk-sm ${msg.type === "ok" ? "bg-lime" : "bg-bubblegum text-white"}`}>
              {msg.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: ItemWithMark }) {
  const claimed = !!item.bought_by;
  const [showClaim, setShowClaim] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  function doMark() {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.append("item_id", item.id);
    fd.append("buyer_name", name.trim());
    start(async () => {
      await markBought(fd);
      setShowClaim(false);
      setName("");
    });
  }

  function doUnmark() {
    const fd = new FormData();
    fd.append("item_id", item.id);
    start(async () => { await unmarkBought(fd); });
  }

  return (
    <article className={`brutal bg-white shadow-chunk flex flex-col overflow-hidden ${claimed ? "opacity-70" : ""}`}>
      <div className="relative aspect-[4/3] bg-chrome-100 border-b-[3px] border-black">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className={`object-cover ${claimed ? "grayscale" : ""}`}
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full font-mono text-xs text-chrome-500">no image</div>
        )}
        <span className="absolute top-2 left-2 brutal bg-white px-2 py-0.5 font-mono text-xs shadow-chunk-sm">
          {item.category}
        </span>
        {claimed && (
          <span className="absolute top-2 right-2 brutal bg-violet text-white px-2 py-0.5 font-mono text-xs shadow-chunk-sm rotate-3">
            claimed ✦
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3 className="font-display text-2xl leading-tight line-clamp-2">{item.title}</h3>
        <div className="flex justify-between font-mono text-xs">
          <span className="opacity-70">{item.vendor || "—"}</span>
          <span className="bg-lime brutal px-1.5">{formatPrice(item.price_amount, item.price_currency)}</span>
        </div>
        {item.note && <p className="font-mono text-xs bg-chrome-100 brutal px-2 py-1">note: {item.note}</p>}

        {claimed ? (
          <div className="mt-auto flex flex-col gap-2">
            <p className="font-mono text-xs">claimed by <strong>{item.bought_by}</strong></p>
            <div className="flex gap-2">
              <a href={item.url} target="_blank" rel="noreferrer" className="flex-1 brutal bg-white text-center font-mono text-xs py-1.5 shadow-chunk-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform">
                view ↗
              </a>
              <button onClick={doUnmark} disabled={pending} className="brutal bg-bubblegum text-white font-mono text-xs px-2 py-1.5 shadow-chunk-sm disabled:opacity-50">
                undo
              </button>
            </div>
          </div>
        ) : showClaim ? (
          <div className="mt-auto flex flex-col gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doMark()}
              maxLength={60}
              placeholder="your name"
              className="brutal w-full px-2 py-1.5 font-mono text-sm"
            />
            <div className="flex gap-2">
              <button onClick={doMark} disabled={pending || !name.trim()} className="flex-1 glossy brutal bg-lime font-mono text-xs py-1.5 disabled:opacity-50">
                {pending ? "..." : "confirm claim"}
              </button>
              <button onClick={() => setShowClaim(false)} className="brutal bg-white font-mono text-xs px-2 py-1.5 shadow-chunk-sm">
                cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex gap-2">
            <a href={item.url} target="_blank" rel="noreferrer" className="flex-1 brutal bg-white text-center font-mono text-xs py-1.5 shadow-chunk-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform">
              view ↗
            </a>
            <button onClick={() => setShowClaim(true)} className="flex-1 glossy brutal bg-bubblegum text-white font-mono text-xs py-1.5">
              I'll get this →
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
