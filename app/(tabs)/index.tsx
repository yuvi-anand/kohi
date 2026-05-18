import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Rating } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { getRatings } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { useLocation } from '../../context/location';
import { useShops } from '../../context/shops';
import { isSupabaseConfigured } from '../../lib/supabase';
import ShopCard from '../../components/ShopCard';
import { formatScore, overallColor } from '../../lib/utils';

type FeedMode = 'nearby' | 'social';
type Filter = 'all' | 'unrated' | 'laptop' | 'vibes' | 'coffee' | 'work';

const FILTERS: { key: Filter; label: string }[] = [
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

// Placeholder activity items for the social feed
const PLACEHOLDER_ACTIVITY = [
  { id: '1', emoji: '☕', name: 'Alex R.', action: 'rated', shop: 'Sightglass Coffee', score: 8.4, time: '2m ago' },
  { id: '2', emoji: '🍵', name: 'Jamie L.', action: 'tried matcha at', shop: 'Verve Coffee', score: 7.1, time: '1h ago' },
  { id: '3', emoji: '🔖', name: 'Sam K.', action: 'saved', shop: 'Blue Bottle Coffee', score: null, time: '3h ago' },
  { id: '4', emoji: '☕', name: 'Morgan T.', action: 'rated', shop: 'Ritual Coffee', score: 9.2, time: '5h ago' },
];

export default function FeedScreen() {
  const [mode, setMode] = useState<FeedMode>('nearby');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [loadingRatings, setLoadingRatings] = useState(false);

  const router = useRouter();
  const { user } = useAuth();
  const { loading: locLoading, permissionDenied } = useLocation();
  const { shops, loading: shopsLoading, error: shopsError, isRealData } = useShops();

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

  useFocusEffect(useCallback(() => { loadRatings(); }, [loadRatings]));

  const filtered = (() => {
    if (activeFilter === 'unrated') return shops.filter((s) => !ratings[s.id]);
    if (activeFilter === 'laptop') return shops.filter((s) => ratings[s.id]?.laptop_friendly);
    if (activeFilter === 'vibes') return shops.filter((s) => (ratings[s.id]?.vibes ?? 0) >= 8);
    if (activeFilter === 'coffee') return shops.filter((s) => (ratings[s.id]?.coffee_quality ?? 0) >= 8);
    if (activeFilter === 'work') {
      return [...shops].sort((a, b) => {
        const ra = ratings[a.id];
        const rb = ratings[b.id];
        if (ra && rb) return workScore(rb) - workScore(ra);
        if (ra) return -1;
        if (rb) return 1;
        return 0;
      });
    }
    return shops;
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>Kōhī</Text>
        {locLoading && <ActivityIndicator size="small" color={Colors.muted} />}
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
          renderItem={({ item }) => (
            <ShopCard
              shop={item}
              rating={ratings[item.id]}
              onPress={() => router.push(`/shop/${item.id}`)}
            />
          )}
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
            <Text style={styles.socialSubtitle}>See what people you follow are rating</Text>
          </View>

          {/* Placeholder activity items */}
          {PLACEHOLDER_ACTIVITY.map((item) => (
            <View key={item.id} style={styles.activityCard}>
              <View style={styles.activityAvatar}>
                <Text style={styles.activityAvatarText}>{item.name[0]}</Text>
              </View>
              <View style={styles.activityBody}>
                <Text style={styles.activityText}>
                  <Text style={styles.activityName}>{item.name}</Text>
                  {' '}{item.action}{' '}
                  <Text style={styles.activityShop}>{item.shop}</Text>
                </Text>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
              {item.score != null && (
                <View style={[styles.activityScore, { backgroundColor: overallColor(item.score) }]}>
                  <Text style={styles.activityScoreText}>{formatScore(item.score)}</Text>
                </View>
              )}
            </View>
          ))}

          <View style={styles.socialCta}>
            <Ionicons name="people-outline" size={36} color={Colors.milk} />
            <Text style={styles.socialCtaTitle}>Follow friends to see their ratings</Text>
            <Text style={styles.socialCtaText}>
              Social features are coming soon. You'll be able to follow other coffee lovers and see their ratings here.
            </Text>
          </View>
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
  socialHeader: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  socialTitle: { fontSize: 20, fontWeight: '700', color: Colors.roast, marginBottom: 2 },
  socialSubtitle: { fontSize: 13, color: Colors.muted },

  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 10,
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
  activityAvatarText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  activityBody: { flex: 1 },
  activityText: { fontSize: 13, color: Colors.espresso, lineHeight: 18 },
  activityName: { fontWeight: '600' },
  activityShop: { fontWeight: '500', color: Colors.caramel },
  activityTime: { fontSize: 11, color: Colors.muted, marginTop: 3 },
  activityScore: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  activityScoreText: { fontSize: 12, fontWeight: '700', color: Colors.white },

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
});
