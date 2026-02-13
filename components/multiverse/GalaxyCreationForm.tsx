'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Galaxy, VisualLandscape } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const galaxyCreationSchema = z.object({
  name: z.string().min(1, 'Galaxy name is required').max(100),
  numberOfWorlds: z.number().min(1, 'Must have at least 1 world').max(20, 'Maximum 20 worlds'),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Release date must be in YYYY-MM-DD format').optional().or(z.literal('')),
});

type GalaxyCreationFormData = z.infer<typeof galaxyCreationSchema>;

interface GalaxyCreationFormProps {
  universeId: string;
  onSuccess?: (galaxyData: Partial<Galaxy>) => void;
  onCancel?: () => void;
}

// Mock Pinterest images for now - will be replaced with actual API
const MOCK_PINTEREST_IMAGES = [
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=400',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
  'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
];

const COLOR_PALETTE = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#000080', '#808080',
];

export function GalaxyCreationForm({ universeId, onSuccess, onCancel }: GalaxyCreationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [displayedImages, setDisplayedImages] = useState<string[]>(MOCK_PINTEREST_IMAGES);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GalaxyCreationFormData>({
    resolver: zodResolver(galaxyCreationSchema),
    defaultValues: {
      numberOfWorlds: 3,
    },
  });

  const handleImageSelect = (imageUrl: string) => {
    if (selectedImages.includes(imageUrl)) {
      setSelectedImages(selectedImages.filter((img) => img !== imageUrl));
    } else {
      setSelectedImages([...selectedImages, imageUrl]);
      // TODO: When Pinterest API is integrated, fetch similar images here
      // For now, just shuffle the displayed images
      setDisplayedImages([...displayedImages].sort(() => Math.random() - 0.5));
    }
  };

  const handleColorSelect = (color: string) => {
    if (selectedColors.includes(color)) {
      setSelectedColors(selectedColors.filter((c) => c !== color));
    } else {
      setSelectedColors([...selectedColors, color]);
    }
  };

  const onSubmit = async (data: GalaxyCreationFormData) => {
    setIsSubmitting(true);

    try {
      const visualLandscape: VisualLandscape = {
        images: selectedImages,
        colorPalette: selectedColors,
      };

      const galaxyData: Partial<Galaxy> = {
        name: data.name,
        universeId,
        releaseDate: data.releaseDate && data.releaseDate.trim() !== '' ? data.releaseDate : undefined,
        visualLandscape,
        worlds: [], // Will be created after galaxy is created
      };

      if (onSuccess) {
        onSuccess(galaxyData);
      }
    } catch (error) {
      console.error('Error creating galaxy:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-black/95 border-yellow-500/50">
        <CardHeader>
          <CardTitle className="text-3xl font-star-wars text-yellow-400 mb-2">
            Create Your Galaxy
          </CardTitle>
          <CardDescription className="text-gray-400 font-star-wars">
            Build the foundation of your release
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Galaxy Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="font-star-wars text-yellow-400">
                Galaxy Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Name of your album/project"
                {...register('name')}
                className="bg-black/50 border-yellow-500/30 text-white font-star-wars placeholder:text-gray-600 focus:border-yellow-500"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Number of Worlds */}
            <div className="space-y-2">
              <Label htmlFor="numberOfWorlds" className="font-star-wars text-yellow-400">
                Number of Worlds (Songs) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="numberOfWorlds"
                type="number"
                min="1"
                max="20"
                {...register('numberOfWorlds', { valueAsNumber: true })}
                className="bg-black/50 border-yellow-500/30 text-white font-star-wars placeholder:text-gray-600 focus:border-yellow-500"
              />
              {errors.numberOfWorlds && (
                <p className="text-sm text-red-500">{errors.numberOfWorlds.message}</p>
              )}
            </div>

            {/* Visual Landscape - Pinterest Images */}
            <div className="space-y-2">
              <Label className="font-star-wars text-yellow-400">
                Visual Landscape - Select Reference Images
              </Label>
              <p className="text-sm text-gray-400 mb-4">
                Choose images that represent your galaxy's aesthetic. We'll show you similar images as you select.
              </p>
              <div className="grid grid-cols-4 gap-4 max-h-64 overflow-y-auto">
                {displayedImages.map((imageUrl, index) => (
                  <div
                    key={index}
                    className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                      selectedImages.includes(imageUrl)
                        ? 'border-yellow-500 ring-2 ring-yellow-500'
                        : 'border-gray-700 hover:border-yellow-500/50'
                    }`}
                    onClick={() => handleImageSelect(imageUrl)}
                  >
                    <img
                      src={imageUrl}
                      alt={`Reference ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                    {selectedImages.includes(imageUrl) && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-black rounded-full w-6 h-6 flex items-center justify-center font-bold">
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {selectedImages.length > 0 && (
                <p className="text-sm text-yellow-400 mt-2">
                  {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Color Palette */}
            <div className="space-y-2">
              <Label className="font-star-wars text-yellow-400">
                Color Palette
              </Label>
              <p className="text-sm text-gray-400 mb-4">
                Select colors that represent your galaxy's visual identity
              </p>
              <div className="flex flex-wrap gap-3">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorSelect(color)}
                    className={`w-12 h-12 rounded-full border-2 transition-all ${
                      selectedColors.includes(color)
                        ? 'border-yellow-500 ring-2 ring-yellow-500 scale-110'
                        : 'border-gray-700 hover:border-yellow-500/50'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              {selectedColors.length > 0 && (
                <p className="text-sm text-yellow-400 mt-2">
                  {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Release Date */}
            <div className="space-y-2">
              <Label htmlFor="releaseDate" className="font-star-wars text-yellow-400">
                Galaxy Release Date <span className="text-gray-500 text-xs">(Optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="releaseDate"
                  type="date"
                  min={today}
                  {...register('releaseDate')}
                  className="bg-black/50 border-yellow-500/30 text-white font-star-wars placeholder:text-gray-600 focus:border-yellow-500 pr-10 cursor-pointer"
                  style={{
                    colorScheme: 'dark',
                    WebkitAppearance: 'none',
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  📅
                </span>
              </div>
              {errors.releaseDate && (
                <p className="text-sm text-red-500">{errors.releaseDate.message}</p>
              )}
              <p className="text-sm text-gray-400">
                Only needed if releasing multiple songs as an album/project. Leave blank for single releases.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1 font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1 font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Building Your Galaxy...' : 'Create Galaxy'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

