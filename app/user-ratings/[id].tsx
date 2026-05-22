import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';
import { Rating } from '../../lib/types';
import { getRatings, getProfile, getShopsForIds } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { useShops } from '../../context/shops';
import { isSupabaseConfigured } from '../../lib/supabase';
import { formatScore, overallColor, normalizeScore, NORMALIZE_THRESHOLD } from '../../lib/utils';

export default function UserRatingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { shopById, addToCache } = useShops();

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const [allRatings, profile] = await Promise.all([
        getRatings(id),
        getProfile(id),
      ]);
      setDisplayName(profile?.name ?? (profile?.username ? `@${profile.username}` : 'User'));

      // Deduplicate per shop per drink type, keep highest overall
      const key = (r: Rating) => `${r.shop_id}-${r.drink_type ?? 'coffee'}`;
      const bestMap: Record<string, Rating> = {};
      for (const r of allRatings) {
        const k = key(r);
        if (!bestMap[k] || r.overall > bestMap[k].overall) bestMap[k] = r;
      }
      const sorted = Object.values(bestMap).sort((a, b) => b.overall - a.overall);
      setRatings(sorted);

      const missingIds = sorted.map(r => r.shop_id).filter(sid => !shopById[sid]);
      if (missingIds.length > 0) {
        const fetched = await getShopsForIds([...new Set(missingIds)]);
        addToCache(fetched);
      }
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isOwn = user?.id === id;
  const coffeeRatings = ratings.filter(r => (r.drink_type ?? 'coffee') === 'coffee');
  const matchaRatings = ratings.filter(r => r.drink_type === 'matcha');

  function renderSection(list: Rating[], label: string, emoji: string) {
    if (list.length === 0) return null;
    const unlocked = list.length >= NORMALIZE_THRESHOLD;
    const max = unlocked ? Math.max(...list.map(r => r.overall)) : 0;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{emoji} {label}</Text>
        {list.map((r, i) => {
          const shop = shopById[r.shop_id];
          const score = unlocked ? normalizeScore(r.overall, max) : null;
          return (
            <TouchableOpacity
              key={`${r.shop_id}-${r.drink_type}`}
              style={styles.row}
              onPress={() => router.push(`/shop/${r.shop_id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>{shop?.name ?? '…'}</Text>
                {shop?.neighborhood || shop?.address ? (
                  <Text style={styles.rowAddr} numberOfLines={1}>{shop.neighborhood ?? shop.address}</Text>
                ) : null}
              </View>
              {score != null ? (
                <View style={[styles.badge, { backgroundColor: overallColor(score) }]}>
                  <Text style={styles.badgeText}>{formatScore(score)}</Text>
                </View>
              ) : (
                <View style={styles.badgeLocked}>
                  <Ionicons name="lock-closed" size={13} color={Colors.muted} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.espresso} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isOwn ? 'My Rankings' : `${displayName}'s Rankings`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.caramel} size="large" />
        </View>
      ) : (
        <FlatList
          data={[{ key: 'content' }]}
          keyExtractor={i => i.key}
          renderItem={() => (
            <View>
              {renderSection(coffeeRatings, 'Coffee', '☕')}
              {renderSection(matchaRatings, 'Matcha', '🍵')}
              {ratings.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No ratings yet</Text>
                </View>
              )}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.roast },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  section: {
    backgroundColor: Colors.white,
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 10,
    paddingVertical: 8,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.muted,
    paddingHorizontal: 16, paddingVertical: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 11, gap: 12,
  },
  rank: { fontSize: 13, fontWeight: '700', color: Colors.muted, width: 22, textAlign: 'center' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  rowAddr: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  badgeLocked: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.foam, borderWidth: 1.5, borderColor: Colors.milk,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.muted },
});
