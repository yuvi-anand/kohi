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
import { CoffeeShop, Rating, Bookmark } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { getRatings, getBookmarks, getShopsForIds } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { useLocation } from '../../context/location';
import { useShops } from '../../context/shops';
import { isSupabaseConfigured } from '../../lib/supabase';
import ShopCard from '../../components/ShopCard';

type Section = 'been' | 'want';
type Filter = 'all' | 'laptop' | 'vibes' | 'coffee' | 'work';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'laptop', label: '💻 Laptop Friendly' },
  { key: 'vibes', label: '✨ High Vibes' },
  { key: 'coffee', label: '☕ Best Coffee' },
  { key: 'work', label: '🏢 Work Spot' },
];

function workScore(r: Rating): number {
  const wifi = (r.wifi_quality ?? 1) >= 3 ? 1 : 0;
  return (
    (r.seating / 5) * 0.35 +
    wifi * 0.25 +
    (r.laptop_friendly ? 1 : 0) * 0.20 +
    (r.vibes / 10) * 0.15 +
    (r.coffee_quality / 10) * 0.05
  );
}

export default function FeedScreen() {
  const [section, setSection] = useState<Section>('been');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { user } = useAuth();
  const { permissionDenied } = useLocation();
  const { shopById, addToCache } = useShops();

  const loadData = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    try {
      setLoading(true);
      const [allRatings, allBookmarks] = await Promise.all([
        getRatings(user.id),
        getBookmarks(user.id),
      ]);

      const map: Record<string, Rating> = {};
      for (const r of allRatings) {
        if (!map[r.shop_id] || r.drink_type === 'coffee') map[r.shop_id] = r;
      }
      setRatings(map);
      setBookmarks(allBookmarks);

      const allIds = [
        ...Object.keys(map),
        ...allBookmarks.map((b) => b.shop_id),
      ];
      const missingIds = [...new Set(allIds)].filter((id) => !shopById[id]);
      if (missingIds.length > 0) {
        const fetched = await getShopsForIds(missingIds);
        addToCache(fetched);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user, shopById]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const ratedShops: { shop: CoffeeShop; rating: Rating }[] = Object.entries(ratings)
    .map(([id, r]) => ({ shop: shopById[id], rating: r }))
    .filter((x): x is { shop: CoffeeShop; rating: Rating } => !!x.shop);

  const bookmarkedShops: CoffeeShop[] = bookmarks
    .map((b) => shopById[b.shop_id])
    .filter((s): s is CoffeeShop => !!s);

  const filteredBeen = (() => {
    if (activeFilter === 'all') return [...ratedShops].sort((a, b) => b.rating.overall - a.rating.overall);
    if (activeFilter === 'laptop') return ratedShops.filter((x) => x.rating.laptop_friendly).sort((a, b) => b.rating.overall - a.rating.overall);
    if (activeFilter === 'vibes') return ratedShops.filter((x) => x.rating.vibes >= 8).sort((a, b) => b.rating.overall - a.rating.overall);
    if (activeFilter === 'coffee') return ratedShops.filter((x) => x.rating.coffee_quality >= 8).sort((a, b) => b.rating.overall - a.rating.overall);
    if (activeFilter === 'work') return [...ratedShops].sort((a, b) => workScore(b.rating) - workScore(a.rating));
    return ratedShops;
  })();

  const isEmpty = section === 'been' ? filteredBeen.length === 0 : bookmarkedShops.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>Kōhī</Text>
      </View>

      {permissionDenied && (
        <View style={styles.banner}>
          <Ionicons name="location-outline" size={14} color={Colors.muted} />
          <Text style={styles.bannerText}>
            Location off — enable in Settings to see nearby on the map.
          </Text>
        </View>
      )}

      {/* Been / Want to Try toggle */}
      <View style={styles.sectionToggle}>
        <TouchableOpacity
          style={[styles.sectionBtn, section === 'been' && styles.sectionBtnActive]}
          onPress={() => setSection('been')}
        >
          <Text style={[styles.sectionBtnText, section === 'been' && styles.sectionBtnTextActive]}>
            Been
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionBtn, section === 'want' && styles.sectionBtnActive]}
          onPress={() => setSection('want')}
        >
          <Text style={[styles.sectionBtnText, section === 'want' && styles.sectionBtnTextActive]}>
            Want to Try
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.caramel} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : section === 'been' ? (
        <FlatList
          data={filteredBeen}
          keyExtractor={(item) => item.shop.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
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
          }
          renderItem={({ item, index }) => (
            <ShopCard
              shop={item.shop}
              rating={item.rating}
              rank={index + 1}
              onPress={() => router.push(`/shop/${item.shop.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>☕</Text>
              <Text style={styles.emptyText}>No shops match this filter.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : (
        <FlatList
          data={bookmarkedShops}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ShopCard
              shop={item}
              rating={ratings[item.id]}
              onPress={() => router.push(`/shop/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🔖</Text>
              <Text style={styles.emptyTitle}>No saved shops yet</Text>
              <Text style={styles.emptyText}>
                Tap the bookmark icon on any shop to save it here.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
  },
  logo: { fontSize: 26, fontWeight: '800', color: Colors.roast, letterSpacing: -0.5 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.foam,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
  },
  bannerText: { fontSize: 12, color: Colors.muted, flex: 1 },

  sectionToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.milk,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  sectionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  sectionBtnActive: { backgroundColor: Colors.roast },
  sectionBtnText: { fontSize: 14, fontWeight: '700', color: Colors.muted },
  sectionBtnTextActive: { color: Colors.white },

  chipsScroll: { paddingHorizontal: 4, paddingVertical: 12, gap: 8 },
  chip: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: Colors.milk,
  },
  chipActive: { backgroundColor: Colors.roast, borderColor: Colors.roast },
  chipText: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  chipTextActive: { color: Colors.white },

  center: { paddingTop: 60, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.muted },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.espresso },
  emptyText: { fontSize: 14, color: Colors.muted, textAlign: 'center', paddingHorizontal: 32 },
});
