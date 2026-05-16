export type PriceLevel = 1 | 2 | 3 | 4;

export interface CoffeeShop {
  id: string;
  google_place_id?: string;
  name: string;
  address: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
  photo_url?: string;
  price_level?: PriceLevel;
  website?: string;
  phone?: string;
  created_at?: string;
}

export type DrinkType = 'coffee' | 'matcha';

export interface Rating {
  id?: string;
  user_id?: string;
  shop_id: string;
  drink_type?: DrinkType;
  coffee_quality: number;
  vibes: number;
  seating: number;
  wifi_quality: number;
  work_friendliness: number;
  pastries?: number | null;
  laptop_friendly: boolean;
  overall: number;
  notes?: string;
  visited_at?: string;
  created_at?: string;
}

export interface Bookmark {
  id?: string;
  user_id?: string;
  shop_id: string;
  created_at?: string;
}

export interface Profile {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  created_at?: string;
}
