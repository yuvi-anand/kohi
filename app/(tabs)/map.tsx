import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/colors';
import { CoffeeShop, Rating, DrinkType, ReelSave } from '../../lib/types';
import { useLocation } from '../../context/location';
import { useShops } from '../../context/shops';
import { fetchNearby, isPlacesConfigured } from '../../lib/places';
import { getRatings, getReelSaves } from '../../lib/api';
import { useAuth } from '../../context/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { formatScore, overallColor } from '../../lib/utils';

const INITIAL_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [areaShops, setAreaShops] = useState<CoffeeShop[]>([]);
  const [fetching, setFetching] = useState(false);
  const [coffeeRatings, setCoffeeRatings] = useState<Record<string, Rating>>({});
  const [matchaRatings, setMatchaRatings] = useState<Record<string, Rating>>({});
  const [drinkType, setDrinkType] = useState<DrinkType>('coffee');
  const [reelSaves, setReelSaves] = useState<ReelSave[]>([]);

  const { coords } = useLocation();
  const { shops: globalShops, addToCache, shopById } = useShops();
  const { user } = useAuth();

  // Seed with global shops on first load
  useEffect(() => {
    if (areaShops.length === 0 && globalShops.length > 0) {
      setAreaShops(globalShops);
    }
  }, [globalShops]);

  // Reload ratings + re-center on current location every time the tab focuses
  useFocusEffect(
    useCallback(() => {
      if (user && isSupabaseConfigured()) {
        getRatings(user.id).then((data) => {
          const cm: Record<string, Rating> = {};
          const mm: Record<string, Rating> = {};
          for (const r of data) {
            if ((r.drink_type ?? 'coffee') === 'coffee') cm[r.shop_id] = r;
            else if (r.drink_type === 'matcha') mm[r.shop_id] = r;
          }
          setCoffeeRatings(cm);
          setMatchaRatings(mm);
        }).catch(() => {});
        getReelSaves(user.id).then(setReelSaves).catch(() => {});
      }
      goToCurrentLocation();
    }, [user, coords])
  );

  function goToCurrentLocation() {
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 600);
    }
  }

  const onRegionChangeComplete = useCallback((region: Region) => {
    if (!isPlacesConfigured()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const radiusMeters = Math.min((region.latitudeDelta / 2) * 111320, 50000);
      setFetching(true);
      try {
        const nearby = await fetchNearby(region.latitude, region.longitude, radiusMeters);
        const resolved = nearby.length > 0 ? nearby : globalShops;
        setAreaShops(resolved);
        if (nearby.length > 0) addToCache(nearby);
      } catch {
        // silently keep existing shops
      } finally {
        setFetching(false);
      }
    }, 700);
  }, [globalShops]);

  const ratings = drinkType === 'coffee' ? coffeeRatings : matchaRatings;

  const shopsWithCoords = areaShops.filter((s) => s.lat && s.lng);

  const sortedForList = [...areaShops].sort((a, b) => {
    const ra = ratings[a.id];
    const rb = ratings[b.id];
    if (ra && rb) return rb.overall - ra.overall;
    if (ra) return -1;
    if (rb) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <View style={styles.container}>
      {/* Map — always rendered; shrinks to mini in list mode */}
      <MapView
        ref={mapRef}
        style={viewMode === 'list' ? styles.mapMini : styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {shopsWithCoords.map((shop) => {
          const r = ratings[shop.id];
          const isSelected = selectedId === shop.id;
          return (
            <Marker
              key={shop.id}
              coordinate={{ latitude: shop.lat!, longitude: shop.lng! }}
              onPress={() => setSelectedId(shop.id)}
            >
              {r ? (
                <View style={[
                  styles.pinRated,
                  { backgroundColor: overallColor(r.overall) },
                  isSelected && styles.pinSelected,
                ]}>
                  <Text style={styles.pinRatedText}>{formatScore(r.overall)}</Text>
                </View>
              ) : (
                <View style={[styles.pin, isSelected && styles.pinSelected]}>
                  <Text style={styles.pinText}>☕</Text>
                </View>
              )}
              <Callout onPress={() => router.push(`/shop/${shop.id}`)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{shop.name}</Text>
                  <Text style={styles.calloutAddr} numberOfLines={1}>{shop.address}</Text>
                  <Text style={styles.calloutCta}>Tap to view →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
        {reelSaves
          .filter((rs) => rs.shop_id && shopById[rs.shop_id!]?.lat && shopById[rs.shop_id!]?.lng)
          .map((rs) => {
            const shop = shopById[rs.shop_id!]!;
            return (
              <Marker
                key={`reel-${rs.id}`}
                coordinate={{ latitude: shop.lat!, longitude: shop.lng! }}
                onPress={() => router.push(`/shop/${shop.id}`)}
              >
                <View style={styles.reelPin}>
                  <Ionicons name="film-outline" size={14} color={Colors.white} />
                </View>
              </Marker>
            );
          })
        }
      </MapView>

      {/* List view — sits below the mini-map */}
      {viewMode === 'list' && (
        <FlatList
          style={styles.list}
          data={sortedForList}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const r = ratings[item.id];
            return (
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => router.push(`/shop/${item.id}`)}
                activeOpacity={0.75}
              >
                <Text style={styles.listRank}>{index + 1}</Text>
                <View style={styles.listInfo}>
                  <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.listAddr} numberOfLines={1}>{item.address}</Text>
                </View>
                {r ? (
                  <View style={[styles.scoreBadge, { backgroundColor: overallColor(r.overall) }]}>
                    <Text style={styles.scoreText}>{formatScore(r.overall)}</Text>
                  </View>
                ) : (
                  <View style={styles.unratedBadge}>
                    <Text style={styles.unratedText}>Rate</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* Header overlay — only shown in full map mode */}
      <SafeAreaView style={[styles.overlay, viewMode === 'list' && { display: 'none' }]} pointerEvents="box-none">
        <View style={styles.titleBox}>
          <Text style={styles.title}>Map</Text>
          <Text style={styles.subtitle}>
            {fetching ? 'Loading…' : `${areaShops.length} spots`}
          </Text>
        </View>
        <View style={styles.drinkToggle} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.drinkBtn, drinkType === 'coffee' && styles.drinkBtnActiveCoffee]}
            onPress={() => setDrinkType('coffee')}
          >
            <Text style={styles.drinkBtnText}>☕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.drinkBtn, drinkType === 'matcha' && styles.drinkBtnActiveMatcha]}
            onPress={() => setDrinkType('matcha')}
          >
            <Text style={styles.drinkBtnText}>🍵</Text>
          </TouchableOpacity>
        </View>
        {fetching && (
          <View style={styles.fetchingPill}>
            <ActivityIndicator size="small" color={Colors.caramel} />
            <Text style={styles.fetchingText}>Updating…</Text>
          </View>
        )}
      </SafeAreaView>

      {/* My Location button — bottom left */}
      <TouchableOpacity
        style={styles.locationBtn}
        onPress={goToCurrentLocation}
        activeOpacity={0.85}
      >
        <Ionicons name="locate" size={20} color={Colors.caramel} />
      </TouchableOpacity>

      {/* Add from Reel button */}
      <TouchableOpacity
        style={styles.reelBtn}
        onPress={() => router.push('/add-reel')}
        activeOpacity={0.85}
      >
        <Ionicons name="link" size={20} color={Colors.white} />
      </TouchableOpacity>

      {/* Toggle button — bottom right */}
      <TouchableOpacity
        style={styles.toggleBtn}
        onPress={() => setViewMode((m) => m === 'map' ? 'list' : 'map')}
        activeOpacity={0.85}
      >
        <Ionicons
          name={viewMode === 'map' ? 'list' : 'map'}
          size={22}
          color={Colors.white}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  mapMini: { height: 260 },
  list: { flex: 1, backgroundColor: Colors.cream },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 10,
  },
  titleBox: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.roast },
  subtitle: { fontSize: 11, color: Colors.muted, marginTop: 1 },

  drinkToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 6,
    padding: 3,
    gap: 3,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  drinkBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  drinkBtnActiveCoffee: { backgroundColor: Colors.caramel },
  drinkBtnActiveMatcha: { backgroundColor: Colors.matcha },
  drinkBtnText: { fontSize: 16 },

  fetchingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  fetchingText: { fontSize: 12, color: Colors.muted },

  locationBtn: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.roast,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  toggleBtn: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.caramel,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.roast,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  pin: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.milk,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
  },
  pinRated: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 3, elevation: 4,
  },
  pinSelected: { transform: [{ scale: 1.2 }], borderColor: Colors.roast },
  pinText: { fontSize: 18 },
  pinRatedText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  callout: { width: 200, padding: 8 },
  calloutName: { fontSize: 13, fontWeight: '700', color: Colors.espresso, marginBottom: 2 },
  calloutAddr: { fontSize: 11, color: Colors.muted, marginBottom: 6 },
  calloutCta: { fontSize: 11, color: Colors.caramel, fontWeight: '600' },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    gap: 12,
  },
  listRank: { fontSize: 13, fontWeight: '700', color: Colors.muted, width: 22, textAlign: 'center' },
  listInfo: { flex: 1 },
  listName: { fontSize: 15, fontWeight: '700', color: Colors.espresso },
  listAddr: { fontSize: 12, color: Colors.muted, marginTop: 1 },
  scoreBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scoreText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  unratedBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.milk, alignItems: 'center', justifyContent: 'center' },
  unratedText: { fontSize: 11, color: Colors.muted, fontWeight: '500' },
  separator: { height: 1, backgroundColor: Colors.foam, marginLeft: 50 },

  reelBtn: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.roast,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.roast,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  reelPin: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.roast,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
    shadowColor: Colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 3, elevation: 4,
  },
});
