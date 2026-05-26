'use server';

import { revalidatePath } from 'next/cache';
import { hasSupabaseAdminConfig, supabaseAdmin } from '@/lib/supabase';
import { scrapeProduct } from '@/lib/scrape';

const ADMIN_KEY = process.env.WISHLIST_ADMIN_KEY;

function isAdmin(key: string | null | undefined) {
	return !!ADMIN_KEY && key === ADMIN_KEY;
}

export async function addItem(formData: FormData) {
	const url = String(formData.get('url') || '').trim();
	const note = String(formData.get('note') || '').trim() || null;
	const overrideCategory = String(formData.get('category') || '').trim();
	const adminKey = String(formData.get('admin_key') || '');

	if (!isAdmin(adminKey)) return { error: 'Wrong owner key — only the site owner can add items.' };
	if (!/^https?:\/\//i.test(url)) return { error: 'Give me a full URL (with https://).' };
	if (!hasSupabaseAdminConfig) return { error: 'Supabase is not configured locally.' };

	let scraped;
	try {
		scraped = await scrapeProduct(url);
	} catch (e) {
		return { error: (e as Error).message };
	}

	const db = supabaseAdmin();
	const { error } = await db.from('wishlist_items').insert({
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
	revalidatePath('/wishlist');
	return { ok: true };
}

export async function markBought(formData: FormData) {
	const item_id = String(formData.get('item_id') || '');
	const buyer_name = String(formData.get('buyer_name') || '')
		.trim()
		.slice(0, 60);
	if (!item_id || !buyer_name) return { error: 'Need an item and a name.' };
	if (!hasSupabaseAdminConfig) return { error: 'Supabase is not configured locally.' };

	const db = supabaseAdmin();
	const { error } = await db.from('bought_marks').insert({ item_id, buyer_name });
	if (error) {
		if (error.code === '23505') return { error: 'Someone already claimed this one!' };
		return { error: error.message };
	}
	revalidatePath('/wishlist');
	return { ok: true };
}

export async function unmarkBought(formData: FormData) {
	const item_id = String(formData.get('item_id') || '');
	if (!item_id) return { error: 'Missing item.' };
	if (!hasSupabaseAdminConfig) return { error: 'Supabase is not configured locally.' };
	const db = supabaseAdmin();
	const { error } = await db.from('bought_marks').delete().eq('item_id', item_id);
	if (error) return { error: error.message };
	revalidatePath('/wishlist');
	return { ok: true };
}

export async function deleteItem(formData: FormData) {
	const item_id = String(formData.get('item_id') || '');
	const adminKey = String(formData.get('admin_key') || '');
	if (!isAdmin(adminKey)) return { error: 'Owner only.' };
	if (!hasSupabaseAdminConfig) return { error: 'Supabase is not configured locally.' };
	const db = supabaseAdmin();
	const { error } = await db.from('wishlist_items').delete().eq('id', item_id);
	if (error) return { error: error.message };
	revalidatePath('/wishlist');
	return { ok: true };
}
