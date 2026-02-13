import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Lazy-load Supabase client to avoid blocking compilation
let supabaseInstance: SupabaseClient | null = null;

function initSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  try {
    // Debug logging (only in development, and only in browser)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[Supabase Config] Client-side check:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
        urlLength: supabaseUrl.length,
        keyLength: supabaseAnonKey.length,
        urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing',
        keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing',
      });
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase credentials not configured. Using localStorage fallback.');
      console.warn('[Supabase Config] Missing:', {
        url: !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : '✓',
        key: !supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : '✓',
      });
    }

    // Create Supabase client (works even if credentials are empty - will use localStorage fallback)
    supabaseInstance = createClient(
      supabaseUrl || 'https://placeholder.supabase.co', 
      supabaseAnonKey || 'placeholder-key', 
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  } catch (error) {
    console.error('[Supabase] Error initializing client:', error);
    // Create a minimal client even on error to prevent crashes
    supabaseInstance = createClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }
  
  return supabaseInstance;
}

// Export client - initialize lazily only when accessed (not at module load time)
// This prevents blocking during Next.js build/compilation
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = initSupabaseClient();
    const value = (client as any)[prop];
    // If it's a function, bind it to the client
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');
  if (!isConfigured) {
    console.warn('Supabase not configured:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
    });
    
    // Client-side debugging
    if (typeof window !== 'undefined') {
      console.warn('[Supabase Config] Client-side env check:', {
        urlFromEnv: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        keyFromEnv: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
        note: 'If env vars are NOT SET here, restart your dev server (Next.js only loads env vars on startup)',
      });
    }
  }
  return isConfigured;
};

