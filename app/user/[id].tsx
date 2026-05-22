import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';
import { Rating, Profile } from '../../lib/types';
import {
  getProfile,
  getRatings,
  getFollowCounts,
  getFollowingIds,
  followUser,
  unfollowUser,
  getShopsForIds,
} from '../../lib/api';
import { useAuth } from '../../context/auth';
import { useShops } from '../../context/shops';
import { isSupabaseConfigured } from '../../lib/supabase';
import { formatScore, overallColor, normalizeScore, NORMALIZE_THRESHOLD, timeAgo } from '../../lib/utils';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { shopById, addToCache } = useShops();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [allRatings, setAllRatings] = useState<Rating[]>([]);
  const [followCounts, setFollowCounts] = useState({ following: 0, followers: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [topExpanded, setTopExpanded] = useState(false);

  const isOwnProfile = user?.id === id;

  const load = useCallback(async () => {
    if (!id || !user || !isSupabaseConfigured()) return;
    setLoading(true);
    setNotFound(false);
    try {
      const [profileData, ratingsData, counts, myFollowingIds] = await Promise.all([
        getProfile(id),
        getRatings(id),
        getFollowCounts(id),
        getFollowingIds(user.id),
      ]);

      if (!profileData) {
        setNotFound(true);
        return;
      }

      setProfile(profileData);
      setFollowCounts(counts);
      setIsFollowing(myFollowingIds.includes(id));

      // Sort ratings by overall desc, deduplicate by shop (keep highest per shop)
      const shopBestMap: Record<string, Rating> = {};
      for (const r of ratingsData) {
        const existing = shopBestMap[r.shop_id];
        if (!existing || r.overall > existing.overall) {
          shopBestMap[r.shop_id] = r;
        }
      }
      const sorted = Object.values(shopBestMap).sort((a, b) => b.overall - a.overall);
      setRatings(sorted);
      setAllRatings(ratingsData);

      // Fetch missing shops
      const missingIds = sorted
        .slice(0, 5)
        .map((r) => r.shop_id)
        .filter((sid) => !shopById[sid]);
      if (missingIds.length > 0) {
        const fetched = await getShopsForIds([...new Set(missingIds)]);
        addToCache(fetched);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleFollow() {
    if (!user || !id) return;
    setFollowPending(true);
    try {
      if (isFollowing) {
        await unfollowUser(user.id, id);
        setIsFollowing(false);
        setFollowCounts((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await followUser(user.id, id);
        setIsFollowing(true);
        setFollowCounts((prev) => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setFollowPending(false);
    }
  }

  const displayName = profile?.name || (profile?.username ? `@${profile.username}` : 'Unknown');
  const initials = (profile?.name?.[0] ?? profile?.username?.[0] ?? '?').toUpperCase();
  const topRatings = ratings.slice(0, 5);

  // Normalize scores for this user's list (deduped ratings, mixed types — used for top 5 only)
  const theirScoresUnlocked = ratings.length >= NORMALIZE_THRESHOLD;
  const theirMax = theirScoresUnlocked
    ? Math.max(...ratings.map((r) => r.overall))
    : 0;

  // Per-drink-type normalization for recent activity feed
  const theirCoffeeRatings = allRatings.filter(r => (r.drink_type ?? 'coffee') === 'coffee');
  const theirMatchaRatings = allRatings.filter(r => r.drink_type === 'matcha');
  function dedupeByShop(list: Rating[]): Rating[] {
    const best: Record<string, Rating> = {};
    for (const r of list) {
      if (!best[r.shop_id] || r.overall > best[r.shop_id].overall) best[r.shop_id] = r;
    }
    return Object.values(best);
  }
  const coffeeDeduped = dedupeByShop(theirCoffeeRatings);
  const matchaDeduped = dedupeByShop(theirMatchaRatings);
  const coffeeUnlocked = coffeeDeduped.length >= NORMALIZE_THRESHOLD;
  const matchaUnlocked = matchaDeduped.length >= NORMALIZE_THRESHOLD;
  const coffeeMax = coffeeUnlocked ? Math.max(...coffeeDeduped.map(r => r.overall)) : 0;
  const matchaMax = matchaUnlocked ? Math.max(...matchaDeduped.map(r => r.overall)) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.espresso} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.caramel} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.espresso} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Ionicons name="person-outline" size={48} color={Colors.milk} />
          <Text style={styles.notFoundText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.espresso} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile.username ? `@${profile.username}` : displayName}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar + info */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.nameSection}>
            {profile.name ? (
              <Text style={styles.displayName}>{profile.name}</Text>
            ) : null}
            {profile.username ? (
              <Text style={styles.displayUsername}>@{profile.username}</Text>
            ) : !profile.name ? (
              <Text style={styles.displayName}>Unknown</Text>
            ) : null}
            {profile.bio ? (
              <Text style={styles.displayBio}>{profile.bio}</Text>
            ) : null}
          </View>
        </View>

        {/* Follow button */}
        {!isOwnProfile && (
          <View style={styles.followBtnContainer}>
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={toggleFollow}
              disabled={followPending}
            >
              {followPending ? (
                <ActivityIndicator
                  size="small"
                  color={isFollowing ? Colors.white : Colors.caramel}
                />
              ) : (
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{ratings.length}</Text>
              <Text style={styles.statLabel}>Rated</Text>
            </View>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push(`/followers?userId=${id}&type=following`)}
            >
              <Text style={styles.statNumber}>{followCounts.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => router.push(`/followers?userId=${id}&type=followers`)}
            >
              <Text style={styles.statNumber}>{followCounts.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Collapsible Top 5 */}
        {topRatings.length > 0 && (
          <View style={styles.rankingsCard}>
            <TouchableOpacity
              style={styles.rankingsHeader}
              onPress={() => setTopExpanded(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.rankingsTitle}>Top 5 Rankings</Text>
              <Ionicons name={topExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
            </TouchableOpacity>

            {topExpanded && (
              <>
                {topRatings.map((r, i) => {
                  const shop = shopById[r.shop_id];
                  const displayScore = theirScoresUnlocked
                    ? normalizeScore(r.overall, theirMax)
                    : null;
                  return (
                    <TouchableOpacity
                      key={`${r.shop_id}-${i}`}
                      style={styles.rankRow}
                      onPress={() => router.push(`/user-ratings/${id}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rankNum}>{i + 1}</Text>
                      <View style={styles.rankInfo}>
                        <Text style={styles.rankName} numberOfLines={1}>{shop?.name ?? '…'}</Text>
                        {shop?.address ? (
                          <Text style={styles.rankAddr} numberOfLines={1}>{shop.address}</Text>
                        ) : null}
                      </View>
                      {displayScore != null ? (
                        <View style={[styles.rankBadge, { backgroundColor: overallColor(displayScore) }]}>
                          <Text style={styles.rankScore}>{formatScore(displayScore)}</Text>
                        </View>
                      ) : (
                        <View style={styles.rankBadgeLocked}>
                          <Ionicons name="lock-closed" size={13} color={Colors.muted} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => router.push(`/user-ratings/${id}`)}
                >
                  <Text style={styles.seeAllText}>See all {ratings.length} ratings →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {topRatings.length === 0 && (
          <View style={styles.emptyRatings}>
            <Text style={styles.emptyRatingsText}>No ratings yet</Text>
          </View>
        )}

        {/* Recent activity feed */}
        {allRatings.length > 0 && (
          <View style={styles.feedSection}>
            <Text style={styles.feedTitle}>Recent Activity</Text>
            {[...allRatings]
              .filter(r => r.visited_at || r.created_at)
              .sort((a, b) => new Date(b.visited_at ?? b.created_at ?? 0).getTime() - new Date(a.visited_at ?? a.created_at ?? 0).getTime())
              .slice(0, 15)
              .map((r, i) => {
                const shop = shopById[r.shop_id];
                const drinkEmoji = r.drink_type === 'matcha' ? '🍵' : '☕';
                const isCoffee = (r.drink_type ?? 'coffee') === 'coffee';
                const unlocked = isCoffee ? coffeeUnlocked : matchaUnlocked;
                const max = isCoffee ? coffeeMax : matchaMax;
                const score = unlocked ? normalizeScore(r.overall, max) : null;
                const dateStr = r.visited_at ?? r.created_at;
                return (
                  <TouchableOpacity
                    key={`feed-${r.shop_id}-${r.drink_type}-${i}`}
                    style={styles.feedCard}
                    onPress={() => router.push(`/shop/${r.shop_id}`)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.feedLeft}>
                      <Text style={styles.feedEmoji}>{drinkEmoji}</Text>
                    </View>
                    <View style={styles.feedMiddle}>
                      <Text style={styles.feedShop} numberOfLines={1}>{shop?.name ?? '…'}</Text>
                      {r.notes ? <Text style={styles.feedNotes} numberOfLines={2}>"{r.notes}"</Text> : null}
                      {dateStr ? <Text style={styles.feedDate}>{timeAgo(dateStr)}</Text> : null}
                    </View>
                    {score != null ? (
                      <View style={[styles.feedBadge, { backgroundColor: overallColor(score) }]}>
                        <Text style={styles.feedBadgeText}>{formatScore(score)}</Text>
                      </View>
                    ) : (
                      <View style={styles.feedBadgeLocked}>
                        <Ionicons name="lock-closed" size={12} color={Colors.muted} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            }
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.milk,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1, fontSize: 18, fontWeight: '700', color: Colors.roast,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: Colors.muted, fontWeight: '500' },

  avatarSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.caramel,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: Colors.white },
  nameSection: { alignItems: 'center', gap: 4 },
  displayName: { fontSize: 20, fontWeight: '700', color: Colors.espresso },
  displayUsername: { fontSize: 14, color: Colors.muted, fontWeight: '500' },
  displayBio: {
    fontSize: 14, color: Colors.roast, textAlign: 'center',
    lineHeight: 20, marginTop: 6,
  },

  followBtnContainer: { paddingHorizontal: 32, marginBottom: 8 },
  followBtn: {
    paddingVertical: 11, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.caramel, alignItems: 'center',
  },
  followBtnActive: { backgroundColor: Colors.caramel },
  followBtnText: { fontSize: 15, fontWeight: '700', color: Colors.caramel },
  followBtnTextActive: { color: Colors.white },

  statsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16, borderRadius: 8,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', padding: 20 },
  statCard: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.milk },
  statNumber: { fontSize: 28, fontWeight: '700', color: Colors.roast },
  statLabel: { fontSize: 12, color: Colors.muted, marginTop: 2, fontWeight: '500' },

  rankingsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16, borderRadius: 10,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    marginBottom: 16, overflow: 'hidden',
  },
  rankingsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rankingsTitle: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  rankNum: { fontSize: 13, fontWeight: '700', color: Colors.muted, width: 20, textAlign: 'center' },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  rankAddr: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  rankBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankScore: { fontSize: 13, fontWeight: '700', color: Colors.white },
  rankBadgeLocked: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.foam, borderWidth: 1.5, borderColor: Colors.milk,
  },
  seeAllBtn: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.foam },
  seeAllText: { fontSize: 13, color: Colors.caramel, fontWeight: '600', textAlign: 'center' },

  emptyRatings: {
    marginHorizontal: 16, padding: 32,
    backgroundColor: Colors.white, borderRadius: 8, alignItems: 'center',
  },
  emptyRatingsText: { fontSize: 14, color: Colors.muted },

  feedSection: { marginHorizontal: 16, marginBottom: 16 },
  feedTitle: { fontSize: 14, fontWeight: '700', color: Colors.espresso, marginBottom: 10 },
  feedCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 10,
    padding: 12, marginBottom: 8, gap: 10,
    shadowColor: Colors.espresso, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  feedLeft: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.foam, alignItems: 'center', justifyContent: 'center' },
  feedEmoji: { fontSize: 18 },
  feedMiddle: { flex: 1, gap: 2 },
  feedShop: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  feedNotes: { fontSize: 12, color: Colors.muted, fontStyle: 'italic', lineHeight: 16 },
  feedDate: { fontSize: 11, color: Colors.caramel, fontWeight: '500' },
  feedBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  feedBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  feedBadgeLocked: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.foam, borderWidth: 1.5, borderColor: Colors.milk, alignItems: 'center', justifyContent: 'center' },
});
