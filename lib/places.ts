import { CoffeeShop } from './types';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

export const isPlacesConfigured = (): boolean => API_KEY.length > 0;

const BASE = 'https://places.googleapis.com/v1';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.photos';

interface NewPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  priceLevel?: string;
  photos?: { name: string }[];
}

function parsePriceLevel(level?: string): CoffeeShop['price_level'] {
  const map: Record<string, 1 | 2 | 3 | 4> = {
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return level ? map[level] : undefined;
}

function photoUrl(photoName: string): string {
  return `${BASE}/${photoName}/media?maxWidthPx=600&key=${API_KEY}`;
}

function toShop(p: NewPlace): CoffeeShop {
  return {
    id: p.id,
    google_place_id: p.id,
    name: p.displayName?.text ?? 'Unknown',
    address: p.formattedAddress ?? '',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    price_level: parsePriceLevel(p.priceLevel),
    photo_url: p.photos?.[0] ? photoUrl(p.photos[0].name) : undefined,
  };
}

export async function fetchNearby(
  lat: number,
  lng: number,
  radiusMeters = 2000
): Promise<CoffeeShop[]> {
  const res = await fetch(`${BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ['cafe'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Places error ${res.status}`);
  return (data.places ?? []).map(toShop);
}

export async function searchPlaces(
  query: string,
  lat?: number,
  lng?: number
): Promise<CoffeeShop[]> {
  const body: Record<string, unknown> = {
    textQuery: `${query} coffee`,
    includedType: 'cafe',
    maxResultCount: 20,
  };
  if (lat != null && lng != null) {
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: 10000 },
    };
  }
  const res = await fetch(`${BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Places error ${res.status}`);
  return (data.places ?? []).map(toShop);
}
