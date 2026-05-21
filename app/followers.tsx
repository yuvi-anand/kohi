import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/colors';
import { UserResult } from '../lib/types';
import { followUser, unfollowUser } from '../lib/api';
import { useAuth } from '../context/auth';
import { supabase } from '../lib/supabase';

async function fetchFollowers(userId: string, currentUserId: string): Promise<UserResult[]> {
  const { data: followRows, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId);
  if (error) throw error;
  const ids = (followRows ?? []).map((f) => f.follower_id);
  if (ids.length === 0) return [];
  return buildUserResults(ids, currentUserId);
}

async function fetchFollowing(userId: string, currentUserId: string): Promise<UserResult[]> {
  const { data: followRows, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) throw error;
  const ids = (followRows ?? []).map((f) => f.following_id);
  if (ids.length === 0) return [];
  return buildUserResults(ids, currentUserId);
}

async function buildUserResults(ids: string[], currentUserId: string): Promise<UserResult[]> {
  const [{ data: profiles }, { data: ratingRows }, { data: myFollows }] = await Promise.all([
    supabase.from('profiles').select('id, username, name, bio').in('id', ids),
    supabase.from('ratings').select('user_id').in('user_id', ids),
    supabase.from('follows').select('following_id').eq('follower_id', currentUserId).in('following_id', ids),
  ]);

  const followingSet = new Set((myFollows ?? []).map((f) => f.following_id));
  const countMap: Record<string, number> = {};
  for (const r of (ratingRows ?? [])) countMap[r.user_id] = (countMap[r.user_id] ?? 0) + 1;

  return (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    name: p.name,
    bio: p.bio,
    rating_count: countMap[p.id] ?? 0,
    is_following: followingSet.has(p.id),
  }));
}

export default function FollowersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { userId, type } = useLocalSearchParams<{ userId: string; type: 'followers' | 'following' }>();

  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const isFollowers = type === 'followers';
  const title = isFollowers ? 'Followers' : 'Following';

  useEffect(() => {
    if (!userId || !user) return;
    setLoading(true);
    const fetch = isFollowers ? fetchFollowers : fetchFollowing;
    fetch(userId, user.id)
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [userId, type, user]);

  async function toggleFollow(item: UserResult) {
    if (!user) return;
    setPendingIds((prev) => new Set(prev).add(item.id));
    try {
      if (item.is_following) {
        await unfollowUser(user.id, item.id);
      } else {
        await followUser(user.id, item.id);
      }
      setUsers((prev) =>
        prev.map((r) => r.id === item.id ? { ...r, is_following: !r.is_following } : r)
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPendingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  }

  const initials = (item: UserResult) =>
    (item.name?.[0] ?? item.username?.[0] ?? '?').toUpperCase();
  const displayName = (item: UserResult) =>
    item.name || (item.username ? `@${item.username}` : 'Unknown');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.espresso} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.caramel} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/user/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item)}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{displayName(item)}</Text>
                {item.username && item.name && (
                  <Text style={styles.username}>@{item.username}</Text>
                )}
                <Text style={styles.meta}>{item.rating_count} ratings</Text>
              </View>
              {user && item.id !== user.id && (
                <TouchableOpacity
                  style={[styles.followBtn, item.is_following && styles.followBtnActive]}
                  onPress={() => toggleFollow(item)}
                  disabled={pendingIds.has(item.id)}
                >
                  {pendingIds.has(item.id) ? (
                    <ActivityIndicator
                      size="small"
                      color={item.is_following ? Colors.white : Colors.caramel}
                    />
                  ) : (
                    <Text style={[styles.followBtnText, item.is_following && styles.followBtnTextActive]}>
                      {item.is_following ? 'Following' : 'Follow'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.milk} />
              <Text style={styles.emptyText}>
                {isFollowers ? 'No followers yet' : 'Not following anyone yet'}
              </Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.milk,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.roast },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.white,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.caramel, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.espresso },
  username: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  meta: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  followBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.caramel, minWidth: 90, alignItems: 'center',
  },
  followBtnActive: { backgroundColor: Colors.caramel },
  followBtnText: { fontSize: 13, fontWeight: '600', color: Colors.caramel },
  followBtnTextActive: { color: Colors.white },
  sep: { height: 1, backgroundColor: Colors.foam, marginLeft: 72 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: Colors.muted, fontWeight: '500' },
});
