import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CoffeeShop } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { MOCK_SHOPS } from '../../lib/mockShops';
import { getBookmarks } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import ShopCard from '../../components/ShopCard';

export default function BookmarksScreen() {
  const [savedShops, setSavedShops] = useState<CoffeeShop[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    try {
      setLoading(true);
      const bookmarks = await getBookmarks(user.id);
      const shopMap: Record<string, CoffeeShop> = {};
      for (const s of MOCK_SHOPS) shopMap[s.id] = s;
      const shops = bookmarks
        .filter((b) => shopMap[b.shop_id])
        .map((b) => shopMap[b.shop_id]);
      setSavedShops(shops);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.subtitle}>{savedShops.length} shops bookmarked</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.caramel} />
        </View>
      ) : (
        <FlatList
          data={savedShops}
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
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyText}>
                Bookmark coffee shops you want to visit later.
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
  safe: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.roast,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.espresso,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
