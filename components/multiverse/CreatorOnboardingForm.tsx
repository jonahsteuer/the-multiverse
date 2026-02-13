'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreatorAccountData, UserType } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveAccount } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Schema with optional fields - we'll validate conditionally based on login/signup
const creatorOnboardingSchema = z.object({
  creatorName: z.string().min(1, 'Creator name is required').max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  userType: z.enum(['artist', 'videographer', 'editor', 'viewer']).optional(),
  spotifyLinked: z.boolean().optional(),
  instagramLinked: z.boolean().optional(),
});

type CreatorOnboardingFormData = z.infer<typeof creatorOnboardingSchema>;

interface CreatorOnboardingFormProps {
  onSuccess?: (data: CreatorAccountData) => void | Promise<void>;
}

const USER_TYPES: { value: UserType; label: string }[] = [
  { value: 'artist', label: 'Artist' },
  { value: 'videographer', label: 'Videographer' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

export function CreatorOnboardingForm({ onSuccess }: CreatorOnboardingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(false);
  const [spotifyLinked, setSpotifyLinked] = useState(false);
  const [instagramLinked, setInstagramLinked] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatorOnboardingFormData>({
    resolver: zodResolver(creatorOnboardingSchema),
    defaultValues: {
      userType: 'artist',
      spotifyLinked: false,
      instagramLinked: false,
    },
  });

  const userType = watch('userType');

  const onSubmit = async (data: CreatorOnboardingFormData) => {
    setIsSubmitting(true);
    setError(null);

    // Validate required fields based on login/signup
    if (!isLogin && (!data.creatorName || !data.userType)) {
      setError('Creator name and type are required for sign up');
      setIsSubmitting(false);
      return;
    }

    try {
      let accountData: CreatorAccountData;

      // TEST USER BYPASS: Auto-login to most recent test user account
      if (isLogin && isSupabaseConfigured()) {
        const normalizedName = data.email.trim().toLowerCase();
        if (normalizedName === 'cam okoro' || normalizedName === 'camokoro') {
          console.log('[Test User] Detected Cam Okoro - finding most recent account...');
          
          // Query for most recent Cam Okoro profile
          const { data: profiles, error: queryError } = await supabase
            .from('profiles')
            .select('*')
            .ilike('creator_name', '%cam%okoro%')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (queryError) {
            console.error('[Test User] Query error:', queryError);
          } else if (profiles && profiles.length > 0) {
            const profile = profiles[0];
            console.log('[Test User] Found Cam account:', profile.email, 'created:', profile.created_at);
            
            // Auto-login to this account (bypass password check)
            // We need to sign in with the actual credentials, but we don't have the password
            // So instead, we'll just load the data and mark them as authenticated
            accountData = {
              creatorName: profile.creator_name,
              email: profile.email,
              password: '',
              userType: profile.user_type,
              spotifyLinked: profile.spotify_linked,
              instagramLinked: profile.instagram_linked,
              onboardingComplete: profile.onboarding_complete,
              onboardingProfile: profile.onboarding_profile,
            };
            
            // Store to localStorage
            await saveAccount(accountData);
            onSuccess?.(accountData);
            return;
          } else {
            throw new Error('No Cam Okoro test account found. Please create one first.');
          }
        }
      }

      if (isSupabaseConfigured()) {
        // Use Supabase authentication
        if (isLogin) {
          // Sign in
          console.log('[SignIn] 🔄 Attempting sign in for:', data.email);
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });
          console.log('[SignIn] ✅ Auth response received');

          if (authError) {
            console.error('[SignIn] ❌ Auth error:', authError.message);
            // Handle email confirmation error specifically
            if (authError.message?.includes('Email not confirmed') || authError.message?.includes('email_not_confirmed')) {
              throw new Error(
                'Please check your email and click the confirmation link before signing in. ' +
                'If you didn\'t receive the email, check your spam folder or contact support.'
              );
            }
            throw authError;
          }
          if (!authData.user) throw new Error('Sign in failed');
          console.log('[SignIn] ✅ User authenticated:', authData.user.id);

          // Load account from database
          console.log('[SignIn] 🔄 Loading profile from database...');
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (!profileData) {
            throw new Error('Profile not found. Please sign up first.');
          }
          console.log('[SignIn] ✅ Profile loaded:', profileData.creator_name, 'onboarding_complete:', profileData.onboarding_complete);

          // Load onboarding data from profile if it exists
          const onboardingComplete = profileData.onboarding_complete || false;
          const onboardingProfile = profileData.onboarding_profile || null;
          
          accountData = {
            creatorName: profileData.creator_name,
            email: profileData.email,
            password: '', // Don't store password
            userType: profileData.user_type,
            spotifyLinked: profileData.spotify_linked,
            instagramLinked: profileData.instagram_linked,
            onboardingComplete,
            onboardingProfile,
          };
        } else {
          // Sign up
          console.log('Attempting Supabase sign up...');
          let { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
          });

          console.log('Sign up response:', { authData, authError });

          // If user already exists, show error message instead of auto-signing in
          if (authError?.message?.includes('already registered') || 
              authError?.message?.includes('already exists') ||
              authError?.message?.includes('User already registered')) {
            throw new Error('An account with this email already exists. Please sign in instead.');
          }

          if (authError) {
            console.error('Auth error:', authError);
            
            // Handle rate limiting specifically
            if (authError.message?.includes('14 seconds') || authError.message?.includes('rate limit')) {
              throw new Error(
                'Please wait a moment before trying again. ' +
                'Supabase has rate limiting to prevent spam. ' +
                'Try again in about 15 seconds.'
              );
            }
            
            // Handle email confirmation requirement
            if (authError.message?.includes('Email not confirmed') || authError.message?.includes('email_not_confirmed')) {
              throw new Error(
                'Account created! Please check your email and click the confirmation link to activate your account. ' +
                'If you didn\'t receive the email, check your spam folder. ' +
                'For development, you can disable email confirmation in Supabase settings.'
              );
            }
            
            throw new Error(authError.message || 'Sign up failed');
          }
          if (!authData.user) {
            throw new Error('Sign up failed - no user returned');
          }

          // Wait a moment for the session to be established
          // This ensures auth.uid() is available for RLS policies
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify we have a session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.warn('No session after signup, but continuing...');
          }

          // Try using the database function first (bypasses RLS)
          console.log('[Signup] 🔄 Creating profile in Supabase for user:', authData.user.id);
          
          let profileData = null;
          let profileError = null;

          // First, try using the database function (more reliable)
          // Function now returns JSONB with the profile data
          const { data: functionData, error: functionError } = await supabase.rpc(
            'create_profile_for_user',
            {
              user_id: authData.user.id,
              user_email: data.email,
              user_name: data.creatorName,
              user_type: data.userType,
              spotify_linked: spotifyLinked,
              instagram_linked: instagramLinked,
            }
          );

          if (functionError) {
            console.warn('Function call failed, trying direct insert:', functionError);
            
            // Fallback to direct insert
            const { data: insertData, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: authData.user.id,
                creator_name: data.creatorName,
                email: data.email,
                user_type: data.userType,
                spotify_linked: spotifyLinked,
                instagram_linked: instagramLinked,
              })
              .select()
              .single();

            profileData = insertData;
            profileError = insertError;
          } else {
            // Function succeeded and returned profile data
            console.log('[Signup] ✅ ACCOUNT CREATED IN SUPABASE via function:', functionData);
            
            // Convert JSONB to object if needed
            if (functionData) {
              profileData = typeof functionData === 'string' 
                ? JSON.parse(functionData) 
                : functionData;
            } else {
              // Fallback: fetch the profile to verify
              console.log('No data returned from function, fetching profile...');
              const { data: fetchedProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();
              
              profileData = fetchedProfile;
              profileError = fetchError;
            }
          }

          console.log('Profile creation response:', { 
            profileData, 
            profileError,
            hasProfile: !!profileData 
          });

          if (profileError) {
            // Extract error details properly
            const errorMessage = profileError.message || 'Failed to create profile';
            const errorCode = (profileError as any)?.code;
            const errorDetails = (profileError as any)?.details;
            const errorHint = (profileError as any)?.hint;
            
            console.error('Profile error details:', {
              message: errorMessage,
              code: errorCode,
              details: errorDetails,
              hint: errorHint,
              fullError: profileError,
            });
            
            // If RLS error, provide more helpful message
            if (errorCode === '42501' || errorMessage?.includes('row-level security')) {
              throw new Error(
                'Failed to create profile: Row-level security policy violation. ' +
                'Please ensure you have run the SQL schema in Supabase, including the ' +
                'create_profile_for_user function. Alternatively, disable email confirmation ' +
                'in Supabase Authentication settings.'
              );
            }
            
            // Handle "Cannot coerce" error specifically
            if (errorMessage?.includes('Cannot coerce') || errorMessage?.includes('coerce')) {
              throw new Error(
                'Profile creation function error. The profile may have been created successfully. ' +
                'Please try logging in with your credentials.'
              );
            }
            
            throw new Error(errorMessage);
          }
          
          // Verify we got profile data
          if (!profileData) {
            throw new Error('Profile creation succeeded but profile data not found. Please try logging in.');
          }

          // Check for test accounts that should skip onboarding
          const isJulianKenji = data.creatorName === 'Julian kenji' || data.creatorName === 'Julian Kenji';
          const isLeonTax = data.creatorName === 'Leon Tax';
          const shouldSkipOnboarding = isJulianKenji || isLeonTax;
          
          // Julian Kenji's onboarding data (from completed conversation)
          const julianOnboardingData = {
            genre: ["indie pop"],
            musicalInspiration: ["Dominic Fike"],
            visualAesthetic: "effortlessly cool",
            visualStyleDescription: "Dominic Fike inspired aesthetic - effortlessly cool vibe",
            releases: [
              {
                type: "album",
                name: "Rabbit Season",
                releaseDate: "2026-01-30",
                isReleased: true,
                songs: ["blur", "psychedelic", "I love you so much", "cliche", "freak", "high demand", "me and you", "melody", "what's up"]
              }
            ],
            hasBestPosts: true,
            bestPostDescription: "voiceover video about near-death experience and how it led to the genesis of the album - worked because of personal storytelling",
            platforms: ["instagram", "tiktok"],
            currentPostingFrequency: "couple times a week",
            desiredPostingFrequency: "3-4x_week",
            enjoyedContentFormats: ["artsy performance videos", "jumping to music with cool editing"],
            equipment: "Canon DSLR, iPhone camera, tripod",
            timeBudgetHoursPerWeek: 7,
            preferredDays: ["saturday", "sunday"],
            hasExistingAssets: false,
            existingAssetsDescription: "none currently, will film new content",
            hasTeam: true,
            teamMembers: "videographer friends who can help shoot ideas",
          };
          
          // Leon Tax's onboarding data
          const leonOnboardingData = {
            genre: ["indie pop"],
            musicalInspiration: ["Dominic Fike", "Bon Iver"],
            visualAesthetic: "dreamy atmospheric",
            visualStyleDescription: "aesthetic performance shots with atmospheric elements",
            releases: [
              {
                type: "single",
                name: "will I find you",
                releaseDate: "2025-03-01",
                isReleased: false,
                songs: ["will I find you"]
              }
            ],
            hasBestPosts: true,
            bestPostDescription: "Performance shot with Snapchat filter got 1200 views, 40 likes, 9 comments - worked because it showed authentic performance with visual enhancement",
            platforms: ["instagram", "tiktok"],
            currentPostingFrequency: "none",
            desiredPostingFrequency: "2-3x_week",
            enjoyedContentFormats: ["visually aesthetic performance shots"],
            equipment: "iPhone, camcorder, Canon DSLR",
            timeBudgetHoursPerWeek: 6,
            preferredDays: ["friday", "saturday", "sunday"],
            hasExistingAssets: true,
            existingAssetsDescription: "Yosemite camcorder footage for next single promotion",
            hasTeam: true,
            teamMembers: "girlfriend (shoot/edit), roommate Julian (shooting ideas)",
          };
          
          if (shouldSkipOnboarding) {
            console.log('[Signup] 🎯 TEST ACCOUNT DETECTED - Skipping onboarding for:', data.creatorName);
          }
          
          accountData = {
            creatorName: data.creatorName || '',
            email: data.email || '',
            password: '', // Don't store password
            userType: data.userType || 'artist',
            spotifyLinked: spotifyLinked,
            instagramLinked: instagramLinked,
            onboardingComplete: shouldSkipOnboarding,
            onboardingProfile: isJulianKenji ? julianOnboardingData as any : (isLeonTax ? leonOnboardingData as any : undefined),
          };
        }
      } else {
        // Fallback: use localStorage only
        // Check for test accounts that should skip onboarding
        const isJulianKenji = data.creatorName === 'Julian kenji' || data.creatorName === 'Julian Kenji';
        const isLeonTax = data.creatorName === 'Leon Tax';
        const shouldSkipOnboarding = isJulianKenji || isLeonTax;
        
        // Julian Kenji's onboarding data
        const julianOnboardingData = {
          genre: ["indie pop"],
          musicalInspiration: ["Dominic Fike"],
          visualAesthetic: "effortlessly cool",
          visualStyleDescription: "Dominic Fike inspired aesthetic - effortlessly cool vibe",
          releases: [
            {
              type: "album",
              name: "Rabbit Season",
              releaseDate: "2026-01-30",
              isReleased: true,
              songs: ["blur", "psychedelic", "I love you so much", "cliche", "freak", "high demand", "me and you", "melody", "what's up"]
            }
          ],
          hasBestPosts: true,
          bestPostDescription: "voiceover video about near-death experience and how it led to the genesis of the album",
          platforms: ["instagram", "tiktok"],
          currentPostingFrequency: "couple times a week",
          desiredPostingFrequency: "3-4x_week",
          enjoyedContentFormats: ["artsy performance videos", "jumping to music with cool editing"],
          equipment: "Canon DSLR, iPhone camera, tripod",
          timeBudgetHoursPerWeek: 7,
          preferredDays: ["saturday", "sunday"],
          hasExistingAssets: false,
          existingAssetsDescription: "none currently, will film new content",
          hasTeam: true,
          teamMembers: "videographer friends who can help shoot ideas",
        };
        
        // Leon Tax's onboarding data
        const leonOnboardingData = {
          genre: ["indie pop"],
          musicalInspiration: ["Dominic Fike", "Bon Iver"],
          visualAesthetic: "dreamy atmospheric",
          visualStyleDescription: "aesthetic performance shots with atmospheric elements",
          releases: [
            {
              type: "single",
              name: "will I find you",
              releaseDate: "2025-03-01",
              isReleased: false,
              songs: ["will I find you"]
            }
          ],
          hasBestPosts: true,
          bestPostDescription: "Performance shot with Snapchat filter got 1200 views, 40 likes, 9 comments",
          platforms: ["instagram", "tiktok"],
          currentPostingFrequency: "none",
          desiredPostingFrequency: "2-3x_week",
          enjoyedContentFormats: ["visually aesthetic performance shots"],
          equipment: "iPhone, camcorder, Canon DSLR",
          timeBudgetHoursPerWeek: 6,
          preferredDays: ["friday", "saturday", "sunday"],
          hasExistingAssets: true,
          existingAssetsDescription: "Yosemite camcorder footage for next single promotion",
          hasTeam: true,
          teamMembers: "girlfriend (shoot/edit), roommate Julian (shooting ideas)",
        };
        
        if (shouldSkipOnboarding) {
          console.log('[Signup] 🎯 TEST ACCOUNT DETECTED (localStorage) - Skipping onboarding for:', data.creatorName);
        }
        
        accountData = {
          creatorName: data.creatorName || '',
          email: data.email || '',
          password: data.password || '',
          userType: data.userType || 'artist',
          spotifyLinked: spotifyLinked,
          instagramLinked: instagramLinked,
          onboardingComplete: shouldSkipOnboarding,
          onboardingProfile: isJulianKenji ? julianOnboardingData as any : (isLeonTax ? leonOnboardingData as any : undefined),
        };
      }

      // Save account (to Supabase or localStorage)
      await saveAccount(accountData);

      console.log('[CreatorOnboarding] ✅ Account saved, calling onSuccess');
      
      if (onSuccess) {
        // Don't await — let the parent handle loading state independently
        // This ensures the form becomes interactive again quickly
        try {
          const result = onSuccess(accountData);
          // If it's a promise, attach error handler to prevent unhandled rejection
          if (result && typeof (result as any).catch === 'function') {
            (result as any).catch((err: Error) => {
              console.error('[CreatorOnboarding] onSuccess handler error:', err);
            });
          }
        } catch (err) {
          console.error('[CreatorOnboarding] onSuccess sync error:', err);
        }
      }
    } catch (error) {
      console.error('Error with account:', error);
      
      // Better error message extraction
      let errorMessage = 'Failed to create account';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        // Handle Supabase AuthApiError
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if ('error_description' in error) {
          errorMessage = String(error.error_description);
        } else {
          // Try to extract from Supabase error structure
          const supabaseError = error as any;
          if (supabaseError?.message) {
            errorMessage = supabaseError.message;
          } else if (supabaseError?.error_description) {
            errorMessage = supabaseError.error_description;
          } else {
            // Try to stringify the error
            try {
              errorMessage = JSON.stringify(error, null, 2);
            } catch {
              errorMessage = 'Unknown error occurred';
            }
          }
        }
      }
      
      // Log full error details for debugging
      const errorDetails: any = {
        errorType: typeof error,
        isSupabaseConfigured: isSupabaseConfigured(),
      };
      
      if (error && typeof error === 'object') {
        errorDetails.errorKeys = Object.keys(error);
        
        // Try to extract Supabase-specific error properties
        const supabaseError = error as any;
        if (supabaseError.message) errorDetails.message = supabaseError.message;
        if (supabaseError.status) errorDetails.status = supabaseError.status;
        if (supabaseError.statusCode) errorDetails.statusCode = supabaseError.statusCode;
        if (supabaseError.code) errorDetails.code = supabaseError.code;
        if (supabaseError.details) errorDetails.details = supabaseError.details;
        if (supabaseError.hint) errorDetails.hint = supabaseError.hint;
      }
      
      console.error('Full error details:', errorDetails);
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-black/90 border-yellow-500/50">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-star-wars text-yellow-400 mb-2">
          {isLogin ? 'Welcome Back' : 'Join The Multiverse'}
        </CardTitle>
        <CardDescription className="text-gray-400 font-star-wars">
          {isLogin ? 'Sign in to continue your journey' : 'Begin Your Journey'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Creator Name */}
          <div className="space-y-2">
            <Label htmlFor="creatorName" className="font-star-wars text-yellow-400">
              Creator Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="creatorName"
              placeholder="Your creator name"
              {...register('creatorName')}
              className="bg-black/50 border-yellow-500/30 text-white font-star-wars placeholder:text-gray-600 focus:border-yellow-500"
            />
            {errors.creatorName && (
              <p className="text-sm text-red-500">{errors.creatorName.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="font-star-wars text-yellow-400">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              {...register('email')}
              className="bg-black/50 border-yellow-500/30 text-white font-star-wars placeholder:text-gray-600 focus:border-yellow-500"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="font-star-wars text-yellow-400">
              Creator Encryption <span className="text-red-500">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your encryption"
              {...register('password')}
              className="bg-black/50 border-yellow-500/30 text-white font-star-wars placeholder:text-gray-600 focus:border-yellow-500"
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* User Type - Only show on signup */}
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="userType" className="font-star-wars text-yellow-400">
                Creator Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={userType}
                onValueChange={(value) => setValue('userType', value as UserType)}
              >
                <SelectTrigger className="bg-black/50 border-yellow-500/30 text-white font-star-wars focus:border-yellow-500">
                  <SelectValue placeholder="Select your type" />
                </SelectTrigger>
                <SelectContent className="bg-black border-yellow-500/30">
                  {USER_TYPES.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      className="font-star-wars text-white hover:bg-yellow-500/20"
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.userType && (
                <p className="text-sm text-red-500">{errors.userType.message}</p>
              )}
            </div>
          )}

          {/* Spotify Link - Only show on signup */}
          {!isLogin && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="spotifyLinked"
                  checked={spotifyLinked}
                  onChange={(e) => {
                    setSpotifyLinked(e.target.checked);
                    setValue('spotifyLinked', e.target.checked);
                  }}
                  className="w-4 h-4 text-yellow-500 bg-black border-yellow-500/30 rounded focus:ring-yellow-500"
                />
                <Label htmlFor="spotifyLinked" className="font-star-wars text-yellow-400 cursor-pointer">
                  Link Spotify
                </Label>
              </div>
            </div>
          )}

          {/* Instagram Link - Only show on signup */}
          {!isLogin && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="instagramLinked"
                  checked={instagramLinked}
                  onChange={(e) => {
                    setInstagramLinked(e.target.checked);
                    setValue('instagramLinked', e.target.checked);
                  }}
                  className="w-4 h-4 text-yellow-500 bg-black border-yellow-500/30 rounded focus:ring-yellow-500"
                />
                <Label htmlFor="instagramLinked" className="font-star-wars text-yellow-400 cursor-pointer">
                  Link Instagram
                </Label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md border border-red-500/20 font-star-wars">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 text-lg"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (isLogin ? 'Signing in...' : 'Initializing...') 
              : (isLogin ? 'Sign In' : 'Enter The Multiverse')}
          </Button>

          {/* Toggle Login/Signup */}
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-sm text-gray-400 hover:text-yellow-400 font-star-wars transition-colors"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

