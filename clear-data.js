// Script to clear all data
// Run this in your browser console while on the app page

(async function clearAllData() {
  console.log('[clearAllData] Starting data clear...');
  
  // Clear localStorage
  if (typeof window !== 'undefined') {
    // Clear our specific keys
    localStorage.removeItem('multiverse_account');
    localStorage.removeItem('multiverse_universe');
    localStorage.removeItem('multiverse_current_galaxy');
    
    // Clear any Supabase session storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[clearAllData] localStorage cleared');
  }
  
  // Try to clear Supabase data if we have a session
  try {
    // Import supabase client (this will only work if you're on the app page)
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    
    const supabaseUrl = process?.env?.NEXT_PUBLIC_SUPABASE_URL || window.location.origin.includes('localhost') ? 'YOUR_SUPABASE_URL' : '';
    const supabaseKey = process?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Delete all user data
        await supabase.from('worlds').delete().eq('galaxy_id', 'any'); // This will be handled by RLS
        await supabase.from('galaxies').delete().eq('universe_id', 'any');
        await supabase.from('universes').delete().eq('creator_id', user.id);
        await supabase.from('profiles').delete().eq('id', user.id);
        await supabase.auth.signOut();
        console.log('[clearAllData] Supabase data cleared');
      }
    }
  } catch (error) {
    console.warn('[clearAllData] Could not clear Supabase data (may not be configured):', error);
  }
  
  console.log('[clearAllData] All data cleared - reloading page...');
  window.location.reload();
})();

