import {
	hasSupabasePublicConfig,
	supabasePublic,
	type WishlistItem,
	type BoughtMark,
	type ItemWithMark,
} from '@/lib/supabase';
import WishlistView from './WishlistView';

export const revalidate = 30;

export default async function WishlistPage() {
	if (!hasSupabasePublicConfig) {
		return <WishlistView items={[]} />;
	}

	const db = supabasePublic();

	const [itemsRes, marksRes] = await Promise.all([
		db.from('wishlist_items').select('*').order('created_at', { ascending: false }),
		db.from('bought_marks').select('*'),
	]);

	const items = (itemsRes.data as WishlistItem[] | null) || [];
	const marks = (marksRes.data as BoughtMark[] | null) || [];
	const markByItem = new Map(marks.map((m) => [m.item_id, m.buyer_name]));

	const combined: ItemWithMark[] = items.map((it) => ({
		...it,
		bought_by: markByItem.get(it.id) || null,
	}));

	return <WishlistView items={combined} />;
}
