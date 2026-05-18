import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/colors';
import { UserResult } from '../lib/types';
import { searchUsers, followUser, unfollowUser } from '../lib/api';
import { useAuth } from '../context/auth';

export default function FindFriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const search = useCallback(async (q: string) => {
    if (!user || q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      setResults(await searchUsers(q.trim(), user.id));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  async function toggleFollow(item: UserResult) {
    if (!user) return;
    setPendingIds((prev) => new Set(prev).add(item.id));
    try {
      if (item.is_following) {
        await unfollowUser(user.id, item.id);
      } else {
        await followUser(user.id, item.id);
      }
      setResults((prev) =>
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
        <Text style={styles.title}>Find Friends</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={Colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or @username"
          placeholderTextColor={Colors.muted}
          value={query}
          onChangeText={(t) => { setQuery(t); search(t); }}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator size="small" color={Colors.muted} />}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
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
            <TouchableOpacity
              style={[styles.followBtn, item.is_following && styles.followBtnActive]}
              onPress={() => toggleFollow(item)}
              disabled={pendingIds.has(item.id)}
            >
              {pendingIds.has(item.id) ? (
                <ActivityIndicator size="small" color={item.is_following ? Colors.white : Colors.caramel} />
              ) : (
                <Text style={[styles.followBtnText, item.is_following && styles.followBtnTextActive]}>
                  {item.is_following ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          query.length >= 2 && !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No users found for "{query}"</Text>
            </View>
          ) : query.length < 2 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.milk} />
              <Text style={styles.emptyTitle}>Find people you know</Text>
              <Text style={styles.emptyText}>Search by name or username</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.milk,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.roast },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, marginHorizontal: 16, marginVertical: 12,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.milk,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.espresso },
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
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.espresso, marginTop: 8 },
  emptyText: { fontSize: 14, color: Colors.muted },
});
