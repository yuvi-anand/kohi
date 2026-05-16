import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';
import { DrinkType } from '../../lib/types';
import { useShops } from '../../context/shops';
import { getRating, upsertRating, upsertShop } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { computeOverall, formatScore, overallColor } from '../../lib/utils';

const CRITERIA = [
  { key: 'coffee_quality' as const, label: 'Coffee', emoji: '☕', max: 10 },
  { key: 'vibes' as const,          label: 'Vibes',  emoji: '✨', max: 10 },
  { key: 'seating' as const,        label: 'Seating',emoji: '🪑', max: 5 },
];

type Scores = {
  coffee_quality: number;
  vibes: number;
  seating: number;
};

type DrinkState = {
  scores: Scores;
  wifiGood: boolean;
  pastries: number | null;
  laptopFriendly: boolean;
  notes: string;
};

const DEFAULT_STATE: DrinkState = {
  scores: { coffee_quality: 7, vibes: 7, seating: 3 },
  wifiGood: true,
  pastries: null,
  laptopFriendly: false,
  notes: '',
};

export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { shopById } = useShops();

  const shop = id ? shopById[id] : undefined;

  const [drinkType, setDrinkType] = useState<DrinkType>('coffee');
  const [coffeeState, setCoffeeState] = useState<DrinkState>(DEFAULT_STATE);
  const [matchaState, setMatchaState] = useState<DrinkState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Animation value: 0 = coffee, 1 = matcha
  const animVal = useRef(new Animated.Value(0)).current;
  const [sliderColor, setSliderColor] = useState(Colors.caramel);

  useEffect(() => {
    const id = animVal.addListener(({ value }) => {
      // Interpolate caramel (#C87941) → matcha (#3D7A56)
      const r = Math.round(200 - (200 - 61) * value);
      const g = Math.round(121 + (122 - 121) * value);
      const b = Math.round(65 - (65 - 86) * value);
      setSliderColor(`rgb(${r},${g},${b})`);
    });
    return () => animVal.removeListener(id);
  }, []);

  const accentAnim = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.caramel, Colors.matcha],
  });
  const bgAnim = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.cream, Colors.matchaLight],
  });
  const bodyBgAnim = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.white, '#F7FBF8'],
  });

  // Load both drink types on mount
  useEffect(() => {
    async function prefill() {
      if (!user || !isSupabaseConfigured() || !id) {
        setLoading(false);
        return;
      }
      try {
        const [coffee, matcha] = await Promise.all([
          getRating(user.id, id, 'coffee'),
          getRating(user.id, id, 'matcha'),
        ]);
        if (coffee) setCoffeeState({
          scores: {
            coffee_quality: coffee.coffee_quality,
            vibes: coffee.vibes,
            seating: coffee.seating,
          },
          wifiGood: coffee.wifi_quality >= 3,
          pastries: coffee.pastries ?? null,
          laptopFriendly: coffee.laptop_friendly,
          notes: coffee.notes ?? '',
        });
        if (matcha) setMatchaState({
          scores: {
            coffee_quality: matcha.coffee_quality,
            vibes: matcha.vibes,
            seating: matcha.seating,
          },
          wifiGood: matcha.wifi_quality >= 3,
          pastries: matcha.pastries ?? null,
          laptopFriendly: matcha.laptop_friendly,
          notes: matcha.notes ?? '',
        });
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    prefill();
  }, [user, id]);

  const currentState = drinkType === 'coffee' ? coffeeState : matchaState;
  const setCurrentState = drinkType === 'coffee' ? setCoffeeState : setMatchaState;

  function updateScore(key: keyof Scores, value: number) {
    setCurrentState((prev) => ({ ...prev, scores: { ...prev.scores, [key]: value } }));
  }

  function switchDrinkType(type: DrinkType) {
    if (type === drinkType) return;
    setDrinkType(type);
    Animated.timing(animVal, {
      toValue: type === 'matcha' ? 1 : 0,
      duration: 500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  const overall = computeOverall(
    currentState.scores.coffee_quality,
    currentState.scores.vibes,
    currentState.scores.seating,
    currentState.wifiGood ? 5 : 1,
    currentState.scores.work_friendliness,
    currentState.pastries
  );

  async function handleSave() {
    if (!user || !shop) {
      Alert.alert('Not signed in', 'Sign in to save ratings.');
      return;
    }
    if (!isSupabaseConfigured()) {
      Alert.alert('Not configured', 'Set up Supabase to save ratings.');
      return;
    }
    try {
      setSaving(true);
      await upsertShop(shop);
      await upsertRating({
        user_id: user.id,
        shop_id: shop.id,
        drink_type: drinkType,
        ...currentState.scores,
        wifi_quality: currentState.wifiGood ? 5 : 1,
        work_friendliness: 3,
        pastries: currentState.pastries ?? undefined,
        laptop_friendly: currentState.laptopFriendly,
        overall,
        notes: currentState.notes.trim() || undefined,
        visited_at: new Date().toISOString(),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error saving', e.message);
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.caramel} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Animated.View style={[styles.safeWrapper, { backgroundColor: bgAnim }]}>
      <SafeAreaView style={styles.safeInner}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.espresso} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerLabel}>RATING</Text>
              <Text style={styles.headerShop} numberOfLines={1}>{shop.name}</Text>
            </View>
            <View style={[styles.overallBadge, { backgroundColor: overallColor(overall) }]}>
              <Text style={styles.overallText}>{formatScore(overall)}</Text>
            </View>
          </View>

          {/* Coffee / Matcha toggle */}
          <View style={styles.drinkToggleRow}>
            <TouchableOpacity
              style={[
                styles.drinkBtn,
                drinkType === 'coffee' && { backgroundColor: Colors.caramel },
              ]}
              onPress={() => switchDrinkType('coffee')}
            >
              <Text style={[styles.drinkBtnText, drinkType === 'coffee' && styles.drinkBtnTextActive]}>
                ☕ Coffee
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.drinkBtn,
                drinkType === 'matcha' && { backgroundColor: Colors.matcha },
              ]}
              onPress={() => switchDrinkType('matcha')}
            >
              <Text style={[styles.drinkBtnText, drinkType === 'matcha' && styles.drinkBtnTextActive]}>
                🍵 Matcha
              </Text>
            </TouchableOpacity>
          </View>

          <Animated.ScrollView
            ref={scrollRef}
            style={[styles.body, { backgroundColor: bodyBgAnim }]}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Criteria */}
            {CRITERIA.map((c) => {
              const val = currentState.scores[c.key];
              return (
                <View key={c.key} style={styles.criterionRow}>
                  <View style={styles.criterionMeta}>
                    <Text style={styles.criterionEmoji}>{c.emoji}</Text>
                    <Text style={styles.criterionLabel}>{c.label}</Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={c.max}
                    step={1}
                    value={val}
                    onValueChange={(v) => updateScore(c.key, v)}
                    minimumTrackTintColor={sliderColor}
                    maximumTrackTintColor={Colors.milk}
                    thumbTintColor={sliderColor}
                  />
                  <Animated.Text style={[styles.criterionScore, { color: accentAnim }]}>
                    {val}
                    <Text style={styles.criterionMax}>/{c.max}</Text>
                  </Animated.Text>
                </View>
              );
            })}

            {/* WiFi row */}
            <View style={styles.thumbRow}>
              <Text style={styles.criterionEmoji}>📶</Text>
              <Text style={styles.thumbRowLabel}>Has good WiFi?</Text>
              <View style={styles.thumbBtns}>
                <TouchableOpacity
                  style={[styles.thumbBtn, currentState.wifiGood && { backgroundColor: sliderColor }]}
                  onPress={() => setCurrentState((prev) => ({ ...prev, wifiGood: true }))}
                >
                  <Text style={styles.thumbIcon}>👍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, !currentState.wifiGood && styles.thumbBtnActiveDown]}
                  onPress={() => setCurrentState((prev) => ({ ...prev, wifiGood: false }))}
                >
                  <Text style={styles.thumbIcon}>👎</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pastries row */}
            <View style={styles.thumbRow}>
              <Text style={styles.criterionEmoji}>🥐</Text>
              <Text style={styles.thumbRowLabel}>Pastries?</Text>
              <View style={styles.thumbBtns}>
                <TouchableOpacity
                  style={[styles.thumbBtn, currentState.pastries != null && { backgroundColor: sliderColor }]}
                  onPress={() => setCurrentState((prev) => ({ ...prev, pastries: prev.pastries != null ? prev.pastries : 3 }))}
                >
                  <Text style={styles.thumbIcon}>👍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, currentState.pastries == null && styles.thumbBtnActiveDown]}
                  onPress={() => setCurrentState((prev) => ({ ...prev, pastries: null }))}
                >
                  <Text style={styles.thumbIcon}>👎</Text>
                </TouchableOpacity>
              </View>
            </View>
            {currentState.pastries != null && (
              <View style={styles.criterionRow}>
                <View style={{ width: 90 }} />
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={5}
                  step={1}
                  value={currentState.pastries}
                  onValueChange={(v) => setCurrentState((prev) => ({ ...prev, pastries: v }))}
                  minimumTrackTintColor={sliderColor}
                  maximumTrackTintColor={Colors.milk}
                  thumbTintColor={sliderColor}
                />
                <Animated.Text style={[styles.criterionScore, { color: accentAnim }]}>
                  {currentState.pastries}
                  <Text style={styles.criterionMax}>/5</Text>
                </Animated.Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Laptop toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleEmoji}>💻</Text>
              <Text style={styles.toggleLabel}>Laptop Friendly</Text>
              <Switch
                value={currentState.laptopFriendly}
                onValueChange={(v) => setCurrentState((prev) => ({ ...prev, laptopFriendly: v }))}
                trackColor={{ false: Colors.milk, true: sliderColor }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.divider} />

            {/* Notes */}
            <View style={styles.notesRow}>
              <Text style={styles.toggleEmoji}>📝</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Notes (optional)"
                placeholderTextColor={Colors.muted}
                value={currentState.notes}
                onChangeText={(v) => setCurrentState((prev) => ({ ...prev, notes: v }))}
                returnKeyType="done"
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                }}
              />
            </View>
          </Animated.ScrollView>

          {/* Save button */}
          <View style={styles.footer}>
            <Animated.View style={[styles.saveBtn, { backgroundColor: accentAnim }, saving && styles.saveBtnDisabled]}>
              <TouchableOpacity style={styles.saveBtnInner} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Rating</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeWrapper: { flex: 1 },
  safeInner: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1, backgroundColor: Colors.cream },
  errorText: { color: Colors.muted, fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.foam,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  headerLabel: { fontSize: 10, fontWeight: '800', color: Colors.muted, letterSpacing: 1 },
  headerShop: { fontSize: 15, fontWeight: '800', color: Colors.espresso },
  overallBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  overallText: { color: Colors.white, fontSize: 13, fontWeight: '800' },

  drinkToggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.milk,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  drinkBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  drinkBtnText: { fontSize: 14, fontWeight: '700', color: Colors.muted },
  drinkBtnTextActive: { color: Colors.white },

  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },

  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  criterionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    gap: 8,
  },
  criterionEmoji: { fontSize: 22 },
  criterionLabel: { fontSize: 14, fontWeight: '700', color: Colors.espresso },
  slider: { flex: 1, height: 40 },
  criterionScore: { fontSize: 18, fontWeight: '800', width: 42, textAlign: 'right' },
  criterionMax: { fontSize: 11, fontWeight: '500', color: Colors.muted },

  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  thumbRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.espresso,
  },
  thumbBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  thumbBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.foam,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.milk,
  },
  thumbBtnActiveDown: {
    backgroundColor: '#E8554E',
    borderColor: '#E8554E',
  },
  thumbIcon: { fontSize: 20 },

  divider: { height: 1, backgroundColor: Colors.foam, marginVertical: 10 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12,
  },
  toggleEmoji: { fontSize: 22 },
  toggleLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.espresso },

  notesRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12,
  },
  notesInput: {
    flex: 1, fontSize: 15, color: Colors.espresso,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.milk,
  },

  footer: {
    padding: 16, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.milk,
  },
  saveBtn: { borderRadius: 14, overflow: 'hidden' },
  saveBtnInner: { paddingVertical: 15, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
