'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ArtistOnboardingData, ContentGenerationResponse } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Note: Toast component needs to be set up with Shadcn UI
// For now, using a simple alert - replace with toast when Shadcn toast is installed

// Validation schema matching API route
const onboardingSchema = z.object({
  artistName: z.string().min(1, 'Artist name is required').max(100),
  singleTitle: z.string().min(1, 'Single title is required').max(200),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Release date must be in YYYY-MM-DD format'),
  genre: z.string().min(1, 'Genre is required'),
  vibe: z.string().min(1, 'Vibe/tone is required').max(200),
  targetAudience: z.string().max(200).optional(),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

interface OnboardingFormProps {
  onSuccess?: (data: ArtistOnboardingData, results: ContentGenerationResponse) => void;
}

// Common genres for music artists
const GENRES = [
  'Pop',
  'Rock',
  'Hip-Hop',
  'R&B',
  'Country',
  'Electronic',
  'Indie',
  'Alternative',
  'Folk',
  'Jazz',
  'Blues',
  'Reggae',
  'Metal',
  'Punk',
  'Classical',
  'Other',
];

export function OnboardingForm({ onSuccess }: OnboardingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      targetAudience: '',
    },
  });

  const genre = watch('genre');

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      // Call the API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate content');
      }

      const result: ContentGenerationResponse = await response.json();
      
      setSuccess(`Success! Generated ${result.posts.length} posts for your release!`);
      setError(null);

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(data, result);
      }
    } catch (error) {
      console.error('Error generating content:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
      setError(errorMessage);
      setSuccess(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Tell us about your release</CardTitle>
        <CardDescription>
          We'll generate a complete content calendar tailored to your release cycle
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Artist Name */}
          <div className="space-y-2">
            <Label htmlFor="artistName">
              Artist Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="artistName"
              placeholder="Your artist name"
              {...register('artistName')}
              className={errors.artistName ? 'border-destructive' : ''}
            />
            {errors.artistName && (
              <p className="text-sm text-destructive">{errors.artistName.message}</p>
            )}
          </div>

          {/* Single Title */}
          <div className="space-y-2">
            <Label htmlFor="singleTitle">
              Single/Release Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="singleTitle"
              placeholder="Name of your upcoming release"
              {...register('singleTitle')}
              className={errors.singleTitle ? 'border-destructive' : ''}
            />
            {errors.singleTitle && (
              <p className="text-sm text-destructive">{errors.singleTitle.message}</p>
            )}
          </div>

          {/* Release Date */}
          <div className="space-y-2">
            <Label htmlFor="releaseDate">
              Release Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="releaseDate"
              type="date"
              min={today}
              {...register('releaseDate')}
              className={errors.releaseDate ? 'border-destructive' : ''}
            />
            {errors.releaseDate && (
              <p className="text-sm text-destructive">{errors.releaseDate.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              We'll create content for 2 weeks before and 2 weeks after your release
            </p>
          </div>

          {/* Genre */}
          <div className="space-y-2">
            <Label htmlFor="genre">
              Genre <span className="text-destructive">*</span>
            </Label>
            <Select
              value={genre}
              onValueChange={(value) => setValue('genre', value)}
            >
              <SelectTrigger className={errors.genre ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select your genre" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.genre && (
              <p className="text-sm text-destructive">{errors.genre.message}</p>
            )}
          </div>

          {/* Vibe/Tone */}
          <div className="space-y-2">
            <Label htmlFor="vibe">
              Vibe/Tone <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="vibe"
              placeholder="Describe the vibe, mood, or tone of your release (e.g., 'introspective and dreamy', 'energetic and upbeat', 'dark and moody')"
              rows={3}
              {...register('vibe')}
              className={errors.vibe ? 'border-destructive' : ''}
            />
            {errors.vibe && (
              <p className="text-sm text-destructive">{errors.vibe.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              This helps us match the voice and style of your content
            </p>
          </div>

          {/* Target Audience (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience (Optional)</Label>
            <Textarea
              id="targetAudience"
              placeholder="Who is your target audience? (e.g., 'Young adults 18-25 who love indie pop', 'Fans of bedroom pop and lo-fi')"
              rows={2}
              {...register('targetAudience')}
            />
            <p className="text-sm text-muted-foreground">
              Optional: Helps us tailor content to your specific audience
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md border border-green-200">
              {success}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Generating your content calendar...' : 'Generate Content Calendar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

