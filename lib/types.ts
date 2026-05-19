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
  hours?: string[] | null;
  open_now?: boolean | null;
  created_at?: string;
}

export interface ShopStats {
  avg_overall: number;
  avg_coffee: number;
  avg_vibes: number;
  rating_count: number;
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

export interface FeedItem {
  rating_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  shop_id: string;
  shop_name: string;
  shop_address: string;
  drink_type: DrinkType;
  overall: number;
  notes?: string | null;
  created_at: string;
}

export interface UserResult {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  rating_count: number;
  is_following: boolean;
}

export interface ReelSave {
  id?: string;
  user_id?: string;
  url: string;
  platform?: string | null;
  shop_id?: string | null;
  extracted_name?: string | null;
  extracted_summary?: string | null;
  source_caption?: string | null;
  thumbnail_url?: string | null;
  status?: string;
  created_at?: string;
}
