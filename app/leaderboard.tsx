import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/colors';
import { getLeaderboard } from '../lib/api';
import { LeaderboardEntry } from '../lib/types';
import { formatScore, overallColor } from '../lib/utils';
import { isSupabaseConfigured } from '../lib/supabase';

const RANK_COLORS = ['#C9B037', '#B4B4B4', '#AD8A56'];
const RANK_ICONS = ['trophy', 'medal', 'ribbon'] as const;

export default function LeaderboardScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError('Supabase not configured.');
      return;
    }
    getLeaderboard()
      .then(setEntries)
      .catch((e) => setError(e.message ?? 'Could not load leaderboard.'))
      .finally(() => setLoading(false));
  }, []);

  function renderItem({ item, index }: { item: LeaderboardEntry; index: number }) {
    const rank = index + 1;
    const initial = (item.name?.[0] ?? item.username?.[0] ?? '?').toUpperCase();
    const rankColor = RANK_COLORS[index] ?? Colors.muted;
    const displayName = item.name ?? (item.username ? `@${item.username}` : 'Anonymous');

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/user/${item.id}`)}
        activeOpacity={0.75}
      >
        <View style={styles.rankWrap}>
          {rank <= 3 ? (
            <Ionicons name={RANK_ICONS[rank - 1]} size={20} color={rankColor} />
          ) : (
            <Text style={styles.rankNum}>{rank}</Text>
          )}
        </View>

        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, rank <= 3 && { borderColor: rankColor, borderWidth: 2 }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
          {item.username && item.name ? (
            <Text style={styles.username}>@{item.username}</Text>
          ) : null}
          <Text style={styles.ratingCount}>
            {item.rating_count} rating{item.rating_count !== 1 ? 's' : ''}
          </Text>
        </View>

        {item.top_overall != null ? (
          <View style={[styles.scoreBadge, { backgroundColor: overallColor(item.top_overall) }]}>
            <Text style={styles.scoreText}>{formatScore(item.top_overall)}</Text>
            <Text style={styles.scoreSubLabel}>top</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.espresso} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="trophy" size={18} color={Colors.caramel} />
          <Text style={styles.title}>Leaderboard</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.caramel} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="trophy-outline" size={48} color={Colors.milk} />
          <Text style={styles.emptyText}>No ratings yet</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>TOP 20 RATERS</Text>
            </View>
          }
        />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.roast },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: Colors.muted, textAlign: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 15, color: Colors.muted, fontWeight: '500' },

  listHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  listHeaderText: { fontSize: 11, fontWeight: '700', color: Colors.muted, letterSpacing: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rankWrap: { width: 28, alignItems: 'center', justifyContent: 'center' },
  rankNum: { fontSize: 14, fontWeight: '700', color: Colors.muted },

  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.caramel,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.white },

  info: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '700', color: Colors.espresso },
  username: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  ratingCount: { fontSize: 12, color: Colors.caramel, fontWeight: '500', marginTop: 2 },

  scoreBadge: {
    alignItems: 'center', justifyContent: 'center',
    width: 44, height: 44, borderRadius: 22,
    gap: 0,
  },
  scoreText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  scoreSubLabel: { fontSize: 8, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.3 },

  separator: { height: 1, backgroundColor: Colors.foam, marginLeft: 80 },
});
