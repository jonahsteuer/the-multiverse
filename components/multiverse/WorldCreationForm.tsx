'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { HexColorPicker } from 'react-colorful';
import type { World, VisualLandscape, SnapshotStrategy } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SONG_STAGES = [
  { value: 'writing', label: '✏️ Writing' },
  { value: 'recorded', label: '🎙️ Recorded' },
  { value: 'mixed', label: '🎚️ Mixed' },
  { value: 'mastered', label: '💿 Mastered' },
  { value: 'ready', label: '🚀 Ready to release' },
];

const worldCreationSchema = z.object({
  name: z.string().min(1, 'World name is required').max(100),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Release date must be in YYYY-MM-DD format'),
});

type WorldCreationFormData = z.infer<typeof worldCreationSchema>;

interface WorldCreationFormProps {
  galaxyId: string;
  galaxyVisualLandscape: VisualLandscape;
  onSuccess?: (worldData: Partial<World>) => void;
  onCancel?: () => void;
}

export function WorldCreationForm({
  galaxyId,
  galaxyVisualLandscape,
  onSuccess,
  onCancel,
}: WorldCreationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Creating World...');
  const [selectedColor, setSelectedColor] = useState<string>('#FFD700');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  // C, D, D+ — per-song context
  const [songEmotion, setSongEmotion] = useState('');
  const [songStage, setSongStage] = useState('');
  const [listeningContext, setListeningContext] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<WorldCreationFormData>();

  const handleImageSelect = (imageUrl: string) => {
    if (selectedImages.includes(imageUrl)) {
      setSelectedImages(selectedImages.filter((img) => img !== imageUrl));
    } else {
      setSelectedImages([...selectedImages, imageUrl]);
    }
  };


  const onSubmit = async (data: WorldCreationFormData) => {
    if (!selectedColor || selectedColor === '') {
      alert('Please select a color for your world');
      return;
    }

    setIsSubmitting(true);
    setLoadingMessage('Creating world...');

    try {
      // Don't auto-generate snapshots - user will create them in Snapshot Starter
      const strategy: SnapshotStrategy | null = null;

      const visualLandscape: VisualLandscape = {
        images: selectedImages.length > 0 ? selectedImages : galaxyVisualLandscape.images,
        colorPalette: selectedColor ? [selectedColor] : galaxyVisualLandscape.colorPalette,
      };

      const worldData: Partial<World> = {
        name: data.name,
        galaxyId,
        releaseDate: data.releaseDate,
        color: selectedColor,
        visualLandscape,
        snapshotStrategy: strategy || undefined,
        isPublic: false,
        isReleased: false,
        // Stafford: per-song context (C, D, D+)
        songEmotion: songEmotion.trim() || undefined,
        songStage: songStage || undefined,
        listeningContext: listeningContext.trim() || undefined,
      };
      
      // Debug: Log to ensure snapshots are included
      console.log('[WorldCreation] World data being created:', {
        name: worldData.name,
        releaseDate: worldData.releaseDate,
        hasSnapshotStrategy: !!strategy,
        snapshotCount: (strategy as SnapshotStrategy | null)?.snapshots?.length || 0
      });
      if (strategy) {
        console.log('[WorldCreation] Snapshots with posting dates:', (strategy as SnapshotStrategy).snapshots.map((s: any) => ({
          id: s.id,
          postingDate: s.postingDate,
          suggestedFilmingDate: s.suggestedFilmingDate,
          weekLabel: s.weekLabel,
          visualDescription: s.visualDescription ? s.visualDescription.substring(0, 30) : 'No description'
        })));
      }

      if (onSuccess) {
        onSuccess(worldData);
      }
    } catch (error) {
      console.error('Error creating world:', error);
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
            Build Your World
          </CardTitle>
          <CardDescription className="text-gray-400 font-star-wars">
            Create a single release within your galaxy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* World Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="font-star-wars text-yellow-400">
                World Name (Song Title) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Will I Find You"
                {...register('name')}
                className="bg-black/50 border-yellow-500/30 text-white font-star-wars placeholder:text-gray-600 focus:border-yellow-500"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Color Selection with Color Picker */}
            <div className="space-y-2">
              <Label className="font-star-wars text-yellow-400">
                World Color <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-gray-400 mb-4">
                Choose a color that represents this world's visual identity
              </p>
              <div className="flex flex-col items-center gap-4">
                {/* Color Picker */}
                <div className="relative">
                  <HexColorPicker
                    color={selectedColor}
                    onChange={setSelectedColor}
                    style={{ width: '200px', height: '200px' }}
                  />
                </div>
                {/* Selected Color Display */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-16 h-16 rounded-lg border-2 border-yellow-500 shadow-lg"
                    style={{ backgroundColor: selectedColor }}
                  />
                  <div className="flex flex-col">
                    <p className="text-sm text-yellow-400 font-star-wars">
                      Selected Color
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {selectedColor}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Selection (from galaxy or new) */}
            <div className="space-y-2">
              <Label className="font-star-wars text-yellow-400">
                Visual References
              </Label>
              <p className="text-sm text-gray-400 mb-4">
                Select specific images for this world (or use galaxy defaults)
              </p>
              <div className="grid grid-cols-4 gap-4 max-h-48 overflow-y-auto">
                {galaxyVisualLandscape.images.map((imageUrl, index) => (
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
                      className="w-full h-24 object-cover"
                    />
                    {selectedImages.includes(imageUrl) && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-black rounded-full w-6 h-6 flex items-center justify-center font-bold">
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Release Date */}
            <div className="space-y-2">
              <Label htmlFor="releaseDate" className="font-star-wars text-yellow-400">
                World Release Date <span className="text-red-500">*</span>
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
                This is when this single will be released (can be different from galaxy release date)
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-yellow-500/20 pt-4">
              <p className="text-sm text-yellow-400/70 font-star-wars mb-4">Song Context — helps Mark plan your content</p>

              {/* C: Song Emotion */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="songEmotion" className="font-star-wars text-yellow-400 text-sm">
                  In 1-2 words, what does this song feel like?
                </Label>
                <Input
                  id="songEmotion"
                  value={songEmotion}
                  onChange={e => setSongEmotion(e.target.value)}
                  placeholder="e.g. heartbreak, confidence, nostalgia, rage"
                  className="bg-black/50 border-yellow-500/30 text-white placeholder:text-gray-600 focus:border-yellow-500"
                />
                <p className="text-xs text-gray-500">This becomes the filter for all content ideas</p>
              </div>

              {/* D: Song Stage */}
              <div className="space-y-2 mb-4">
                <Label className="font-star-wars text-yellow-400 text-sm">
                  What stage is the song at?
                </Label>
                <div className="flex flex-wrap gap-2">
                  {SONG_STAGES.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSongStage(s.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        songStage === s.value
                          ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                          : 'bg-black/30 border-gray-700 text-gray-400 hover:border-yellow-500/50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* D+: Listening Context */}
              <div className="space-y-2">
                <Label htmlFor="listeningContext" className="font-star-wars text-yellow-400 text-sm">
                  Where do you imagine someone listening to this song?
                </Label>
                <Input
                  id="listeningContext"
                  value={listeningContext}
                  onChange={e => setListeningContext(e.target.value)}
                  placeholder="e.g. late-night drive, gym, bedroom, party, walking alone"
                  className="bg-black/50 border-yellow-500/30 text-white placeholder:text-gray-600 focus:border-yellow-500"
                />
                <p className="text-xs text-gray-500">Used to find the right shooting location for your content</p>
              </div>
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
                disabled={isSubmitting || !selectedColor}
              >
                {isSubmitting ? loadingMessage : 'Create World'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

