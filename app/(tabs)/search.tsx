import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { CoffeeShop, Rating } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { MOCK_SHOPS } from '../../lib/mockShops';
import { searchPlaces, isPlacesConfigured } from '../../lib/places';
import { getRatings } from '../../lib/api';
import { useLocation } from '../../context/location';
import { useShops } from '../../context/shops';
import { useAuth } from '../../context/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { isNonCoffeeShop } from '../../lib/utils';


export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoffeeShop[]>(MOCK_SHOPS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locationText, setLocationText] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [isDefaultLocation, setIsDefaultLocation] = useState(true);

  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [hideChains, setHideChains] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { coords } = useLocation();
  const { addToCache } = useShops();
  const { user } = useAuth();

  // Reverse geocode current position to get city name as default
  useEffect(() => {
    if (!coords) return;
    setLocationCoords({ lat: coords.latitude, lng: coords.longitude });
    Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude })
      .then((results) => {
        if (results.length > 0) {
          const { city, region, country } = results[0];
          const label = [city, region].filter(Boolean).join(', ');
          if (label) {
            setLocationText(label);
            setIsDefaultLocation(true);
          }
        }
      })
      .catch(() => {});
  }, [coords]);

  // Geocode whenever user edits the location field
  useEffect(() => {
    if (isDefaultLocation) return;
    if (geocodeDebounce.current) clearTimeout(geocodeDebounce.current);
    if (!locationText.trim()) {
      setLocationCoords(coords ? { lat: coords.latitude, lng: coords.longitude } : null);
      return;
    }
    geocodeDebounce.current = setTimeout(async () => {
      setGeocoding(true);
      try {
        const geo = await Location.geocodeAsync(locationText.trim());
        if (geo.length > 0) {
          setLocationCoords({ lat: geo[0].latitude, lng: geo[0].longitude });
        }
      } catch {
        // keep existing coords
      } finally {
        setGeocoding(false);
      }
    }, 600);
    return () => {
      if (geocodeDebounce.current) clearTimeout(geocodeDebounce.current);
    };
  }, [locationText, isDefaultLocation]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setQuery('');
        setResults(isPlacesConfigured() ? [] : MOCK_SHOPS);
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user || !isSupabaseConfigured()) return;
      getRatings(user.id).then((ratings) => {
        setRatedIds(new Set(ratings.map((r) => r.shop_id)));
      }).catch(() => {});
    }, [user])
  );

  // Search whenever query or locationCoords changes
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    if (!isPlacesConfigured()) {
      const q = query.toLowerCase();
      setResults(
        q
          ? MOCK_SHOPS.filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                s.neighborhood?.toLowerCase().includes(q) ||
                s.address.toLowerCase().includes(q)
            )
          : MOCK_SHOPS
      );
      return;
    }

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    searchDebounce.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const found = await searchPlaces(
          query.trim(),
          locationCoords?.lat,
          locationCoords?.lng
        );
        setResults(found);
      } catch (e: any) {
        setError(e.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [query, locationCoords]);

  function navigateTo(shop: CoffeeShop, path: 'shop' | 'rate') {
    addToCache([shop]);
    router.push(`/${path}/${shop.id}`);
  }

  function resetLocation() {
    if (coords) {
      setLocationCoords({ lat: coords.latitude, lng: coords.longitude });
    }
    // Re-fetch city name
    if (coords) {
      Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude })
        .then((results) => {
          if (results.length > 0) {
            const { city, region } = results[0];
            const label = [city, region].filter(Boolean).join(', ');
            setLocationText(label || '');
          }
        })
        .catch(() => {});
    }
    setIsDefaultLocation(true);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Find a Coffee Shop</Text>
        <TouchableOpacity style={styles.findFriendsBtn} onPress={() => router.push('/find-friends')}>
          <Ionicons name="person-add-outline" size={16} color={Colors.caramel} />
          <Text style={styles.findFriendsBtnText}>Find Friends</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fields}>
        {/* Search input */}
        <View style={styles.inputRow}>
          <Ionicons name="search" size={16} color={Colors.muted} />
          <TextInput
            style={styles.input}
            placeholder="Search by name…"
            placeholderTextColor={Colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {loading ? (
            <ActivityIndicator size="small" color={Colors.muted} />
          ) : query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Location input */}
        <View style={styles.inputRow}>
          <Ionicons
            name={isDefaultLocation ? 'locate' : 'location-outline'}
            size={16}
            color={isDefaultLocation ? Colors.caramel : Colors.muted}
          />
          <TextInput
            style={styles.input}
            placeholder="City or neighborhood…"
            placeholderTextColor={Colors.muted}
            value={locationText}
            onChangeText={(t) => {
              setLocationText(t);
              setIsDefaultLocation(false);
            }}
            autoCorrect={false}
            returnKeyType="search"
          />
          {geocoding ? (
            <ActivityIndicator size="small" color={Colors.muted} />
          ) : !isDefaultLocation && locationText.length > 0 ? (
            <TouchableOpacity onPress={resetLocation}>
              <Ionicons name="locate" size={16} color={Colors.caramel} />
            </TouchableOpacity>
          ) : null}
        </View>
        {/* Filters row */}
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, openNowOnly && styles.filterChipActive]}
            onPress={() => setOpenNowOnly((v) => !v)}
          >
            <Ionicons name="time-outline" size={13} color={openNowOnly ? Colors.white : Colors.muted} />
            <Text style={[styles.filterChipText, openNowOnly && styles.filterChipTextActive]}>Open now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, hideChains && styles.filterChipActive]}
            onPress={() => setHideChains((v) => !v)}
          >
            <Ionicons name="storefront-outline" size={13} color={hideChains ? Colors.white : Colors.muted} />
            <Text style={[styles.filterChipText, hideChains && styles.filterChipTextActive]}>Coffee shops only</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={results.filter((s) => {
          if (openNowOnly && s.open_now !== true) return false;
          if (hideChains && isNonCoffeeShop(s.name)) return false;
          return true;
        })}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigateTo(item, 'shop')}
            activeOpacity={0.7}
          >
            <View style={[styles.dot, { backgroundColor: dotColor(item.name) }]} />
            <View style={styles.rowInfo}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.address} numberOfLines={1}>
                {item.neighborhood ?? item.address}
              </Text>
            </View>
            {ratedIds.has(item.id) ? (
              <View style={styles.ratedBtn}>
                <Text style={styles.ratedBtnText}>Rated</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.rateBtn}
                onPress={() => navigateTo(item, 'rate')}
              >
                <Text style={styles.rateBtnText}>Rate</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        ListEmptyComponent={
          !loading && query.length >= 2 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No coffee shops found.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function dotColor(name: string): string {
  const palette = [Colors.caramel, Colors.latte, Colors.muted, Colors.roast];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.roast },
  findFriendsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1.5, borderColor: Colors.caramel,
  },
  findFriendsBtnText: { fontSize: 13, fontWeight: '600', color: Colors.caramel },

  fields: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.foam,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.milk,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: Colors.espresso },

  filtersRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.milk,
    backgroundColor: Colors.foam,
  },
  filterChipActive: {
    backgroundColor: Colors.caramel,
    borderColor: Colors.caramel,
  },
  filterChipText: { fontSize: 13, color: Colors.muted, fontWeight: '500' },
  filterChipTextActive: { color: Colors.white },

  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FFF0EF',
    borderRadius: 8,
  },
  errorText: { fontSize: 12, color: Colors.error },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  rowInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: Colors.espresso },
  address: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  rateBtn: {
    backgroundColor: Colors.caramel,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  rateBtnText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  ratedBtn: {
    backgroundColor: Colors.foam,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.milk,
  },
  ratedBtnText: { color: Colors.muted, fontSize: 13, fontWeight: '500' },
  separator: { height: 1, backgroundColor: Colors.foam, marginLeft: 42 },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.muted },
});
