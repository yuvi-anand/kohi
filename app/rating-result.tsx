import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/colors';
import { formatScore, overallColor, NORMALIZE_THRESHOLD } from '../lib/utils';

export default function RatingResultScreen() {
  const router = useRouter();
  const { shopName, overall, shopId, ratingsAfter, drinkType } = useLocalSearchParams<{
    shopName: string;
    overall: string;
    shopId: string;
    ratingsAfter: string;
    drinkType: string;
  }>();

  const score = parseFloat(overall ?? '0');
  const countAfter = parseInt(ratingsAfter ?? '0', 10);
  const scoresUnlocked = countAfter >= NORMALIZE_THRESHOLD;
  const justUnlocked = countAfter === NORMALIZE_THRESHOLD;
  const remaining = NORMALIZE_THRESHOLD - countAfter;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Text style={styles.savedLabel}>Rating saved</Text>
          <Text style={styles.shopName} numberOfLines={2}>{shopName}</Text>

          {scoresUnlocked ? (
            <Animated.View style={[styles.scoreBadge, { backgroundColor: overallColor(score), transform: [{ scale: scaleAnim }] }]}>
              {justUnlocked && <Text style={styles.unlockBanner}>🎉 Scores unlocked!</Text>}
              <Text style={styles.scoreText}>{formatScore(score)}</Text>
              <Text style={styles.scoreDenom}>/10</Text>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.lockedBadge, { transform: [{ scale: scaleAnim }] }]}>
              <Ionicons name="lock-closed" size={40} color={Colors.muted} />
              <Text style={styles.lockedCount}>{countAfter}/{NORMALIZE_THRESHOLD}</Text>
            </Animated.View>
          )}

          {!scoresUnlocked && (
            <Text style={styles.lockedCaption}>
              Rate {remaining} more {drinkType === 'matcha' ? 'matcha' : 'coffee'} shop{remaining !== 1 ? 's' : ''} to unlock your scores
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => router.replace(`/shop/${shopId}`)}
            >
              <Ionicons name="storefront-outline" size={16} color={Colors.caramel} />
              <Text style={styles.viewBtnText}>View Shop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.replace('/(tabs)/')}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  content: { alignItems: 'center', width: '100%' },
  savedLabel: {
    fontSize: 13, fontWeight: '600', color: Colors.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },
  shopName: {
    fontSize: 26, fontWeight: '700', color: Colors.espresso,
    textAlign: 'center', marginBottom: 40, lineHeight: 32,
  },
  scoreBadge: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  unlockBanner: {
    position: 'absolute', top: -28,
    fontSize: 13, fontWeight: '700', color: Colors.caramel,
  },
  scoreText: { fontSize: 52, fontWeight: '800', color: Colors.white, lineHeight: 56 },
  scoreDenom: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  lockedBadge: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: Colors.foam,
    borderWidth: 2, borderColor: Colors.milk,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    gap: 4,
  },
  lockedCount: {
    fontSize: 14, fontWeight: '700', color: Colors.muted,
  },
  lockedCaption: {
    fontSize: 13, color: Colors.muted, fontWeight: '500',
    textAlign: 'center', marginBottom: 32, lineHeight: 18,
  },
  actions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 16 },
  viewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.caramel,
  },
  viewBtnText: { fontSize: 15, fontWeight: '600', color: Colors.caramel },
  doneBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 8,
    backgroundColor: Colors.caramel, alignItems: 'center',
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
