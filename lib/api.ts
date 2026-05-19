import { supabase } from './supabase';
import { CoffeeShop, Rating, Bookmark, Profile, DrinkType, FeedItem, UserResult, ReelSave, ShopStats } from './types';

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

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) throw error;
  return (data ?? []).map((f) => f.following_id);
}

export async function getFollowCounts(userId: string): Promise<{ following: number; followers: number }> {
  const [{ count: following }, { count: followers }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
  ]);
  return { following: following ?? 0, followers: followers ?? 0 };
}

export async function getFriendFeed(userId: string): Promise<FeedItem[]> {
  const followingIds = await getFollowingIds(userId);
  if (followingIds.length === 0) return [];

  const { data: ratings, error } = await supabase
    .from('ratings')
    .select('id, user_id, shop_id, drink_type, overall, notes, created_at, coffee_shops(name, address)')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, name')
    .in('id', followingIds);
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (ratings ?? []).map((r: any) => ({
    rating_id: r.id,
    user_id: r.user_id,
    username: profileMap[r.user_id]?.username ?? null,
    display_name: profileMap[r.user_id]?.name ?? null,
    shop_id: r.shop_id,
    shop_name: r.coffee_shops?.name ?? 'Unknown',
    shop_address: r.coffee_shops?.address ?? '',
    drink_type: r.drink_type ?? 'coffee',
    overall: r.overall,
    notes: r.notes,
    created_at: r.created_at,
  }));
}

export async function processReel(url: string): Promise<{
  platform: string;
  extracted_name: string;
  extracted_summary: string | null;
  source_caption: string;
  thumbnail_url: string | null;
  shop: { id: string; name: string; address: string; lat: number | null; lng: number | null; photo_url: string | null } | null;
}> {
  const { data, error } = await supabase.functions.invoke('process-reel', { body: { url } });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data;
}

export async function saveReelSave(save: ReelSave): Promise<void> {
  const { error } = await supabase.from('reel_saves').insert(save);
  if (error) throw error;
}

export async function getReelSaves(userId: string): Promise<ReelSave[]> {
  const { data, error } = await supabase
    .from('reel_saves')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getShopStats(shopId: string): Promise<ShopStats | null> {
  const { data, error } = await supabase
    .from('shop_rating_stats')
    .select('avg_overall, avg_coffee, avg_vibes, rating_count')
    .eq('shop_id', shopId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function searchUsers(query: string, currentUserId: string): Promise<UserResult[]> {
  if (!query.trim()) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, name, bio')
    .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
    .neq('id', currentUserId)
    .limit(20);

  if (!profiles || profiles.length === 0) return [];
  const ids = profiles.map((p) => p.id);

  const [{ data: follows }, { data: ratingRows }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', currentUserId).in('following_id', ids),
    supabase.from('ratings').select('user_id').in('user_id', ids),
  ]);

  const followingSet = new Set((follows ?? []).map((f) => f.following_id));
  const countMap: Record<string, number> = {};
  for (const r of (ratingRows ?? [])) countMap[r.user_id] = (countMap[r.user_id] ?? 0) + 1;

  return profiles.map((p) => ({
    id: p.id,
    username: p.username,
    name: p.name,
    bio: p.bio,
    rating_count: countMap[p.id] ?? 0,
    is_following: followingSet.has(p.id),
  }));
}
