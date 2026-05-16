import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CoffeeShop, Rating } from '../lib/types';
import { Colors } from '../lib/colors';
import { formatScore, overallColor, priceString } from '../lib/utils';

interface Props {
  shop: CoffeeShop;
  rating?: Rating | null;
  rank?: number;
  onPress: () => void;
}

export default function ShopCard({ shop, rating, rank, onPress }: Props) {
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
        {rating && (
          <View style={styles.badges}>
            {rating.laptop_friendly && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>💻 Laptop</Text>
              </View>
            )}
            {(rating.wifi_quality ?? 1) >= 3 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>📶 WiFi</Text>
              </View>
            )}
            {rating.vibes >= 8 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>✨ Vibes</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.right}>
        {rating ? (
          <View style={[styles.scoreBadge, { backgroundColor: overallColor(rating.overall) }]}>
            <Text style={styles.scoreText}>{formatScore(rating.overall)}</Text>
          </View>
        ) : (
          <View style={styles.unratedBadge}>
            <Text style={styles.unratedText}>Rate</Text>
          </View>
        )}
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
    borderRadius: 14,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  unratedBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.milk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unratedText: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '600',
  },
});
