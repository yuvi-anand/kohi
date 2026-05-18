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

// Per-drink: only the quality score differs between coffee and matcha
type DrinkQuality = { coffee_quality: number };

// Shared: everything else is about the shop, not the drink
type SharedState = {
  vibes: number;
  seating: number;
  wifiGood: boolean | null;
  pastries: number | null;
  laptopFriendly: boolean;
  notes: string;
};

const SHARED_CRITERIA = [
  { key: 'vibes' as const,   label: 'Vibes',   icon: 'sunny-outline' as const,   max: 10 },
  { key: 'seating' as const, label: 'Seating', icon: 'people-outline' as const,  max: 5 },
];

const DEFAULT_QUALITY: DrinkQuality = { coffee_quality: 7 };
const DEFAULT_SHARED: SharedState = {
  vibes: 7,
  seating: 3,
  wifiGood: null,
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
  const [coffeeQuality, setCoffeeQuality] = useState<DrinkQuality>(DEFAULT_QUALITY);
  const [matchaQuality, setMatchaQuality] = useState<DrinkQuality>(DEFAULT_QUALITY);
  const [shared, setShared] = useState<SharedState>(DEFAULT_SHARED);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Animation value: 0 = coffee, 1 = matcha
  const animVal = useRef(new Animated.Value(0)).current;
  const [sliderColor, setSliderColor] = useState(Colors.caramel);

  useEffect(() => {
    const listenerId = animVal.addListener(({ value }) => {
      const r = Math.round(200 - (200 - 61) * value);
      const g = Math.round(121 + (122 - 121) * value);
      const b = Math.round(65 - (65 - 86) * value);
      setSliderColor(`rgb(${r},${g},${b})`);
    });
    return () => animVal.removeListener(listenerId);
  }, []);

  const accentAnim = animVal.interpolate({ inputRange: [0, 1], outputRange: [Colors.caramel, Colors.matcha] });
  const bgAnim = animVal.interpolate({ inputRange: [0, 1], outputRange: [Colors.cream, Colors.matchaLight] });
  const bodyBgAnim = animVal.interpolate({ inputRange: [0, 1], outputRange: [Colors.white, '#F7FBF8'] });

  useEffect(() => {
    async function prefill() {
      if (!user || !isSupabaseConfigured() || !id) { setLoading(false); return; }
      try {
        const [coffee, matcha] = await Promise.all([
          getRating(user.id, id, 'coffee'),
          getRating(user.id, id, 'matcha'),
        ]);
        if (coffee) setCoffeeQuality({ coffee_quality: coffee.coffee_quality });
        if (matcha) setMatchaQuality({ coffee_quality: matcha.coffee_quality });
        // Shared fields come from whichever rating exists (coffee preferred)
        const src = coffee ?? matcha;
        if (src) {
          setShared({
            vibes: src.vibes,
            seating: src.seating,
            wifiGood: src.wifi_quality == null ? null : src.wifi_quality >= 3,
            pastries: src.pastries ?? null,
            laptopFriendly: src.laptop_friendly,
            notes: src.notes ?? '',
          });
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    prefill();
  }, [user, id]);

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

  const currentQuality = drinkType === 'coffee' ? coffeeQuality : matchaQuality;
  const setCurrentQuality = drinkType === 'coffee' ? setCoffeeQuality : setMatchaQuality;

  const wifiVal = shared.wifiGood === null ? 3 : shared.wifiGood ? 5 : 1;
  const overall = computeOverall(
    currentQuality.coffee_quality,
    shared.vibes,
    shared.seating,
    wifiVal,
    shared.pastries
  );

  async function handleSave() {
    if (!user || !shop) { Alert.alert('Not signed in', 'Sign in to save ratings.'); return; }
    if (!isSupabaseConfigured()) { Alert.alert('Not configured', 'Set up Supabase to save ratings.'); return; }
    try {
      setSaving(true);
      await upsertShop(shop);
      await upsertRating({
        user_id: user.id,
        shop_id: shop.id,
        drink_type: drinkType,
        coffee_quality: currentQuality.coffee_quality,
        vibes: shared.vibes,
        seating: shared.seating,
        wifi_quality: shared.wifiGood === null ? 3 : shared.wifiGood ? 5 : 1,
        work_friendliness: 3,
        pastries: shared.pastries ?? undefined,
        laptop_friendly: shared.laptopFriendly,
        overall,
        notes: shared.notes.trim() || undefined,
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
        <View style={styles.center}><Text style={styles.errorText}>Shop not found.</Text></View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={Colors.caramel} /></View>
      </SafeAreaView>
    );
  }

  const isMatcha = drinkType === 'matcha';

  return (
    <Animated.View style={[styles.safeWrapper, { backgroundColor: bgAnim }]}>
      <SafeAreaView style={styles.safeInner}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

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
              style={[styles.drinkBtn, !isMatcha && { backgroundColor: Colors.caramel }]}
              onPress={() => switchDrinkType('coffee')}
            >
              <Text style={[styles.drinkBtnText, !isMatcha && styles.drinkBtnTextActive]}>☕ Coffee</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drinkBtn, isMatcha && { backgroundColor: Colors.matcha }]}
              onPress={() => switchDrinkType('matcha')}
            >
              <Text style={[styles.drinkBtnText, isMatcha && styles.drinkBtnTextActive]}>🍵 Matcha</Text>
            </TouchableOpacity>
          </View>

          <Animated.ScrollView
            ref={scrollRef}
            style={[styles.body, { backgroundColor: bodyBgAnim }]}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Coffee / Matcha quality — per drink */}
            <View style={styles.criterionRow}>
              <View style={styles.criterionMeta}>
                <Text style={styles.criterionEmoji}>{isMatcha ? '🍵' : '☕'}</Text>
                <Text style={styles.criterionLabel}>{isMatcha ? 'Matcha' : 'Coffee'}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={currentQuality.coffee_quality}
                onValueChange={(v) => setCurrentQuality({ coffee_quality: v })}
                minimumTrackTintColor={sliderColor}
                maximumTrackTintColor={Colors.milk}
                thumbTintColor={sliderColor}
              />
              <Animated.Text style={[styles.criterionScore, { color: accentAnim }]}>
                {currentQuality.coffee_quality}
                <Text style={styles.criterionMax}>/10</Text>
              </Animated.Text>
            </View>

            {/* Shared criteria */}
            {SHARED_CRITERIA.map((c) => {
              const val = shared[c.key];
              return (
                <View key={c.key} style={styles.criterionRow}>
                  <View style={styles.criterionMeta}>
                    <Ionicons name={c.icon} size={20} color={Colors.muted} style={styles.criterionIcon} />
                    <Text style={styles.criterionLabel}>{c.label}</Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={c.max}
                    step={1}
                    value={val}
                    onValueChange={(v) => setShared((prev) => ({ ...prev, [c.key]: v }))}
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

            {/* WiFi row — shared */}
            <View style={styles.thumbRow}>
              <Ionicons name="wifi-outline" size={20} color={Colors.muted} style={styles.criterionIcon} />
              <Text style={styles.thumbRowLabel}>Has good WiFi?</Text>
              <View style={styles.thumbBtns}>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.wifiGood === true && { backgroundColor: sliderColor, borderColor: sliderColor }]}
                  onPress={() => setShared((prev) => ({ ...prev, wifiGood: prev.wifiGood === true ? null : true }))}
                >
                  <Text style={styles.thumbIcon}>👍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.wifiGood === false && styles.thumbBtnActiveDown]}
                  onPress={() => setShared((prev) => ({ ...prev, wifiGood: prev.wifiGood === false ? null : false }))}
                >
                  <Text style={styles.thumbIcon}>👎</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pastries row — shared */}
            <View style={styles.thumbRow}>
              <Ionicons name="cafe-outline" size={20} color={Colors.muted} style={styles.criterionIcon} />
              <Text style={styles.thumbRowLabel}>Has pastries?</Text>
              <View style={styles.thumbBtns}>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.pastries != null && { backgroundColor: sliderColor, borderColor: sliderColor }]}
                  onPress={() => setShared((prev) => ({ ...prev, pastries: prev.pastries != null ? prev.pastries : 3 }))}
                >
                  <Ionicons name="checkmark" size={20} color={shared.pastries != null ? Colors.white : Colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.pastries == null && styles.thumbBtnActiveNeutral]}
                  onPress={() => setShared((prev) => ({ ...prev, pastries: null }))}
                >
                  <Ionicons name="close" size={20} color={shared.pastries == null ? Colors.white : Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
            {shared.pastries != null && (
              <View style={styles.criterionRow}>
                <View style={{ width: 90 }} />
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={5}
                  step={1}
                  value={shared.pastries}
                  onValueChange={(v) => setShared((prev) => ({ ...prev, pastries: v }))}
                  minimumTrackTintColor={sliderColor}
                  maximumTrackTintColor={Colors.milk}
                  thumbTintColor={sliderColor}
                />
                <Animated.Text style={[styles.criterionScore, { color: accentAnim }]}>
                  {shared.pastries}
                  <Text style={styles.criterionMax}>/5</Text>
                </Animated.Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Laptop toggle — shared */}
            <View style={styles.toggleRow}>
              <Ionicons name="laptop-outline" size={20} color={Colors.muted} />
              <Text style={styles.toggleLabel}>Laptop Friendly</Text>
              <Switch
                value={shared.laptopFriendly}
                onValueChange={(v) => setShared((prev) => ({ ...prev, laptopFriendly: v }))}
                trackColor={{ false: Colors.milk, true: sliderColor }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.divider} />

            {/* Notes — shared */}
            <View style={styles.notesRow}>
              <Ionicons name="create-outline" size={20} color={Colors.muted} />
              <TextInput
                style={styles.notesInput}
                placeholder="Notes (optional)"
                placeholderTextColor={Colors.muted}
                value={shared.notes}
                onChangeText={(v) => setShared((prev) => ({ ...prev, notes: v }))}
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
  headerLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 1 },
  headerShop: { fontSize: 15, fontWeight: '700', color: Colors.espresso },
  overallBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  overallText: { color: Colors.white, fontSize: 13, fontWeight: '700' },

  drinkToggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.milk,
    borderRadius: 6,
    padding: 3,
    gap: 3,
  },
  drinkBtn: { flex: 1, paddingVertical: 9, borderRadius: 5, alignItems: 'center' },
  drinkBtnText: { fontSize: 14, fontWeight: '600', color: Colors.muted },
  drinkBtnTextActive: { color: Colors.white },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  criterionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  criterionMeta: { flexDirection: 'row', alignItems: 'center', width: 90, gap: 8 },
  criterionEmoji: { fontSize: 22 },
  criterionIcon: { width: 26, textAlign: 'center' },
  criterionLabel: { fontSize: 14, fontWeight: '600', color: Colors.espresso },
  slider: { flex: 1, height: 40 },
  criterionScore: { fontSize: 18, fontWeight: '700', width: 42, textAlign: 'right' },
  criterionMax: { fontSize: 11, fontWeight: '500', color: Colors.muted },

  thumbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  thumbRowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.espresso },
  thumbBtns: { flexDirection: 'row', gap: 8 },
  thumbBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.foam,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.milk,
  },
  thumbBtnActiveDown: { backgroundColor: '#E8554E', borderColor: '#E8554E' },
  thumbBtnActiveNeutral: { backgroundColor: Colors.muted, borderColor: Colors.muted },
  thumbIcon: { fontSize: 20 },

  divider: { height: 1, backgroundColor: Colors.foam, marginVertical: 10 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  toggleEmoji: { fontSize: 22 },
  toggleLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.espresso },

  notesRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  notesInput: {
    flex: 1, fontSize: 15, color: Colors.espresso,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.milk,
  },

  footer: { padding: 16, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.milk },
  saveBtn: { borderRadius: 8, overflow: 'hidden' },
  saveBtnInner: { paddingVertical: 15, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
