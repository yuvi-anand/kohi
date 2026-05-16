import React, { useState, useEffect, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { CoffeeShop } from '../../lib/types';
import { Colors } from '../../lib/colors';
import { MOCK_SHOPS } from '../../lib/mockShops';
import { searchPlaces, isPlacesConfigured } from '../../lib/places';
import { useLocation } from '../../context/location';
import { useShops } from '../../context/shops';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoffeeShop[]>(MOCK_SHOPS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locationText, setLocationText] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [isDefaultLocation, setIsDefaultLocation] = useState(true);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { coords } = useLocation();
  const { addToCache } = useShops();

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
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={results}
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
            <TouchableOpacity
              style={styles.rateBtn}
              onPress={() => navigateTo(item, 'rate')}
            >
              <Text style={styles.rateBtnText}>Rate</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.milk,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.roast },

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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.milk,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: Colors.espresso },

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
  name: { fontSize: 15, fontWeight: '600', color: Colors.espresso },
  address: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  rateBtn: {
    backgroundColor: Colors.caramel,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  rateBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  separator: { height: 1, backgroundColor: Colors.foam, marginLeft: 42 },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.muted },
});
