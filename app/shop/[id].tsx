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
  Image,
  Linking,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CoffeeShop, Rating, ShopStats } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { useShops } from '../../context/shops';
import {
  getRating,
  getBookmarks,
  addBookmark,
  removeBookmark,
  upsertShop,
  getShopStats,
} from '../../lib/api';
import { useAuth } from '../../context/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import RatingBar from '../../components/RatingBar';
import { formatScore, overallColor, priceString } from '../../lib/utils';

const CRITERIA: { key: keyof Rating; label: string; emoji: string; max: number }[] = [
  { key: 'coffee_quality', label: 'Coffee Quality', emoji: '☕', max: 10 },
  { key: 'vibes', label: 'Vibes', emoji: '✨', max: 10 },
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
  const [shopStats, setShopStats] = useState<ShopStats | null>(null);
  const [hoursExpanded, setHoursExpanded] = useState(false);

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
      getShopStats(id).then(setShopStats).catch(() => {});
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

  function handleNavigate() {
    const hasCoords = shop?.lat && shop?.lng;
    const appleDest = hasCoords
      ? `maps://?daddr=${shop!.lat},${shop!.lng}`
      : `maps://?q=${encodeURIComponent(shop!.address)}`;
    const googleDest = hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${shop!.lat},${shop!.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop!.address)}`;

    Alert.alert('Navigate to', shop!.name, [
      { text: 'Apple Maps', onPress: () => Linking.openURL(appleDest) },
      { text: 'Google Maps', onPress: () => Linking.openURL(googleDest) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleShare() {
    Share.share({
      message: `Check out ${shop!.name} on Kōhī!\n${shop!.address}`,
      title: shop!.name,
    });
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
          {shop.photo_url && (
            <Image source={{ uri: shop.photo_url }} style={styles.heroImage} resizeMode="cover" />
          )}
          <View style={styles.heroOverlay} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={Colors.white} />
          </TouchableOpacity>
          {!shop.photo_url && (
            <Text style={styles.heroInitial}>{shop.name[0].toUpperCase()}</Text>
          )}
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
              {shop.hours && shop.hours.length > 0 && (
                <TouchableOpacity
                  style={styles.hoursRow}
                  onPress={() => setHoursExpanded((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={13} color={Colors.muted} />
                  <Text style={styles.hoursToggle}>
                    {hoursExpanded ? 'Hide hours' : 'Show hours'}
                  </Text>
                  <Ionicons name={hoursExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.muted} />
                </TouchableOpacity>
              )}
              {hoursExpanded && shop.hours && (
                <View style={styles.hoursBox}>
                  {shop.hours.map((line: string, i: number) => (
                    <Text key={i} style={styles.hoursLine}>{line}</Text>
                  ))}
                </View>
              )}
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
              <Ionicons name={rating ? 'create' : 'star'} size={18} color={Colors.caramel} />
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

            <TouchableOpacity style={styles.actionBtn} onPress={handleNavigate}>
              <Ionicons name="navigate-outline" size={18} color={Colors.caramel} />
              <Text style={styles.actionText}>Navigate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={Colors.caramel} />
              <Text style={styles.actionText}>Share</Text>
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

            {shopStats && shopStats.rating_count > 1 && (
              <View style={styles.globalStatsBox}>
                <Text style={styles.globalStatsTitle}>Community ({shopStats.rating_count} ratings)</Text>
                <View style={styles.globalStatsRow}>
                  <View style={styles.globalStat}>
                    <Text style={styles.globalStatVal}>{shopStats.avg_overall}</Text>
                    <Text style={styles.globalStatLabel}>Avg Overall</Text>
                  </View>
                  <View style={styles.globalStat}>
                    <Text style={styles.globalStatVal}>{shopStats.avg_coffee}</Text>
                    <Text style={styles.globalStatLabel}>Coffee</Text>
                  </View>
                  <View style={styles.globalStat}>
                    <Text style={styles.globalStatVal}>{shopStats.avg_vibes}</Text>
                    <Text style={styles.globalStatLabel}>Vibes</Text>
                  </View>
                  {rating && (
                    <View style={[styles.globalStat, styles.globalStatHighlight]}>
                      <Text style={[styles.globalStatVal, { color: Colors.caramel }]}>
                        {rating.overall > shopStats.avg_overall ? '+' : ''}{(rating.overall - shopStats.avg_overall).toFixed(1)}
                      </Text>
                      <Text style={styles.globalStatLabel}>vs You</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.laptopRow}>
              <Text style={styles.laptopLabel}>Good WiFi</Text>
              <View style={[styles.laptopBadge, {
                backgroundColor: rating.wifi_quality >= 4 ? Colors.success : rating.wifi_quality <= 2 ? Colors.milk : Colors.foam
              }]}>
                <Text style={[styles.laptopBadgeText, {
                  color: rating.wifi_quality >= 4 ? Colors.white : Colors.muted
                }]}>
                  {rating.wifi_quality >= 4 ? 'Yes' : rating.wifi_quality <= 2 ? 'No' : '?'}
                </Text>
              </View>
            </View>

            <View style={[styles.laptopRow, { marginTop: 10 }]}>
              <Text style={styles.laptopLabel}>Enough Seating</Text>
              <View style={[styles.laptopBadge, {
                backgroundColor: rating.seating >= 4 ? Colors.success : rating.seating <= 2 ? Colors.milk : Colors.foam
              }]}>
                <Text style={[styles.laptopBadgeText, {
                  color: rating.seating >= 4 ? Colors.white : Colors.muted
                }]}>
                  {rating.seating >= 4 ? 'Yes' : rating.seating <= 2 ? 'No' : '?'}
                </Text>
              </View>
            </View>

            <View style={[styles.laptopRow, { marginTop: 10 }]}>
              <Text style={styles.laptopLabel}>Pastries</Text>
              {rating.pastries != null ? (
                <View style={[styles.laptopBadge, { backgroundColor: Colors.foam }]}>
                  <Text style={[styles.laptopBadgeText, { color: Colors.muted }]}>{rating.pastries}/5</Text>
                </View>
              ) : (
                <Text style={[styles.laptopBadgeText, { color: Colors.muted }]}>N/A</Text>
              )}
            </View>

            <View style={[styles.laptopRow, { marginTop: 10 }]}>
              <Text style={styles.laptopLabel}>Laptop Friendly</Text>
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
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
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
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
  },
  infoCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 8,
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.caramel,
  },
  actionBtnActive: {
    backgroundColor: Colors.caramel,
    borderColor: Colors.caramel,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.caramel,
  },
  actionTextActive: {
    color: Colors.white,
  },
  ratingCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 8,
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
    borderRadius: 4,
  },
  laptopBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesBox: {
    marginTop: 14,
    backgroundColor: Colors.foam,
    borderRadius: 5,
    padding: 12,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
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
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  hoursToggle: { fontSize: 12, color: Colors.muted },
  hoursBox: { marginTop: 6, gap: 2 },
  hoursLine: { fontSize: 12, color: Colors.muted, lineHeight: 18 },
  globalStatsBox: {
    backgroundColor: Colors.foam, borderRadius: 6, padding: 12, marginBottom: 14,
  },
  globalStatsTitle: { fontSize: 11, fontWeight: '700', color: Colors.muted, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  globalStatsRow: { flexDirection: 'row', gap: 8 },
  globalStat: { flex: 1, alignItems: 'center' },
  globalStatHighlight: { borderLeftWidth: 1, borderLeftColor: Colors.milk },
  globalStatVal: { fontSize: 16, fontWeight: '700', color: Colors.espresso },
  globalStatLabel: { fontSize: 10, color: Colors.muted, marginTop: 2 },
  unratedCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 8,
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
    fontWeight: '500',
    color: Colors.muted,
    marginBottom: 20,
  },
  rateBtn: {
    backgroundColor: Colors.caramel,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  rateBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
