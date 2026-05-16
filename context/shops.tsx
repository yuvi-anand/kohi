import React, { createContext, useContext, useEffect, useState } from 'react';
import { CoffeeShop } from '../lib/types';
import { MOCK_SHOPS } from '../lib/mockShops';
import { fetchNearby, isPlacesConfigured } from '../lib/places';
import { useLocation } from './location';

interface ShopsContextType {
  shops: CoffeeShop[];
  loading: boolean;
  error: string | null;
  isRealData: boolean;
  shopById: Record<string, CoffeeShop>;
  addToCache: (shops: CoffeeShop[]) => void;
}

const initialCache: Record<string, CoffeeShop> = {};
for (const s of MOCK_SHOPS) initialCache[s.id] = s;

const ShopsContext = createContext<ShopsContextType>({
  shops: MOCK_SHOPS,
  loading: false,
  error: null,
  isRealData: false,
  shopById: initialCache,
  addToCache: () => {},
});

export function ShopsProvider({ children }: { children: React.ReactNode }) {
  const [shops, setShops] = useState<CoffeeShop[]>(MOCK_SHOPS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState(false);
  const [shopById, setShopById] = useState<Record<string, CoffeeShop>>(initialCache);
  const { coords } = useLocation();

  const addToCache = (newShops: CoffeeShop[]) => {
    setShopById((prev) => {
      const next = { ...prev };
      for (const s of newShops) next[s.id] = s;
      return next;
    });
  };

  useEffect(() => {
    if (!coords || !isPlacesConfigured()) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nearby = await fetchNearby(coords!.latitude, coords!.longitude);
        if (!cancelled) {
          const resolved = nearby.length > 0 ? nearby : MOCK_SHOPS;
          setShops(resolved);
          setIsRealData(nearby.length > 0);
          addToCache(resolved);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setShops(MOCK_SHOPS);
          setIsRealData(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [coords]);

  return (
    <ShopsContext.Provider value={{ shops, loading, error, isRealData, shopById, addToCache }}>
      {children}
    </ShopsContext.Provider>
  );
}

export const useShops = () => useContext(ShopsContext);
