import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CoffeeShop, Rating } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { useShops } from '../../context/shops';
import {
  getRating,
  getBookmarks,
  addBookmark,
  removeBookmark,
  upsertShop,
} from '../../lib/api';
import { useAuth } from '../../context/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import RatingBar from '../../components/RatingBar';
import { formatScore, overallColor, priceString } from '../../lib/utils';

const CRITERIA: { key: keyof Rating; label: string; emoji: string; max: number }[] = [
  { key: 'coffee_quality', label: 'Coffee Quality', emoji: '☕', max: 10 },
  { key: 'vibes', label: 'Vibes', emoji: '✨', max: 10 },
  { key: 'seating', label: 'Seating', emoji: '🪑', max: 5 },
];

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { shopById } = useShops();

  const shop: CoffeeShop | undefined = id ? shopById[id] : undefined;

  const [rating, setRating] = useState<Rating | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured() || !id) return;
    try {
      setLoading(true);
      const [r, bookmarks] = await Promise.all([
        getRating(user.id, id),
        getBookmarks(user.id),
      ]);
      setRating(r);
      setBookmarked(bookmarks.some((b) => b.shop_id === id));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleBookmark() {
    if (!user || !shop) return;
    if (!isSupabaseConfigured()) {
      Alert.alert('Not configured', 'Set up Supabase to save bookmarks.');
      return;
    }
    try {
      setBookmarkLoading(true);
      await upsertShop(shop);
      if (bookmarked) {
        await removeBookmark(user.id, shop.id);
        setBookmarked(false);
      } else {
        await addBookmark(user.id, shop.id);
        setBookmarked(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBookmarkLoading(false);
    }
  }

  if (!shop) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Shop not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header strip */}
        <View style={[styles.hero, { backgroundColor: heroColor(shop.name) }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.heroInitial}>{shop.name[0].toUpperCase()}</Text>
        </View>

        {/* Info section */}
        <View style={styles.infoCard}>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{shop.name}</Text>
              <Text style={styles.address}>
                {shop.neighborhood ? `${shop.neighborhood}  ·  ` : ''}
                {shop.address}
                {shop.price_level ? `  ·  ${priceString(shop.price_level)}` : ''}
              </Text>
            </View>
            {rating && (
              <View
                style={[
                  styles.overallBadge,
                  { backgroundColor: overallColor(rating.overall) },
                ]}
              >
                <Text style={styles.overallText}>{formatScore(rating.overall)}</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/rate/${shop.id}`)}
            >
              <Ionicons
                name={rating ? 'create' : 'star'}
                size={18}
                color={Colors.caramel}
              />
              <Text style={styles.actionText}>{rating ? 'Edit Rating' : 'Rate'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, bookmarked && styles.actionBtnActive]}
              onPress={handleToggleBookmark}
              disabled={bookmarkLoading}
            >
              {bookmarkLoading ? (
                <ActivityIndicator size="small" color={Colors.caramel} />
              ) : (
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={bookmarked ? Colors.white : Colors.caramel}
                />
              )}
              <Text style={[styles.actionText, bookmarked && styles.actionTextActive]}>
                {bookmarked ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Rating breakdown */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.caramel} />
          </View>
        ) : rating ? (
          <View style={styles.ratingCard}>
            <Text style={styles.sectionTitle}>Your Ratings</Text>

            {CRITERIA.map((c) => (
              <RatingBar
                key={c.key}
                label={c.label}
                emoji={c.emoji}
                score={rating[c.key] as number}
                maxScore={c.max}
              />
            ))}

            <View style={styles.divider} />

            <View style={styles.laptopRow}>
              <Text style={styles.laptopLabel}>📶  Good WiFi</Text>
              <View style={[styles.laptopBadge, { backgroundColor: (rating.wifi_quality ?? 1) >= 3 ? Colors.success : Colors.milk }]}>
                <Text style={[styles.laptopBadgeText, { color: (rating.wifi_quality ?? 1) >= 3 ? Colors.white : Colors.muted }]}>
                  {(rating.wifi_quality ?? 1) >= 3 ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            <View style={[styles.laptopRow, { marginTop: 10 }]}>
              <Text style={styles.laptopLabel}>💻  Laptop Friendly</Text>
              <View style={[styles.laptopBadge, { backgroundColor: rating.laptop_friendly ? Colors.success : Colors.milk }]}>
                <Text style={[styles.laptopBadgeText, { color: rating.laptop_friendly ? Colors.white : Colors.muted }]}>
                  {rating.laptop_friendly ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            {rating.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{rating.notes}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.unratedCard}>
            <Text style={styles.unratedEmoji}>☕</Text>
            <Text style={styles.unratedTitle}>Not rated yet</Text>
            <TouchableOpacity
              style={styles.rateBtn}
              onPress={() => router.push(`/rate/${shop.id}`)}
            >
              <Text style={styles.rateBtnText}>Rate this shop</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function heroColor(name: string): string {
  const palette = [
    '#2C1810', '#8B7355', '#C87941', '#4E6D6B',
    '#5E4B3B', '#7B6B55', '#3D5A57', '#6B4C3B',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    color: Colors.muted,
    fontSize: 15,
  },
  hero: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitial: {
    fontSize: 64,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.3)',
  },
  infoCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.espresso,
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 18,
  },
  overallBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  overallText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.caramel,
  },
  actionBtnActive: {
    backgroundColor: Colors.caramel,
    borderColor: Colors.caramel,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.caramel,
  },
  actionTextActive: {
    color: Colors.white,
  },
  ratingCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.espresso,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.milk,
    marginVertical: 14,
  },
  laptopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  laptopLabel: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '500',
  },
  laptopBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  laptopBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  notesBox: {
    marginTop: 14,
    backgroundColor: Colors.foam,
    borderRadius: 10,
    padding: 12,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    color: Colors.espresso,
    lineHeight: 20,
  },
  unratedCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  unratedEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  unratedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.muted,
    marginBottom: 20,
  },
  rateBtn: {
    backgroundColor: Colors.caramel,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  rateBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
