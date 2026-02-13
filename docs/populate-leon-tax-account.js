// Script to populate Leon Tax account with onboarding data
// Run this in browser console after logging in as Leon Tax

const onboardingData = {
  genre: ["indie pop", "folk elements"],
  musicalInspiration: ["Dominic Fike", "Bon Iver"],
  visualAesthetic: "aesthetic performance shots in nature",
  visualStyleDescription: "mini music videos in natural settings",
  releases: [
    {
      type: "single",
      name: "Will I Find You",
      releaseDate: "2026-03-01", // Updated to 2026
      isReleased: false,
      songs: ["Will I Find You"]
    },
    {
      type: "ep",
      name: "Moving Fast and Slow",
      releaseDate: "2026-03-22", // Updated to 2026
      isReleased: false,
      songs: ["Will I Find You", "Break My Chain", "Set You Free"]
    }
  ],
  hasBestPosts: true,
  bestPostDescription: "June 6th post for 'Breathe Me In' - 1.2k views, storytelling with contrast between hopeful prom proposal footage and 'she did me dirty' caption, mixed iPhone and performance footage",
  platforms: ["tiktok", "instagram"],
  currentPostingFrequency: "less_than_weekly",
  desiredPostingFrequency: "2-3x_week",
  enjoyedContentFormats: ["aesthetic performance shots in nature", "mini music videos"],
  equipment: "phone_basic",
  timeBudgetHoursPerWeek: 6,
  preferredDays: ["friday", "saturday", "sunday"],
  hasExistingAssets: true,
  existingAssetsDescription: "Yosemite footage with girlfriend - nature performance shots by river on camcorder",
  hasTeam: true,
  teamDescription: "girlfriend helps shoot and edit, Julian helps shoot"
};

// Load account
const accountJson = localStorage.getItem('multiverse_account');
if (accountJson) {
  const account = JSON.parse(accountJson);
  if (account.creatorName === 'Leon Tax') {
    // Update account with onboarding data
    account.onboardingComplete = true;
    account.onboardingProfile = onboardingData;
    localStorage.setItem('multiverse_account', JSON.stringify(account));
    console.log('✅ Account updated with onboarding data');
    console.log('Account:', account);
    
    // Reload page to apply changes
    console.log('🔄 Reloading page...');
    setTimeout(() => window.location.reload(), 1000);
  } else {
    console.log('❌ Account name does not match. Current account:', account.creatorName);
  }
} else {
  console.log('❌ No account found in localStorage');
}

