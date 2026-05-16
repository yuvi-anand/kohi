import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CoffeeShop, Rating, DrinkType, Bookmark } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { getRatings, getBookmarks, getShopsForIds } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { useShops } from '../../context/shops';
import { isSupabaseConfigured } from '../../lib/supabase';
import ShopCard from '../../components/ShopCard';

type Section = 'been' | 'want';

export default function MyListScreen() {
  const [section, setSection] = useState<Section>('been');
  const [allRatings, setAllRatings] = useState<Rating[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [drinkType, setDrinkType] = useState<DrinkType>('coffee');

  const router = useRouter();
  const { user } = useAuth();
  const { shopById, addToCache } = useShops();

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    try {
      setLoading(true);
      const [ratings, bmarks] = await Promise.all([
        getRatings(user.id),
        getBookmarks(user.id),
      ]);
      setAllRatings(ratings);
      setBookmarks(bmarks);

      const allIds = [
        ...ratings.map((r) => r.shop_id),
        ...bmarks.map((b) => b.shop_id),
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
    useCallback(() => { load(); }, [load])
  );

  const isMatcha = drinkType === 'matcha';
  const accent = isMatcha ? Colors.matcha : Colors.caramel;

  const filteredRated = allRatings
    .filter((r) => (r.drink_type ?? 'coffee') === drinkType && shopById[r.shop_id])
    .sort((a, b) => b.overall - a.overall)
    .map((r) => ({ shop: shopById[r.shop_id] as CoffeeShop, rating: r }));

  const bookmarkedShops: CoffeeShop[] = bookmarks
    .map((b) => shopById[b.shop_id])
    .filter((s): s is CoffeeShop => !!s);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My List</Text>
        <Text style={styles.subtitle}>
          {section === 'been'
            ? `${filteredRated.length} shops rated`
            : `${bookmarkedShops.length} shops saved`}
        </Text>
      </View>

      {/* Been / Want to Try toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, section === 'been' && styles.toggleBtnActive]}
          onPress={() => setSection('been')}
        >
          <Text style={[styles.toggleBtnText, section === 'been' && styles.toggleBtnTextActive]}>
            Been
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, section === 'want' && styles.toggleBtnActive]}
          onPress={() => setSection('want')}
        >
          <Text style={[styles.toggleBtnText, section === 'want' && styles.toggleBtnTextActive]}>
            Want to Try
          </Text>
        </TouchableOpacity>
      </View>

      {/* Coffee / Matcha sub-toggle — only in Been mode */}
      {section === 'been' && (
        <View style={styles.drinkToggleRow}>
          <TouchableOpacity
            style={[styles.drinkBtn, !isMatcha && { backgroundColor: Colors.caramel, borderColor: Colors.caramel }]}
            onPress={() => setDrinkType('coffee')}
          >
            <Text style={[styles.drinkBtnText, !isMatcha && styles.drinkBtnTextActive]}>
              ☕ Coffee
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.drinkBtn, isMatcha && { backgroundColor: Colors.matcha, borderColor: Colors.matcha }]}
            onPress={() => setDrinkType('matcha')}
          >
            <Text style={[styles.drinkBtnText, isMatcha && styles.drinkBtnTextActive]}>
              🍵 Matcha
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={accent} />
        </View>
      ) : section === 'been' ? (
        <FlatList
          data={filteredRated}
          keyExtractor={(item) => item.shop.id + item.rating.drink_type}
          renderItem={({ item, index }) => (
            <ShopCard
              shop={item.shop}
              rating={item.rating}
              rank={index + 1}
              onPress={() => router.push(`/shop/${item.shop.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{isMatcha ? '🍵' : '☕'}</Text>
              <Text style={styles.emptyTitle}>No {isMatcha ? 'matcha' : 'coffee'} ratings yet</Text>
              <Text style={styles.emptyText}>
                Rate a {isMatcha ? 'matcha' : 'coffee shop'} to build your list.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={bookmarkedShops}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ShopCard
              shop={item}
              onPress={() => router.push(`/shop/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔖</Text>
              <Text style={styles.emptyTitle}>No saved shops yet</Text>
              <Text style={styles.emptyText}>
                Tap the bookmark icon on any shop to save it here.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.roast, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.muted, marginTop: 2 },

  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.milk,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: Colors.roast },
  toggleBtnText: { fontSize: 14, fontWeight: '700', color: Colors.muted },
  toggleBtnTextActive: { color: Colors.white },

  drinkToggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.foam,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  drinkBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 0,
  },
  drinkBtnText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  drinkBtnTextActive: { color: Colors.white },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.espresso, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 20 },
});
