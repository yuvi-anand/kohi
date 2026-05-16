import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create a .env file in the project root with:
// EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export const isSupabaseConfigured = (): boolean =>
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
