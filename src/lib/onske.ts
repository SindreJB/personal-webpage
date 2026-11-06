import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase";
import { scrapeProduct } from "@/lib/scrape";

/* ------------------------------------------------------------------
 * Ønskebrønnen — server-side logikk.
 *
 * Roller:
 *   owner  — autentisert via signert cookie (nøkkel = ONSKE_OWNER_KEY)
 *   giver  — anonym besøkende som reserverer et ønske
 *
 * Eieren ser aldri reservasjoner (brønnen er mørk). Besøkende ser
 * reservasjoner med navn, så ikke to kjøper det samme.
 * ------------------------------------------------------------------ */

export const OWNER_COOKIE = "brønn_eier";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dager

function secret() {
  return process.env.ONSKE_SECRET || process.env.WISHLIST_ADMIN_KEY || "";
}

function ownerKey() {
  return process.env.ONSKE_OWNER_KEY || process.env.WISHLIST_ADMIN_KEY || "";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Signerer eier-økten: "owner.<expiry>" — uigjengelig for klienten. */
export function makeOwnerToken(days = 30) {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `owner.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyOwnerToken(token: string | undefined | null) {
  if (!token || !secret()) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "owner") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = sign(`owner.${parts[1]}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[2]);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Er den nåværende brukeren eieren? Kalles i server components. */
export async function isOwner() {
  const jar = await cookies();
  return verifyOwnerToken(jar.get(OWNER_COOKIE)?.value);
}

/** Setter eier-cookien (httpOnly, sameSite=lax, secure i prod). */
export async function setOwnerCookie() {
  const jar = await cookies();
  jar.set(OWNER_COOKIE, makeOwnerToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearOwnerCookie() {
  const jar = await cookies();
  jar.delete(OWNER_COOKIE);
}

/** Signerer en reservasjon: beviset givere kan vise fram. */
export function makeReservationSignature(giverName: string, wishId: string, createdAt: string) {
  return sign(`reserve.${giverName}.${wishId}.${createdAt}`);
}

export function verifyReservationSignature(sig: string, giverName: string, wishId: string, createdAt: string) {
  if (!sig || !secret()) return false;
  const expected = makeReservationSignature(giverName, wishId, createdAt);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------ typer ------------------------------ */

export type Wish = {
  id: string;
  url: string;
  title: string;
  image_url: string | null;
  price_amount: number | null;
  price_currency: string | null;
  category: string;
  vendor: string | null;
  note: string | null;
  created_at: string;
};

export type Reservation = {
  id: string;
  wish_id: string;
  giver_name: string;
  signature: string;
  created_at: string;
};

/** Det et ønske ser ut som for en gitt rolle. */
export type WishView = Wish & {
  /** Kun satt for givere: navnet som reserverte (så andre ser det er tatt). */
  reserved_by: string | null;
  /** Kun satt for eieren: antall reservasjoner (0 eller 1), aldri navn. */
  reserved: boolean;
};

/* --------------------------- dataaksess ---------------------------- */

export async function listWishes(): Promise<Wish[]> {
  if (!hasSupabaseAdminConfig) return [];
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("onskewishes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Wish[];
}

export async function listReservations(): Promise<Reservation[]> {
  if (!hasSupabaseAdminConfig) return [];
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("onskereservations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Reservation[];
}

/** Ønsker slik givere ser dem: reserverte vises med navn. */
export async function wishesForGiver(): Promise<WishView[]> {
  const [wishes, reservations] = await Promise.all([listWishes(), listReservations()]);
  const byWish = new Map(reservations.map((r) => [r.wish_id, r]));
  return wishes.map((w) => ({
    ...w,
    reserved_by: byWish.get(w.id)?.giver_name ?? null,
    reserved: false,
  }));
}

/** Ønsker slik eieren ser dem: navn skjult, bare "reservert"-flagg. */
export async function wishesForOwner(): Promise<WishView[]> {
  const [wishes, reservations] = await Promise.all([listWishes(), listReservations()]);
  const taken = new Set(reservations.map((r) => r.wish_id));
  return wishes.map((w) => ({
    ...w,
    reserved_by: null,
    reserved: taken.has(w.id),
  }));
}

/* ------------------------------ scrape ----------------------------- */

export type ScrapeResult = Awaited<ReturnType<typeof scrapeProduct>>;

export async function scrapeWish(url: string): Promise<ScrapeResult> {
  return scrapeProduct(url);
}
