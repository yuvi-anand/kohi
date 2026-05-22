import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Rating, FeedItem, ShopStats, RatingComment } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { getRatings, getFriendFeed, getShopStatsBatch, getUnreadNotificationCount, getRatingLikes, toggleRatingLike, getRatingComments, addRatingComment } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { useLocation } from '../../context/location';
import { useShops } from '../../context/shops';
import { isSupabaseConfigured } from '../../lib/supabase';
import ShopCard from '../../components/ShopCard';
import { formatScore, overallColor, timeAgo, distanceMiles, isNonCoffeeShop } from '../../lib/utils';

type FeedMode = 'nearby' | 'social';
type Filter = 'open' | 'all' | 'unrated' | 'laptop' | 'vibes' | 'coffee' | 'work';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open',    label: 'Open Now' },
  { key: 'all',     label: 'All' },
  { key: 'unrated', label: 'Not Yet Rated' },
  { key: 'laptop',  label: 'Laptop Friendly' },
  { key: 'vibes',   label: 'High Vibes' },
  { key: 'coffee',  label: 'Best Coffee' },
  { key: 'work',    label: 'Work Spot' },
];

function workScore(r: Rating): number {
  return (
    (r.seating / 5) * 0.35 +
    ((r.wifi_quality ?? 1) >= 3 ? 1 : 0) * 0.25 +
    (r.laptop_friendly ? 1 : 0) * 0.20 +
    (r.vibes / 10) * 0.15 +
    (r.coffee_quality / 10) * 0.05
  );
}

export default function FeedScreen() {
  const [mode, setMode] = useState<FeedMode>('nearby');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoaded, setFeedLoaded] = useState(false);
  const [shopStats, setShopStats] = useState<Record<string, ShopStats>>({});
  const [unreadCount, setUnreadCount] = useState(0);

  // Per-rating-id like/comment state for feed cards
  const [feedLikeCounts, setFeedLikeCounts] = useState<Record<string, number>>({});
  const [feedLikedByMe, setFeedLikedByMe] = useState<Record<string, boolean>>({});
  const [feedLikeLoading, setFeedLikeLoading] = useState<Record<string, boolean>>({});
  const [feedCommentCounts, setFeedCommentCounts] = useState<Record<string, number>>({});
  const [feedCommentsExpanded, setFeedCommentsExpanded] = useState<Record<string, boolean>>({});
  const [feedComments, setFeedComments] = useState<Record<string, RatingComment[]>>({});
  const [feedCommentText, setFeedCommentText] = useState<Record<string, string>>({});
  const [feedCommentSubmitting, setFeedCommentSubmitting] = useState<Record<string, boolean>>({});

  const router = useRouter();
  const { user } = useAuth();
  const { loading: locLoading, permissionDenied, coords } = useLocation();
  const { shops, loading: shopsLoading, error: shopsError, isRealData, addToCache } = useShops();

  const loadRatings = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    try {
      setLoadingRatings(true);
      const data = await getRatings(user.id);
      const map: Record<string, Rating> = {};
      for (const r of data) {
        if (!map[r.shop_id] || r.drink_type === 'coffee') map[r.shop_id] = r;
      }
      setRatings(map);
    } catch {
      // silently fail
    } finally {
      setLoadingRatings(false);
    }
  }, [user]);

  const loadFeed = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    setFeedLoading(true);
    try {
      const items = await getFriendFeed(user.id);
      setFeedItems(items);
      setFeedLoaded(true);
      const uniqueShopIds = [...new Set(items.map(i => i.shop_id))];
      getShopStatsBatch(uniqueShopIds).then(setShopStats).catch(() => {});

      // Batch-load like counts for each feed item
      const ratingIds = items.map(i => i.rating_id).filter(Boolean);
      if (ratingIds.length > 0) {
        const likeResults = await Promise.allSettled(
          ratingIds.map(rid => getRatingLikes(rid))
        );
        const counts: Record<string, number> = {};
        const likedByMe: Record<string, boolean> = {};
        likeResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const rid = ratingIds[idx];
            counts[rid] = result.value.length;
            likedByMe[rid] = result.value.some(l => l.user_id === user.id);
          }
        });
        setFeedLikeCounts(counts);
        setFeedLikedByMe(likedByMe);

        // Load comment counts too
        const commentResults = await Promise.allSettled(
          ratingIds.map(rid => getRatingComments(rid))
        );
        const commentCounts: Record<string, number> = {};
        commentResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            commentCounts[ratingIds[idx]] = result.value.length;
          }
        });
        setFeedCommentCounts(commentCounts);
      }
    } catch { } finally {
      setFeedLoading(false);
    }
  }, [user]);

  // Load shop stats for nearby shops when shops change
  useEffect(() => {
    if (shops.length === 0) return;
    getShopStatsBatch(shops.map(s => s.id)).then(setShopStats).catch(() => {});
  }, [shops]);

  function handleRate(item: FeedItem) {
    addToCache([{ id: item.shop_id, name: item.shop_name, address: item.shop_address }]);
    router.push(`/rate/${item.shop_id}`);
  }

  async function handleFeedToggleLike(ratingId: string) {
    if (!user) return;
    const alreadyLiked = feedLikedByMe[ratingId] ?? false;
    setFeedLikeLoading(prev => ({ ...prev, [ratingId]: true }));
    // Optimistic update
    setFeedLikedByMe(prev => ({ ...prev, [ratingId]: !alreadyLiked }));
    setFeedLikeCounts(prev => ({ ...prev, [ratingId]: (prev[ratingId] ?? 0) + (alreadyLiked ? -1 : 1) }));
    try {
      await toggleRatingLike(ratingId, user.id, alreadyLiked);
      const updated = await getRatingLikes(ratingId);
      setFeedLikeCounts(prev => ({ ...prev, [ratingId]: updated.length }));
      setFeedLikedByMe(prev => ({ ...prev, [ratingId]: updated.some(l => l.user_id === user.id) }));
    } catch {
      // Revert optimistic update on error
      setFeedLikedByMe(prev => ({ ...prev, [ratingId]: alreadyLiked }));
      setFeedLikeCounts(prev => ({ ...prev, [ratingId]: (prev[ratingId] ?? 0) + (alreadyLiked ? 1 : -1) }));
    } finally {
      setFeedLikeLoading(prev => ({ ...prev, [ratingId]: false }));
    }
  }

  async function handleFeedToggleComments(ratingId: string) {
    const nowExpanded = !feedCommentsExpanded[ratingId];
    setFeedCommentsExpanded(prev => ({ ...prev, [ratingId]: nowExpanded }));
    // Fetch comments only when first expanding
    if (nowExpanded && !feedComments[ratingId]) {
      try {
        const comments = await getRatingComments(ratingId);
        setFeedComments(prev => ({ ...prev, [ratingId]: comments }));
        setFeedCommentCounts(prev => ({ ...prev, [ratingId]: comments.length }));
      } catch { }
    }
  }

  async function handleFeedAddComment(ratingId: string) {
    if (!user) return;
    const text = (feedCommentText[ratingId] ?? '').trim();
    if (!text) return;
    setFeedCommentSubmitting(prev => ({ ...prev, [ratingId]: true }));
    try {
      await addRatingComment(ratingId, user.id, text);
      setFeedCommentText(prev => ({ ...prev, [ratingId]: '' }));
      const updated = await getRatingComments(ratingId);
      setFeedComments(prev => ({ ...prev, [ratingId]: updated }));
      setFeedCommentCounts(prev => ({ ...prev, [ratingId]: updated.length }));
    } catch { } finally {
      setFeedCommentSubmitting(prev => ({ ...prev, [ratingId]: false }));
    }
  }

  const loadUnread = useCallback(async () => {
    if (!user) return;
    try {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    } catch { }
  }, [user]);

  useFocusEffect(useCallback(() => { loadRatings(); loadFeed(); loadUnread(); }, [loadRatings, loadFeed, loadUnread]));

  // Filter out fast food / gas stations, then apply active filter
  const nearbyShops = shops.filter((s) => !isNonCoffeeShop(s.name));

  const filtered = (() => {
    let base = nearbyShops;
    if (activeFilter === 'open') return base.filter((s) => s.open_now === true);
    if (activeFilter === 'unrated') return base.filter((s) => !ratings[s.id]);
    if (activeFilter === 'laptop') return base.filter((s) => ratings[s.id]?.laptop_friendly);
    if (activeFilter === 'vibes') return base.filter((s) => (ratings[s.id]?.vibes ?? 0) >= 8);
    if (activeFilter === 'coffee') return base.filter((s) => (ratings[s.id]?.coffee_quality ?? 0) >= 8);
    if (activeFilter === 'work') {
      return [...base].sort((a, b) => {
        const ra = ratings[a.id];
        const rb = ratings[b.id];
        if (ra && rb) return workScore(rb) - workScore(ra);
        if (ra) return -1;
        if (rb) return 1;
        return 0;
      });
    }
    return base;
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>Kōhī</Text>
        <View style={styles.headerRight}>
          {locLoading && <ActivityIndicator size="small" color={Colors.muted} style={{ marginRight: 8 }} />}
          <TouchableOpacity
            style={styles.trophyBtn}
            onPress={() => router.push('/leaderboard')}
            activeOpacity={0.7}
          >
            <Ionicons name="trophy-outline" size={22} color={Colors.caramel} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={Colors.espresso} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : String(unreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {permissionDenied && (
        <View style={styles.banner}>
          <Ionicons name="location-outline" size={14} color={Colors.muted} />
          <Text style={styles.bannerText}>Location off — showing all shops. Enable in Settings to see nearby.</Text>
        </View>
      )}
      {shopsError && (
        <View style={[styles.banner, styles.bannerError]}>
          <Ionicons name="warning-outline" size={14} color={Colors.error} />
          <Text style={[styles.bannerText, { color: Colors.error }]}>{shopsError} — showing mock data.</Text>
        </View>
      )}

      {/* Nearby / Social toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'nearby' && styles.modeBtnActive]}
          onPress={() => setMode('nearby')}
        >
          <Text style={[styles.modeBtnText, mode === 'nearby' && styles.modeBtnTextActive]}>Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'social' && styles.modeBtnActive]}
          onPress={() => setMode('social')}
        >
          <Text style={[styles.modeBtnText, mode === 'social' && styles.modeBtnTextActive]}>Social</Text>
        </TouchableOpacity>
      </View>

      {mode === 'nearby' ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.chip, activeFilter === f.key && styles.chipActive]}
                    onPress={() => setActiveFilter(f.key)}
                  >
                    <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {isRealData ? '📍 NEAR YOU' : 'ALL SHOPS'}
                </Text>
                <Text style={styles.sectionCount}>
                  {shopsLoading ? 'loading…' : `${filtered.length} shops`}
                </Text>
              </View>
            </>
          }
          renderItem={({ item }) => {
            const distMi = (coords && item.lat && item.lng)
              ? distanceMiles(coords.latitude, coords.longitude, item.lat, item.lng)
              : null;
            return (
              <ShopCard
                shop={item}
                rating={ratings[item.id]}
                shopStats={shopStats[item.id]}
                distanceMi={distMi}
                onPress={() => router.push(`/shop/${item.id}`)}
              />
            );
          }}
          ListEmptyComponent={
            shopsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={Colors.caramel} />
                <Text style={styles.loadingText}>Finding coffee shops near you…</Text>
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.emptyEmoji}>☕</Text>
                <Text style={styles.emptyText}>No shops match this filter.</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.socialHeader}>
            <Text style={styles.socialTitle}>Friend Activity</Text>
            <TouchableOpacity style={styles.findFriendsBtn} onPress={() => router.push('/find-friends')}>
              <Ionicons name="person-add-outline" size={15} color={Colors.caramel} />
              <Text style={styles.findFriendsBtnText}>Find Friends</Text>
            </TouchableOpacity>
          </View>

          {feedLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.caramel} />
            </View>
          ) : feedItems.length === 0 && feedLoaded ? (
            <View style={styles.socialCta}>
              <Ionicons name="people-outline" size={36} color={Colors.milk} />
              <Text style={styles.socialCtaTitle}>Follow friends to see their ratings</Text>
              <Text style={styles.socialCtaText}>
                Search for people you know and follow them to see their coffee ratings here.
              </Text>
              <TouchableOpacity style={styles.findFriendsCta} onPress={() => router.push('/find-friends')}>
                <Text style={styles.findFriendsCtaText}>Find Friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            feedItems.map((item) => {
              const rid = item.rating_id;
              const likeCount = feedLikeCounts[rid] ?? 0;
              const liked = feedLikedByMe[rid] ?? false;
              const likeLoading = feedLikeLoading[rid] ?? false;
              const commentCount = feedCommentCounts[rid] ?? 0;
              const expanded = feedCommentsExpanded[rid] ?? false;
              const comments = feedComments[rid] ?? [];
              const commentText = feedCommentText[rid] ?? '';
              const commentSubmitting = feedCommentSubmitting[rid] ?? false;

              return (
                <View key={rid} style={styles.activityCardWrap}>
                  <TouchableOpacity
                    style={styles.activityCard}
                    onPress={() => router.push(`/shop/${item.shop_id}`)}
                    activeOpacity={0.8}
                  >
                    <TouchableOpacity
                      onPress={() => router.push('/user/' + item.user_id)}
                      activeOpacity={0.7}
                      style={styles.activityAvatar}
                    >
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.activityAvatarImg} />
                      ) : (
                        <Text style={styles.activityAvatarText}>
                          {(item.display_name?.[0] ?? item.username?.[0] ?? '?').toUpperCase()}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <View style={styles.activityBody}>
                      <TouchableOpacity onPress={() => router.push('/user/' + item.user_id)} activeOpacity={0.7}>
                        <Text style={styles.activityText}>
                          <Text style={styles.activityName}>
                            {item.display_name ?? (item.username ? `@${item.username}` : 'Someone')}
                          </Text>
                          {' rated '}
                          <Text style={styles.activityShop}>{item.shop_name}</Text>
                          {' '}{item.drink_type === 'matcha' ? '🍵' : '☕'}
                        </Text>
                      </TouchableOpacity>
                      {item.notes ? (
                        <Text style={styles.activityNote} numberOfLines={2}>"{item.notes}"</Text>
                      ) : null}
                      <Text style={styles.activityTime}>{timeAgo(item.created_at)}</Text>
                      <View style={styles.activityFooter}>
                        <TouchableOpacity
                          style={styles.rateInlineBtn}
                          onPress={(e) => { e.stopPropagation(); handleRate(item); }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.rateInlineBtnText}>Rate</Text>
                        </TouchableOpacity>
                        {/* Heart button */}
                        <TouchableOpacity
                          style={styles.feedActionBtn}
                          onPress={(e) => { e.stopPropagation(); handleFeedToggleLike(rid); }}
                          disabled={likeLoading}
                          activeOpacity={0.7}
                        >
                          {likeLoading ? (
                            <ActivityIndicator size="small" color={Colors.error} />
                          ) : (
                            <Ionicons
                              name={liked ? 'heart' : 'heart-outline'}
                              size={18}
                              color={liked ? Colors.error : Colors.muted}
                            />
                          )}
                          {likeCount > 0 && (
                            <Text style={[styles.feedActionCount, liked && { color: Colors.error }]}>
                              {likeCount}
                            </Text>
                          )}
                        </TouchableOpacity>
                        {/* Comment button */}
                        <TouchableOpacity
                          style={styles.feedActionBtn}
                          onPress={(e) => { e.stopPropagation(); handleFeedToggleComments(rid); }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={expanded ? 'chatbubble' : 'chatbubble-outline'}
                            size={17}
                            color={expanded ? Colors.caramel : Colors.muted}
                          />
                          {commentCount > 0 && (
                            <Text style={[styles.feedActionCount, expanded && { color: Colors.caramel }]}>
                              {commentCount}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                    {shopStats[item.shop_id] && (
                      <View style={styles.activityScoreWrap}>
                        <View style={[styles.activityScore, { backgroundColor: overallColor(shopStats[item.shop_id].avg_overall) }]}>
                          <Text style={styles.activityScoreText}>{formatScore(shopStats[item.shop_id].avg_overall)}</Text>
                        </View>
                        <Text style={styles.activityScoreLabel}>avg</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Inline comment section */}
                  {expanded && (
                    <View style={styles.inlineComments}>
                      {comments.map((c) => {
                        const initial = (c.display_name?.[0] ?? c.username?.[0] ?? '?').toUpperCase();
                        return (
                          <View key={c.id} style={styles.inlineCommentRow}>
                            {c.avatar_url ? (
                              <Image source={{ uri: c.avatar_url }} style={styles.inlineCommentAvatar} />
                            ) : (
                              <View style={styles.inlineCommentAvatarFallback}>
                                <Text style={styles.inlineCommentAvatarText}>{initial}</Text>
                              </View>
                            )}
                            <View style={styles.inlineCommentBody}>
                              <Text style={styles.inlineCommentUser}>
                                {c.display_name ?? (c.username ? `@${c.username}` : 'User')}
                              </Text>
                              <Text style={styles.inlineCommentText}>{c.text}</Text>
                            </View>
                          </View>
                        );
                      })}
                      <View style={styles.inlineCommentInput}>
                        <TextInput
                          style={styles.inlineCommentTextInput}
                          placeholder="Add a comment…"
                          placeholderTextColor={Colors.muted}
                          value={commentText}
                          onChangeText={(t) => setFeedCommentText(prev => ({ ...prev, [rid]: t }))}
                          returnKeyType="send"
                          onSubmitEditing={() => handleFeedAddComment(rid)}
                        />
                        <TouchableOpacity
                          onPress={() => handleFeedAddComment(rid)}
                          disabled={!commentText.trim() || commentSubmitting}
                          activeOpacity={0.7}
                        >
                          {commentSubmitting ? (
                            <ActivityIndicator size="small" color={Colors.caramel} />
                          ) : (
                            <Ionicons name="send" size={18} color={commentText.trim() ? Colors.caramel : Colors.milk} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
  },
  logo: { fontSize: 26, fontWeight: '800', color: Colors.roast, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  trophyBtn: { padding: 4, marginRight: 4 },
  bellBtn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#D4463B',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Colors.white,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: Colors.white, lineHeight: 11 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.foam, borderBottomWidth: 1, borderBottomColor: Colors.milk,
  },
  bannerError: { backgroundColor: '#FFF0EF' },
  bannerText: { fontSize: 12, color: Colors.muted, flex: 1 },

  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.milk,
    borderRadius: 6,
    padding: 3,
    gap: 3,
  },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: 5, alignItems: 'center' },
  modeBtnActive: { backgroundColor: Colors.roast },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.muted },
  modeBtnTextActive: { color: Colors.white },

  chipsScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    backgroundColor: Colors.white, borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: Colors.milk,
  },
  chipActive: { backgroundColor: Colors.roast, borderColor: Colors.roast },
  chipText: { fontSize: 13, color: Colors.muted, fontWeight: '500' },
  chipTextActive: { color: Colors.white },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.muted, letterSpacing: 1 },
  sectionCount: { fontSize: 11, color: Colors.muted },

  center: { paddingTop: 60, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.muted },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: Colors.muted },

  // Social feed
  socialHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  socialTitle: { fontSize: 20, fontWeight: '700', color: Colors.roast },
  findFriendsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.caramel },
  findFriendsBtnText: { fontSize: 13, fontWeight: '600', color: Colors.caramel },

  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 14,
    gap: 12,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  activityAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.latte,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  activityAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  activityAvatarText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  activityBody: { flex: 1 },
  activityText: { fontSize: 13, color: Colors.espresso, lineHeight: 18 },
  activityName: { fontWeight: '600' },
  activityShop: { fontWeight: '500', color: Colors.caramel },
  activityTime: { fontSize: 11, color: Colors.muted, marginTop: 3 },
  activityScoreWrap: {
    alignItems: 'center', gap: 2, flexShrink: 0, alignSelf: 'flex-start',
  },
  activityScore: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  activityScoreText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  activityScoreLabel: { fontSize: 9, fontWeight: '600', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.3 },

  socialCta: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 8, padding: 28,
    alignItems: 'center', gap: 10,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  socialCtaTitle: { fontSize: 16, fontWeight: '700', color: Colors.espresso, textAlign: 'center' },
  socialCtaText: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 19 },
  activityNote: { fontSize: 12, color: Colors.muted, fontStyle: 'italic', marginTop: 2, lineHeight: 16 },
  activityFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  communityAvgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  communityAvgLabel: { fontSize: 10, color: Colors.muted },
  communityAvgBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  communityAvgText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  rateInlineBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.caramel,
  },
  rateInlineBtnText: { fontSize: 11, fontWeight: '600', color: Colors.caramel },
  findFriendsCta: { backgroundColor: Colors.caramel, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 24, marginTop: 4 },
  findFriendsCtaText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  // Likes + comments on feed cards
  activityCardWrap: { marginHorizontal: 16, marginBottom: 10 },
  feedActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 2 },
  feedActionCount: { fontSize: 12, fontWeight: '600', color: Colors.muted },

  inlineComments: {
    backgroundColor: Colors.foam,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
    borderTopWidth: 1, borderTopColor: Colors.milk,
  },
  inlineCommentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  inlineCommentAvatar: { width: 26, height: 26, borderRadius: 13 },
  inlineCommentAvatarFallback: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.latte, alignItems: 'center', justifyContent: 'center' },
  inlineCommentAvatarText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  inlineCommentBody: { flex: 1 },
  inlineCommentUser: { fontSize: 11, fontWeight: '700', color: Colors.espresso },
  inlineCommentText: { fontSize: 12, color: Colors.roast, lineHeight: 17, marginTop: 1 },
  inlineCommentInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.milk,
    paddingTop: 8, marginTop: 2,
  },
  inlineCommentTextInput: { flex: 1, fontSize: 13, color: Colors.espresso, paddingVertical: 4 },
});
