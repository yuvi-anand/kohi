import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CoffeeShop, Rating, ShopStats } from '../lib/types';
import { Colors } from '../lib/colors';
import { formatScore, overallColor, priceString, getClosingSoon } from '../lib/utils';

interface Props {
  shop: CoffeeShop;
  rating?: Rating | null;
  shopStats?: ShopStats | null;
  distanceMi?: number | null;
  rank?: number;
  onPress: () => void;
}

export default function ShopCard({ shop, rating, shopStats, distanceMi, rank, onPress }: Props) {
  // Determine what to show in the right badge:
  // 1. User's personal score if rated
  // 2. Community avg if available
  // 3. Empty neutral circle
  const displayScore = rating?.overall ?? shopStats?.avg_overall ?? null;
  const isPersonal = rating != null;
  const closingSoon = getClosingSoon(shop.hours, shop.open_now);
  const reviewCount = shopStats?.rating_count ?? 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.left}>
        {rank != null && (
          <Text style={styles.rank}>{rank}</Text>
        )}
        <View style={[styles.avatar, { backgroundColor: avatarColor(shop.name) }]}>
          <Text style={styles.avatarText}>{shop.name[0].toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
        <Text style={styles.neighborhood} numberOfLines={1}>
          {shop.neighborhood ?? shop.address}
          {shop.price_level ? `  ${priceString(shop.price_level)}` : ''}
        </Text>
        {distanceMi != null && (
          <Text style={styles.distance}>{distanceMi.toFixed(1)} mi away</Text>
        )}
        {closingSoon && (
          <Text style={[styles.closingSoon, closingSoon.urgent && styles.closingSoonUrgent]}>
            {closingSoon.label}
          </Text>
        )}
        {rating && (
          <View style={styles.badges}>
            {rating.laptop_friendly && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Laptop</Text>
              </View>
            )}
            {(rating.wifi_quality ?? 1) >= 4 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>WiFi</Text>
              </View>
            )}
            {rating.vibes >= 8 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Vibes</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.right}>
        <View style={{ position: 'relative' }}>
          {displayScore != null ? (
            <View style={[styles.scoreBadge, { backgroundColor: overallColor(displayScore) }, !isPersonal && styles.communityBadge]}>
              <Text style={styles.scoreText}>{formatScore(displayScore)}</Text>
              {!isPersonal && <Text style={styles.communityLabel}>avg</Text>}
            </View>
          ) : (
            <View style={styles.emptyBadge}>
              <Text style={styles.emptyText}>—</Text>
            </View>
          )}
          {reviewCount > 0 && (
            <View style={styles.countBubble}>
              <Text style={styles.countText}>{reviewCount > 99 ? '99+' : reviewCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function avatarColor(name: string): string {
  const palette = [
    '#C87941', '#8B7355', '#D4A96A', '#2C1810',
    '#4E9F6A', '#6B8E9F', '#9F6B7E', '#7E9F6B',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  rank: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
    width: 20,
    textAlign: 'center',
    marginRight: 6,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  middle: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.espresso,
  },
  neighborhood: {
    fontSize: 12,
    color: Colors.muted,
  },
  distance: {
    fontSize: 11,
    color: Colors.caramel,
    fontWeight: '500',
  },
  closingSoon: {
    fontSize: 11,
    color: '#C87941',
    fontWeight: '600',
  },
  closingSoonUrgent: {
    color: '#D4463B',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  badge: {
    backgroundColor: Colors.foam,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    color: Colors.muted,
  },
  right: {
    marginLeft: 8,
  },
  scoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityBadge: {
    opacity: 0.75,
  },
  scoreText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  communityLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 8,
    fontWeight: '500',
  },
  emptyBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.milk,
    backgroundColor: Colors.foam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.milk,
    fontWeight: '600',
  },
  countBubble: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    backgroundColor: Colors.espresso,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  countText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
  },
});
