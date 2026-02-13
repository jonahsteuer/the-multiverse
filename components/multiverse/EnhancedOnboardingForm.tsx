'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ArtistProfile, BestPost } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Electronic', 'Indie', 'Alternative',
  'Folk', 'Jazz', 'Blues', 'Reggae', 'Metal', 'Punk', 'Classical', 'Other'
];

const VISUAL_AESTHETICS = [
  { value: 'dark_moody', label: 'Dark & Moody', description: 'Gothic, noir, cinematic' },
  { value: 'bright_energetic', label: 'Bright & Energetic', description: 'Neon, vibrant, high-energy' },
  { value: 'dreamy_ethereal', label: 'Dreamy & Ethereal', description: 'Soft, pastel, atmospheric' },
  { value: 'retro_vintage', label: 'Retro/Vintage', description: '80s, 90s, film grain' },
  { value: 'minimalist', label: 'Minimalist', description: 'Clean, simple, modern' },
  { value: 'custom', label: 'Custom', description: 'Describe your own' },
];

const POST_FORMATS = [
  { value: 'vlog', label: 'Vlog' },
  { value: 'lipsync', label: 'Lip Sync Video' },
  { value: 'guitar_performance', label: 'Guitar Performance' },
  { value: 'dance', label: 'Dance' },
  { value: 'lyric_video', label: 'Lyric Video' },
  { value: 'behind_scenes', label: 'Behind the Scenes' },
  { value: 'live_performance', label: 'Live Performance' },
  { value: 'other', label: 'Other' },
];

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
];

const POSTING_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: '2-3x_week', label: '2-3 times per week' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'less_than_weekly', label: 'Less than weekly' },
];

const enhancedOnboardingSchema = z.object({
  // Q1: Genre & Musical Style
  genre: z.array(z.string()).min(1, 'Select at least one genre'),
  musicalInspiration: z.array(z.string()).optional(),
  
  // Q2: Visual Style
  visualAesthetic: z.string().min(1, 'Select a visual aesthetic'),
  visualStyleDescription: z.string().optional(),
  
  // Q3: Best Performing Posts
  hasBestPosts: z.boolean(),
  bestPosts: z.array(z.object({
    description: z.string().min(1, 'Describe why it was successful'),
    postFormat: z.string(),
    postFormatOther: z.string().optional(),
    screenshotUrl: z.string().optional(),
    postUrl: z.string().url().optional().or(z.literal('')),
    metrics: z.object({
      views: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      streams: z.number().optional(),
    }).optional(),
  })).optional(),
  
  // Q4: Platforms & Frequency
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  primaryPlatform: z.string().min(1, 'Select a primary platform'),
  currentPostingFrequency: z.string().min(1, 'Select current posting frequency'),
  desiredPostingFrequency: z.string().min(1, 'Select desired posting frequency'),
  
  // Q5: Content Enjoyment & Experience
  enjoyedContentFormats: z.array(z.string()).min(1, 'Select at least one video format you enjoy'),
  enjoyedContentFormatsOther: z.string().optional(),
  contentCreationLevel: z.string().min(1, 'Select your experience level'),
  equipment: z.string().min(1, 'Select your equipment level'),
  
  // Pinterest (placeholder for future)
  pinterestBoards: z.array(z.string()).optional(),
});

type EnhancedOnboardingFormData = z.infer<typeof enhancedOnboardingSchema>;

interface EnhancedOnboardingFormProps {
  onComplete: (profile: ArtistProfile) => void;
  onSkip?: () => void;
}

export function EnhancedOnboardingForm({ onComplete, onSkip }: EnhancedOnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [musicalInspiration, setMusicalInspiration] = useState<string[]>([]);
  const [hasBestPosts, setHasBestPosts] = useState<boolean | null>(null);
  const [bestPosts, setBestPosts] = useState<BestPost[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EnhancedOnboardingFormData>({
    resolver: zodResolver(enhancedOnboardingSchema),
  });

  const visualAesthetic = watch('visualAesthetic');

  const handleGenreToggle = (genre: string) => {
    const newGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter(g => g !== genre)
      : [...selectedGenres, genre];
    setSelectedGenres(newGenres);
    setValue('genre', newGenres);
  };

  const handleAddBestPost = () => {
    setBestPosts([...bestPosts, {
      id: `post-${Date.now()}`,
      description: '',
      postFormat: 'vlog',
    }]);
  };

  const handleBestPostChange = (index: number, field: keyof BestPost, value: any) => {
    const updated = [...bestPosts];
    updated[index] = { ...updated[index], [field]: value };
    setBestPosts(updated);
    setValue('bestPosts', updated);
  };

  const handlePlatformToggle = (platform: string) => {
    const newPlatforms = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter(p => p !== platform)
      : [...selectedPlatforms, platform];
    setSelectedPlatforms(newPlatforms);
    setValue('platforms', newPlatforms);
    if (newPlatforms.length === 1) {
      setValue('primaryPlatform', newPlatforms[0]);
    }
  };

  const onSubmit = (data: EnhancedOnboardingFormData) => {
    const profile: ArtistProfile = {
      userId: '', // Will be set by parent
      genre: data.genre,
      musicalInspiration: data.musicalInspiration,
      visualAesthetic: data.visualAesthetic,
      visualStyleDescription: data.visualStyleDescription,
      hasBestPosts: data.hasBestPosts,
      bestPosts: (data.bestPosts || []) as any,
      platforms: data.platforms as ('instagram' | 'tiktok' | 'youtube' | 'twitter')[],
      primaryPlatform: data.primaryPlatform as 'instagram' | 'tiktok' | 'youtube' | 'twitter',
      currentPostingFrequency: data.currentPostingFrequency as any,
      desiredPostingFrequency: data.desiredPostingFrequency as any,
      enjoyedContentFormats: data.enjoyedContentFormats || [],
      enjoyedContentFormatsOther: data.enjoyedContentFormatsOther,
      contentCreationLevel: data.contentCreationLevel as 'beginner' | 'intermediate' | 'advanced',
      equipment: data.equipment as 'phone' | 'phone_basic' | 'camera' | 'full_setup',
      planningComfort: 'some_planning',
      pinterestBoards: data.pinterestBoards,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onComplete(profile);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto bg-black/95 border-yellow-500/50">
      <CardHeader>
        <CardTitle className="text-3xl font-star-wars text-yellow-400 mb-2">
          Tell Us About Your Art
        </CardTitle>
        <CardDescription className="text-gray-400 font-star-wars">
          Step {currentStep} of 5
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Q1: Genre & Musical Style */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <Label className="font-star-wars text-yellow-400 text-lg">
                What genre best describes your music?
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {GENRES.map(genre => (
                  <Button
                    key={genre}
                    type="button"
                    variant={selectedGenres.includes(genre) ? 'default' : 'outline'}
                    onClick={() => handleGenreToggle(genre)}
                    className={`font-star-wars ${
                      selectedGenres.includes(genre)
                        ? 'bg-yellow-500 text-black'
                        : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                    }`}
                  >
                    {genre}
                  </Button>
                ))}
              </div>
              {selectedGenres.length > 0 && (
                <div className="mt-4">
                  <Label className="font-star-wars text-yellow-400">
                    What artists inspire your sound? (Optional)
                  </Label>
                  <Input
                    placeholder="e.g., The Weeknd, Dua Lipa, Tame Impala"
                    className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2"
                    onChange={(e) => {
                      const artists = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setMusicalInspiration(artists);
                      setValue('musicalInspiration', artists);
                    }}
                  />
                </div>
              )}
              {errors.genre && (
                <p className="text-sm text-red-500">{errors.genre.message}</p>
              )}
            </div>
          )}

          {/* Q2: Visual Style */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Label className="font-star-wars text-yellow-400 text-lg">
                What visual aesthetic best matches your music?
              </Label>
              <div className="grid grid-cols-2 gap-4">
                {VISUAL_AESTHETICS.map(aesthetic => (
                  <Button
                    key={aesthetic.value}
                    type="button"
                    variant={visualAesthetic === aesthetic.value ? 'default' : 'outline'}
                    onClick={() => setValue('visualAesthetic', aesthetic.value)}
                    className={`font-star-wars h-auto py-4 flex flex-col items-start ${
                      visualAesthetic === aesthetic.value
                        ? 'bg-yellow-500 text-black'
                        : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                    }`}
                  >
                    <span className="font-bold">{aesthetic.label}</span>
                    <span className="text-sm opacity-80">{aesthetic.description}</span>
                  </Button>
                ))}
              </div>
              {visualAesthetic === 'custom' && (
                <div className="mt-4">
                  <Label className="font-star-wars text-yellow-400">
                    Describe your visual style in 2-3 sentences
                  </Label>
                  <Textarea
                    {...register('visualStyleDescription')}
                    className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2"
                    placeholder="Describe your unique visual aesthetic..."
                  />
                </div>
              )}
              {/* Pinterest API placeholder */}
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400 font-star-wars">
                  💡 Coming soon: Swipe through Pinterest images to select visual references
                </p>
              </div>
              {errors.visualAesthetic && (
                <p className="text-sm text-red-500">{errors.visualAesthetic.message}</p>
              )}
            </div>
          )}

          {/* Q3: Best Performing Posts */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <Label className="font-star-wars text-yellow-400 text-lg">
                Do you have any posts that performed really well?
              </Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={hasBestPosts === true ? 'default' : 'outline'}
                  onClick={() => {
                    setHasBestPosts(true);
                    setValue('hasBestPosts', true);
                  }}
                  className={`font-star-wars ${
                    hasBestPosts === true
                      ? 'bg-yellow-500 text-black'
                      : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                  }`}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={hasBestPosts === false ? 'default' : 'outline'}
                  onClick={() => {
                    setHasBestPosts(false);
                    setValue('hasBestPosts', false);
                    setBestPosts([]);
                  }}
                  className={`font-star-wars ${
                    hasBestPosts === false
                      ? 'bg-yellow-500 text-black'
                      : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                  }`}
                >
                  No
                </Button>
              </div>
              {hasBestPosts === true && (
                <div className="mt-4 space-y-4">
                  {bestPosts.map((post, index) => (
                    <Card key={post.id} className="bg-black/50 border-yellow-500/30 p-4">
                      <div className="space-y-4">
                        <Label className="font-star-wars text-yellow-400">
                          Post {index + 1}
                        </Label>
                        <Textarea
                          placeholder="Why do you think this post was successful?"
                          value={post.description}
                          onChange={(e) => handleBestPostChange(index, 'description', e.target.value)}
                          className="bg-black/50 border-yellow-500/30 text-white font-star-wars"
                        />
                        <div>
                          <Label className="font-star-wars text-yellow-400 text-sm">
                            Post Format
                          </Label>
                          <Select
                            value={post.postFormat}
                            onValueChange={(value) => handleBestPostChange(index, 'postFormat', value)}
                          >
                            <SelectTrigger className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {POST_FORMATS.map(format => (
                                <SelectItem key={format.value} value={format.value}>
                                  {format.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {post.postFormat === 'other' && (
                            <Input
                              placeholder="Describe the format"
                              value={post.postFormatOther || ''}
                              onChange={(e) => handleBestPostChange(index, 'postFormatOther', e.target.value)}
                              className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2"
                            />
                          )}
                        </div>
                        <Input
                          placeholder="Instagram/TikTok URL (optional)"
                          value={post.postUrl || ''}
                          onChange={(e) => handleBestPostChange(index, 'postUrl', e.target.value)}
                          className="bg-black/50 border-yellow-500/30 text-white font-star-wars"
                        />
                      </div>
                    </Card>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddBestPost}
                    className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    + Add Another Post
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Q4: Platforms & Frequency */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <Label className="font-star-wars text-yellow-400 text-lg">
                Which platforms do you post to?
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map(platform => (
                  <Button
                    key={platform.value}
                    type="button"
                    variant={selectedPlatforms.includes(platform.value) ? 'default' : 'outline'}
                    onClick={() => handlePlatformToggle(platform.value)}
                    className={`font-star-wars ${
                      selectedPlatforms.includes(platform.value)
                        ? 'bg-yellow-500 text-black'
                        : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                    }`}
                  >
                    {platform.label}
                  </Button>
                ))}
              </div>
              {selectedPlatforms.length > 0 && (
                <div className="mt-4">
                  <Label className="font-star-wars text-yellow-400">
                    Primary Platform
                  </Label>
                  <Select
                    value={watch('primaryPlatform')}
                    onValueChange={(value) => setValue('primaryPlatform', value)}
                  >
                    <SelectTrigger className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2">
                      <SelectValue placeholder="Select primary platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedPlatforms.map(platform => {
                        const p = PLATFORMS.find(pl => pl.value === platform);
                        return p ? (
                          <SelectItem key={platform} value={platform}>
                            {p.label}
                          </SelectItem>
                        ) : null;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="font-star-wars text-yellow-400">
                    Current Posting Frequency
                  </Label>
                  <Select
                    value={watch('currentPostingFrequency')}
                    onValueChange={(value) => setValue('currentPostingFrequency', value)}
                  >
                    <SelectTrigger className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTING_FREQUENCIES.map(freq => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-star-wars text-yellow-400">
                    Desired Posting Frequency
                  </Label>
                  <Select
                    value={watch('desiredPostingFrequency')}
                    onValueChange={(value) => setValue('desiredPostingFrequency', value)}
                  >
                    <SelectTrigger className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTING_FREQUENCIES.map(freq => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {errors.platforms && (
                <p className="text-sm text-red-500">{errors.platforms.message}</p>
              )}
            </div>
          )}

          {/* Q5: Content Enjoyment & Experience */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <Label className="font-star-wars text-yellow-400 text-lg">
                What kind of videos do you enjoy making?
              </Label>
              <p className="text-sm text-gray-400 mb-4">
                Consistency is impossible if you don't enjoy making the content. What formats do you actually like creating?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'vlog_talking', label: 'Vlog-style talking to camera' },
                  { value: 'performance', label: 'Performance videos (guitar, piano, vocals)' },
                  { value: 'behind_scenes', label: 'Behind-the-scenes content' },
                  { value: 'lyric_video', label: 'Lyric videos' },
                  { value: 'dance', label: 'Dance/choreography' },
                  { value: 'day_in_life', label: 'Day-in-the-life' },
                  { value: 'other', label: 'Other (describe)' },
                ].map(format => (
                  <Button
                    key={format.value}
                    type="button"
                    variant={watch('enjoyedContentFormats')?.includes(format.value) ? 'default' : 'outline'}
                    onClick={() => {
                      const current = watch('enjoyedContentFormats') || [];
                      const updated = current.includes(format.value)
                        ? current.filter(f => f !== format.value)
                        : [...current, format.value];
                      setValue('enjoyedContentFormats', updated);
                    }}
                    className={`font-star-wars ${
                      watch('enjoyedContentFormats')?.includes(format.value)
                        ? 'bg-yellow-500 text-black'
                        : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                    }`}
                  >
                    {format.label}
                  </Button>
                ))}
              </div>
              {watch('enjoyedContentFormats')?.includes('other') && (
                <div className="mt-4">
                  <Label className="font-star-wars text-yellow-400">
                    Describe the content you enjoy making
                  </Label>
                  <Textarea
                    {...register('enjoyedContentFormatsOther')}
                    placeholder="Describe the content formats you enjoy creating..."
                    className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2"
                  />
                </div>
              )}
              <div className="mt-6">
                <Label className="font-star-wars text-yellow-400">
                  How comfortable are you creating video content?
                </Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { value: 'beginner', label: 'Just Starting' },
                    { value: 'intermediate', label: 'Some Experience' },
                    { value: 'advanced', label: 'Experienced' },
                  ].map(level => (
                    <Button
                      key={level.value}
                      type="button"
                      variant={watch('contentCreationLevel') === level.value ? 'default' : 'outline'}
                      onClick={() => setValue('contentCreationLevel', level.value)}
                      className={`font-star-wars ${
                        watch('contentCreationLevel') === level.value
                          ? 'bg-yellow-500 text-black'
                          : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                      }`}
                    >
                      {level.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <Label className="font-star-wars text-yellow-400">
                  What equipment do you have?
                </Label>
                <Select
                  value={watch('equipment')}
                  onValueChange={(value) => setValue('equipment', value)}
                >
                  <SelectTrigger className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2">
                    <SelectValue placeholder="Select equipment level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Just phone</SelectItem>
                    <SelectItem value="phone_basic">Phone + basic equipment</SelectItem>
                    <SelectItem value="camera">Camera + equipment</SelectItem>
                    <SelectItem value="full_setup">Full setup + team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}


          {/* Navigation */}
          <div className="flex justify-between pt-4">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              >
                Back
              </Button>
            ) : (
              <div />
            )}
            {currentStep < 5 ? (
              <Button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              >
                Next
              </Button>
            ) : (
              <div className="flex gap-2">
                {onSkip && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onSkip}
                    className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    Skip for Now
                  </Button>
                )}
                <Button
                  type="submit"
                  className="font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  Complete
                </Button>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

