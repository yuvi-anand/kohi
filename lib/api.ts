import { supabase } from './supabase';
import { CoffeeShop, Rating, Bookmark, Profile, DrinkType } from './types';

export async function upsertShop(shop: CoffeeShop): Promise<void> {
  const { error } = await supabase.from('coffee_shops').upsert(
    {
      id: shop.id,
      google_place_id: shop.google_place_id,
      name: shop.name,
      address: shop.address,
      neighborhood: shop.neighborhood,
      lat: shop.lat,
      lng: shop.lng,
      photo_url: shop.photo_url,
      price_level: shop.price_level,
      website: shop.website,
      phone: shop.phone,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function getRatings(userId: string, drinkType?: DrinkType): Promise<Rating[]> {
  let query = supabase
    .from('ratings')
    .select('*')
    .eq('user_id', userId)
    .order('overall', { ascending: false });
  if (drinkType) query = query.eq('drink_type', drinkType);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getRating(
  userId: string,
  shopId: string,
  drinkType: DrinkType = 'coffee'
): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .eq('drink_type', drinkType)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertRating(rating: Rating): Promise<void> {
  const { error } = await supabase.from('ratings').upsert(rating, {
    onConflict: 'user_id,shop_id,drink_type',
  });
  if (error) throw error;
}

export async function getBookmarks(userId: string): Promise<Bookmark[]> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addBookmark(
  userId: string,
  shopId: string
): Promise<void> {
  const { error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, shop_id: shopId });
  if (error) throw error;
}

export async function removeBookmark(
  userId: string,
  shopId: string
): Promise<void> {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('shop_id', shopId);
  if (error) throw error;
}

export async function getShop(shopId: string): Promise<CoffeeShop | null> {
  const { data, error } = await supabase
    .from('coffee_shops')
    .select('*')
    .eq('id', shopId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getShopsForIds(ids: string[]): Promise<CoffeeShop[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('coffee_shops')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return data ?? [];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(profile: { id: string; username?: string | null; name?: string | null; bio?: string | null }): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
  if (error) throw error;
}
