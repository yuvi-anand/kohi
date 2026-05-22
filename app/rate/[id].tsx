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
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../lib/colors';
import { DrinkType } from '../../lib/types';
import { useShops } from '../../context/shops';
import { getRating, getRatings, upsertRating, upsertShop } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { computeOverall, NORMALIZE_THRESHOLD } from '../../lib/utils';

// Per-drink: only the quality score differs between coffee and matcha
type DrinkQuality = { coffee_quality: number };

// Shared: everything else is about the shop, not the drink
type SharedState = {
  vibes: number;
  enoughSeating: boolean | null;
  wifiGood: boolean | null;
  pastries: number | null;
  pastriesNo: boolean; // true = explicitly answered "no pastries"
  laptopFriendly: boolean;
  notes: string;
};

const SHARED_CRITERIA = [
  { key: 'vibes' as const, label: 'Vibes', icon: 'sunny-outline' as const, max: 10 },
];

const DEFAULT_QUALITY: DrinkQuality = { coffee_quality: 5 };
const DEFAULT_SHARED: SharedState = {
  vibes: 5,
  enoughSeating: null,
  wifiGood: null,
  pastries: null,
  pastriesNo: false,
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [averages, setAverages] = useState<{
    coffeeQuality: number | null;
    matchaQuality: number | null;
    vibes: number | null;
    pastries: number | null;
  }>({ coffeeQuality: null, matchaQuality: null, vibes: null, pastries: null });
  const [drinkCounts, setDrinkCounts] = useState({ coffee: 0, matcha: 0 });
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
        const [coffee, matcha, allRatings] = await Promise.all([
          getRating(user.id, id, 'coffee'),
          getRating(user.id, id, 'matcha'),
          getRatings(user.id),
        ]);

        // Compute historical averages across all shops (excluding this shop for unbiased anchor)
        const otherRatings = allRatings.filter((r) => r.shop_id !== id);
        const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
        const coffeeRatings = otherRatings.filter((r) => (r.drink_type ?? 'coffee') === 'coffee');
        const matchaRatings = otherRatings.filter((r) => r.drink_type === 'matcha');
        const pastriesRatings = otherRatings.filter((r) => r.pastries != null);
        setAverages({
          coffeeQuality: avg(coffeeRatings.map((r) => r.coffee_quality)),
          matchaQuality: avg(matchaRatings.map((r) => r.coffee_quality)),
          vibes: avg(otherRatings.map((r) => r.vibes)),
          pastries: avg(pastriesRatings.map((r) => r.pastries!)),
        });
        // Count existing ratings per drink type (excluding current shop)
        setDrinkCounts({
          coffee: allRatings.filter((r) => (r.drink_type ?? 'coffee') === 'coffee' && r.shop_id !== id).length,
          matcha: allRatings.filter((r) => r.drink_type === 'matcha' && r.shop_id !== id).length,
        });
        if (coffee) setCoffeeQuality({ coffee_quality: coffee.coffee_quality });
        if (matcha) setMatchaQuality({ coffee_quality: matcha.coffee_quality });
        // Shared fields come from whichever rating exists (coffee preferred)
        const src = coffee ?? matcha;
        if (src) {
          setShared({
            vibes: src.vibes,
            enoughSeating: src.seating == null ? null : src.seating >= 3,
            wifiGood: src.wifi_quality == null ? null : src.wifi_quality >= 3,
            pastries: src.pastries ?? null,
            pastriesNo: false,
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
  const seatingVal = shared.enoughSeating === null ? 3 : shared.enoughSeating ? 5 : 1;
  const overall = computeOverall(
    currentQuality.coffee_quality,
    shared.vibes,
    seatingVal,
    wifiVal,
    shared.pastries
  );

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function uploadRatingPhoto(shopId: string): Promise<string | null> {
    if (!photoUri || !user) return null;
    try {
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const ext = photoUri.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${shopId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('rating-photos')
        .upload(path, blob, { upsert: false, contentType: `image/${ext}` });
      if (error) throw error;
      const { data } = supabase.storage.from('rating-photos').getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }

  async function handleSave() {
    if (!user || !shop) { Alert.alert('Not signed in', 'Sign in to save ratings.'); return; }
    if (!isSupabaseConfigured()) { Alert.alert('Not configured', 'Set up Supabase to save ratings.'); return; }
    try {
      setSaving(true);
      await upsertShop(shop);
      const photoUrl = await uploadRatingPhoto(shop.id);
      await upsertRating({
        user_id: user.id,
        shop_id: shop.id,
        drink_type: drinkType,
        coffee_quality: currentQuality.coffee_quality,
        vibes: shared.vibes,
        seating: shared.enoughSeating === null ? 3 : shared.enoughSeating ? 5 : 1,
        wifi_quality: shared.wifiGood === null ? 3 : shared.wifiGood ? 5 : 1,
        work_friendliness: 3,
        pastries: shared.pastries ?? undefined,
        laptop_friendly: shared.laptopFriendly,
        overall,
        notes: shared.notes.trim() || undefined,
        photo_url: photoUrl ?? undefined,
        visited_at: new Date().toISOString(),
      });
      const countAfter = (drinkType === 'coffee' ? drinkCounts.coffee : drinkCounts.matcha) + 1;
      router.replace({
        pathname: '/rating-result',
        params: {
          shopName: shop.name,
          overall: String(overall),
          shopId: shop.id,
          ratingsAfter: String(countAfter),
          drinkType,
        },
      });
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
  const qualityAvg = isMatcha ? averages.matchaQuality : averages.coffeeQuality;

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
            {/* Photo picker */}
            <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto} activeOpacity={0.8}>
              {photoUri ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => setPhotoUri(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={22} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Ionicons name="camera-outline" size={24} color={Colors.muted} />
                  <Text style={styles.photoPickerText}>Add a photo (optional)</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Coffee / Matcha quality — per drink */}
            <View style={styles.criterionRow}>
              <View style={styles.criterionMeta}>
                <Text style={styles.criterionEmoji}>{isMatcha ? '🍵' : '☕'}</Text>
                <Text style={styles.criterionLabel}>{isMatcha ? 'Matcha' : 'Coffee'}</Text>
              </View>
              <View style={styles.sliderWrap}>
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
                {qualityAvg != null && (
                  <Text style={styles.avgLabel}>your avg: {qualityAvg}</Text>
                )}
              </View>
              <Animated.Text style={[styles.criterionScore, { color: accentAnim }]}>
                {currentQuality.coffee_quality}
                <Text style={styles.criterionMax}>/10</Text>
              </Animated.Text>
            </View>

            {/* Shared criteria */}
            {SHARED_CRITERIA.map((c) => {
              const val = shared[c.key];
              const criterionAvg = averages[c.key as keyof typeof averages];
              return (
                <View key={c.key} style={styles.criterionRow}>
                  <View style={styles.criterionMeta}>
                    <Ionicons name={c.icon} size={20} color={Colors.muted} style={styles.criterionIcon} />
                    <Text style={styles.criterionLabel}>{c.label}</Text>
                  </View>
                  <View style={styles.sliderWrap}>
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
                    {criterionAvg != null && (
                      <Text style={styles.avgLabel}>your avg: {criterionAvg}</Text>
                    )}
                  </View>
                  <Animated.Text style={[styles.criterionScore, { color: accentAnim }]}>
                    {val}
                    <Text style={styles.criterionMax}>/{c.max}</Text>
                  </Animated.Text>
                </View>
              );
            })}

            {/* Seating row — shared */}
            <View style={styles.thumbRow}>
              <Ionicons name="people-outline" size={20} color={Colors.muted} style={styles.criterionIcon} />
              <Text style={styles.thumbRowLabel}>Enough seating?</Text>
              <View style={styles.thumbBtns}>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.enoughSeating === true && { backgroundColor: sliderColor, borderColor: sliderColor }]}
                  onPress={() => setShared((prev) => ({ ...prev, enoughSeating: prev.enoughSeating === true ? null : true }))}
                >
                  <Ionicons name="checkmark" size={20} color={shared.enoughSeating === true ? Colors.white : Colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.enoughSeating === false && styles.thumbBtnActiveNeutral]}
                  onPress={() => setShared((prev) => ({ ...prev, enoughSeating: prev.enoughSeating === false ? null : false }))}
                >
                  <Ionicons name="close" size={20} color={shared.enoughSeating === false ? Colors.white : Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* WiFi row — shared */}
            <View style={styles.thumbRow}>
              <Ionicons name="wifi-outline" size={20} color={Colors.muted} style={styles.criterionIcon} />
              <Text style={styles.thumbRowLabel}>Has good WiFi?</Text>
              <View style={styles.thumbBtns}>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.wifiGood === true && { backgroundColor: sliderColor, borderColor: sliderColor }]}
                  onPress={() => setShared((prev) => ({ ...prev, wifiGood: prev.wifiGood === true ? null : true }))}
                >
                  <Ionicons name="checkmark" size={20} color={shared.wifiGood === true ? Colors.white : Colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.wifiGood === false && styles.thumbBtnActiveNeutral]}
                  onPress={() => setShared((prev) => ({ ...prev, wifiGood: prev.wifiGood === false ? null : false }))}
                >
                  <Ionicons name="close" size={20} color={shared.wifiGood === false ? Colors.white : Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Pastries row — 3 states: neither (null/false), yes (slider), no (X) */}
            <View style={styles.thumbRow}>
              <Ionicons name="cafe-outline" size={20} color={Colors.muted} style={styles.criterionIcon} />
              <Text style={styles.thumbRowLabel}>Has pastries?</Text>
              <View style={styles.thumbBtns}>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.pastries != null && { backgroundColor: sliderColor, borderColor: sliderColor }]}
                  onPress={() => setShared((prev) => ({
                    ...prev,
                    pastries: prev.pastries != null ? null : 3,
                    pastriesNo: false,
                  }))}
                >
                  <Ionicons name="checkmark" size={20} color={shared.pastries != null ? Colors.white : Colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, shared.pastriesNo && styles.thumbBtnActiveNeutral]}
                  onPress={() => setShared((prev) => ({
                    ...prev,
                    pastries: null,
                    pastriesNo: !prev.pastriesNo,
                  }))}
                >
                  <Ionicons name="close" size={20} color={shared.pastriesNo ? Colors.white : Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
            {shared.pastries != null && (
              <View style={styles.criterionRow}>
                <View style={{ width: 90 }} />
                <View style={styles.sliderWrap}>
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
                  {averages.pastries != null && (
                    <Text style={styles.avgLabel}>your avg: {averages.pastries}</Text>
                  )}
                </View>
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
            {(() => {
              const currentCount = drinkType === 'coffee' ? drinkCounts.coffee : drinkCounts.matcha;
              // After saving this rating, count will be currentCount + 1
              const afterSave = currentCount + 1;
              const remaining = NORMALIZE_THRESHOLD - afterSave;
              if (remaining > 0) {
                return (
                  <View style={styles.unlockHint}>
                    <Ionicons name="lock-closed-outline" size={13} color={Colors.muted} />
                    <Text style={styles.unlockHintText}>
                      Rate {remaining} more {drinkType === 'matcha' ? 'matcha' : 'coffee'} shop{remaining !== 1 ? 's' : ''} to unlock your scores
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
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

  photoPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.milk, borderRadius: 8,
    borderStyle: 'dashed', padding: 14, marginBottom: 8,
    backgroundColor: Colors.foam,
  },
  photoPickerText: { fontSize: 14, color: Colors.muted, fontWeight: '500' },
  photoPreviewWrap: { position: 'relative' },
  photoPreview: { width: 80, height: 80, borderRadius: 8 },
  photoRemoveBtn: { position: 'absolute', top: -8, right: -8 },

  criterionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  criterionMeta: { flexDirection: 'row', alignItems: 'center', width: 90, gap: 8 },
  criterionEmoji: { fontSize: 22 },
  criterionIcon: { width: 26, textAlign: 'center' },
  criterionLabel: { fontSize: 14, fontWeight: '600', color: Colors.espresso },
  sliderWrap: { flex: 1 },
  slider: { width: '100%', height: 40 },
  avgLabel: { fontSize: 11, color: Colors.muted, textAlign: 'center', marginTop: -4, marginBottom: 2 },
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
  thumbBtnActiveNeutral: { backgroundColor: Colors.muted, borderColor: Colors.muted },

  divider: { height: 1, backgroundColor: Colors.foam, marginVertical: 10 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  toggleEmoji: { fontSize: 22 },
  toggleLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.espresso },

  notesRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  notesInput: {
    flex: 1, fontSize: 15, color: Colors.espresso,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.milk,
  },

  footer: { padding: 16, paddingTop: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.milk, gap: 10 },
  unlockHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  unlockHintText: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '500',
  },
  saveBtn: { borderRadius: 8, overflow: 'hidden' },
  saveBtnInner: { paddingVertical: 15, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
