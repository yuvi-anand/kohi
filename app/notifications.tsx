import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/colors';
import { AppNotification } from '../lib/types';
import { getNotifications, markNotificationsRead } from '../lib/api';
import { useAuth } from '../context/auth';
import { timeAgo } from '../lib/utils';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      getNotifications(user.id)
        .then((data) => {
          setNotifications(data);
          // Mark all as read after fetching
          markNotificationsRead(user.id).catch(() => {});
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [user])
  );

  function renderItem({ item }: { item: AppNotification }) {
    const actorLabel = item.actor_display_name
      ?? (item.actor_username ? `@${item.actor_username}` : 'Someone');

    return (
      <TouchableOpacity
        style={[styles.row, !item.read && styles.rowUnread]}
        activeOpacity={0.75}
        onPress={() => item.actor_id && router.push(`/user/${item.actor_id}`)}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="person-add" size={18} color={Colors.caramel} />
        </View>
        <View style={styles.body}>
          <Text style={styles.text}>
            <Text style={styles.actor}>{actorLabel}</Text>
            {' started following you'}
          </Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.espresso} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.caramel} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={44} color={Colors.milk} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>When someone follows you, you'll see it here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.milk,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.espresso },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 10, padding: 14, gap: 12,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  rowUnread: {
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F5E1CC',
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.foam,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1 },
  text: { fontSize: 14, color: Colors.espresso, lineHeight: 19 },
  actor: { fontWeight: '700' },
  time: { fontSize: 11, color: Colors.muted, marginTop: 3 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.caramel, flexShrink: 0,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.espresso },
  emptyText: { fontSize: 13, color: Colors.muted, textAlign: 'center', paddingHorizontal: 40 },
});
