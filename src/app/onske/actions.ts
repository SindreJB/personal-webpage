'use server';

import { revalidatePath } from 'next/cache';
import { hasSupabaseAdminConfig, supabaseAdmin } from '@/lib/supabase';
import { scrapeProduct } from '@/lib/scrape';
import {
	clearOwnerCookie,
	isOwner,
	makeReservationSignature,
	setOwnerCookie,
} from '@/lib/onske';

/* ------------------------------------------------------------------
 * Server actions for Ønskebrønnen.
 * Eier-tilgang sjekkes via signert cookie — aldri via skjemafelt.
 * ------------------------------------------------------------------ */

async function requireOwner() {
	if (!(await isOwner())) throw new Error('Bare brønnens eier kan gjøre det.');
}

export async function ownerLogin(formData: FormData) {
	const key = String(formData.get('owner_key') || '');
	const expected = process.env.ONSKE_OWNER_KEY || process.env.WISHLIST_ADMIN_KEY || '';
	if (!expected || key !== expected) return { error: 'Feil nøkkel.' };
	await setOwnerCookie();
	revalidatePath('/onske');
	return { ok: true };
}

export async function ownerLogout() {
	await clearOwnerCookie();
	revalidatePath('/onske');
	return { ok: true };
}

export async function addWish(formData: FormData) {
	try {
		await requireOwner();
	} catch (e) {
		return { error: (e as Error).message };
	}

	const url = String(formData.get('url') || '').trim();
	const note = String(formData.get('note') || '').trim() || null;
	const overrideCategory = String(formData.get('category') || '').trim();

	if (!/^https?:\/\//i.test(url)) return { error: 'Gi meg en full lenke (med https://).' };
	if (!hasSupabaseAdminConfig) return { error: 'Supabase er ikke konfigurert.' };

	let scraped;
	try {
		scraped = await scrapeProduct(url);
	} catch (e) {
		return { error: (e as Error).message };
	}

	const db = supabaseAdmin();
	const { error } = await db.from('onskewishes').insert({
		url,
		title: scraped.title,
		image_url: scraped.image_url,
		price_amount: scraped.price_amount,
		price_currency: scraped.price_currency,
		category: overrideCategory || scraped.category,
		vendor: scraped.vendor,
		note,
	});

	if (error) return { error: error.message };
	revalidatePath('/onske');
	return { ok: true };
}

export async function removeWish(formData: FormData) {
	try {
		await requireOwner();
	} catch (e) {
		return { error: (e as Error).message };
	}

	const wish_id = String(formData.get('wish_id') || '');
	if (!wish_id) return { error: 'Mangler ønske.' };
	if (!hasSupabaseAdminConfig) return { error: 'Supabase er ikke konfigurert.' };

	const db = supabaseAdmin();
	const { error } = await db.from('onskewishes').delete().eq('id', wish_id);
	if (error) return { error: error.message };
	revalidatePath('/onske');
	return { ok: true };
}

/**
 * En besøkende reserverer et ønske. Ingen innlogging — navnet signeres
 * med serverens hemmelighet, så reservasjonen har et verifiserbart bevis.
 */
export async function reserveWish(formData: FormData) {
	const wish_id = String(formData.get('wish_id') || '');
	const giver_name = String(formData.get('giver_name') || '')
		.trim()
		.slice(0, 60);
	if (!wish_id || !giver_name) return { error: 'Trenger et ønske og et navn.' };
	if (!hasSupabaseAdminConfig) return { error: 'Supabase er ikke konfigurert.' };

	// Eieren skal ikke kunne reservere eget ønske (og heller ikke se navn).
	if (await isOwner()) return { error: 'Dette er din egen brønn — ingen reservasjon trengs.' };

	const createdAt = new Date().toISOString();
	const signature = makeReservationSignature(giver_name, wish_id, createdAt);

	const db = supabaseAdmin();
	const { error } = await db.from('onskereservations').insert({
		wish_id,
		giver_name,
		signature,
		created_at: createdAt,
	});

	if (error) {
		if (error.code === '23505') return { error: 'Noen har allerede kastet mynten sin på dette!' };
		return { error: error.message };
	}
	revalidatePath('/onske');
	return { ok: true, signature };
}

/**
 * Givere kan angre reservasjonen sin. Krever at signaturen stemmer —
 * det er "passordet" deres, laget da de reserverte.
 */
export async function cancelReservation(formData: FormData) {
	const wish_id = String(formData.get('wish_id') || '');
	const signature = String(formData.get('signature') || '');
	if (!wish_id || !signature) return { error: 'Mangler signatur.' };
	if (!hasSupabaseAdminConfig) return { error: 'Supabase er ikke konfigurert.' };

	const db = supabaseAdmin();
	const { data, error } = await db
		.from('onskereservations')
		.select('id, giver_name, wish_id, created_at, signature')
		.eq('wish_id', wish_id)
		.maybeSingle();

	if (error) return { error: error.message };
	if (!data) return { error: 'Fant ingen reservasjon.' };
	if (data.signature !== signature) return { error: 'Den signaturen stemmer ikke.' };

	const del = await db.from('onskereservations').delete().eq('id', data.id);
	if (del.error) return { error: del.error.message };
	revalidatePath('/onske');
	return { ok: true };
}
