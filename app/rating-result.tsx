import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/colors';
import { formatScore, overallColor } from '../lib/utils';

export default function RatingResultScreen() {
  const router = useRouter();
  const { shopName, overall, shopId } = useLocalSearchParams<{
    shopName: string;
    overall: string;
    shopId: string;
  }>();

  const score = parseFloat(overall ?? '0');
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

          <Animated.View style={[styles.scoreBadge, { backgroundColor: overallColor(score), transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.scoreText}>{formatScore(score)}</Text>
            <Text style={styles.scoreDenom}>/10</Text>
          </Animated.View>

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
    marginBottom: 48,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  scoreText: { fontSize: 52, fontWeight: '800', color: Colors.white, lineHeight: 56 },
  scoreDenom: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
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
