'use client';

import { useState, useEffect, useMemo } from 'react';
import type { World, Universe, Snapshot, ArtistProfile } from '@/types';
import { generatePostingScheduleOutline, type PostingScheduleOutline } from '@/lib/posting-schedule-outline';
import { calculatePostingDates } from '@/lib/snapshot-schedule';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { addDays, subDays } from 'date-fns';

interface SnapshotStarterProps {
  world: World;
  universe: Universe;
  artistProfile?: ArtistProfile;
  onSnapshotApproved: (snapshot: Snapshot) => void;
  onSnapshotUpdated: (snapshot: Snapshot) => void;
  onSnapshotDeleted: (snapshotId: string) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SnapshotIdea {
  visualDescription: string;
  platform: string;
  contentType: string;
  whyItWorks: string;
}

export function SnapshotStarter({
  world,
  universe,
  artistProfile,
  onSnapshotApproved,
  onSnapshotUpdated,
  onSnapshotDeleted,
}: SnapshotStarterProps) {
  const [viewMode, setViewMode] = useState<'schedule' | 'create'>('schedule');
  const [postingOutline, setPostingOutline] = useState<PostingScheduleOutline[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<SnapshotIdea[]>([]);
  const [currentSnapshotDraft, setCurrentSnapshotDraft] = useState<Partial<Snapshot> | null>(null);
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(null);

  // Initialize posting outline on mount
  useEffect(() => {
    if (world.releaseDate) {
      const outline = generatePostingScheduleOutline(world.releaseDate, 7);
      // Mark approved snapshots
      if (world.snapshotStrategy?.snapshots) {
        world.snapshotStrategy.snapshots.forEach((snapshot) => {
          if (snapshot.postingDate && snapshot.status === 'approved') {
            const outlineItem = outline.find(
              (item) => item.postingDate === snapshot.postingDate
            );
            if (outlineItem) {
              outlineItem.status = 'approved';
              outlineItem.snapshotId = snapshot.id;
            }
          }
        });
      }
      setPostingOutline(outline);
    }
  }, [world.releaseDate, world.snapshotStrategy]);

  // Get approved snapshots
  const approvedSnapshots = useMemo(() => {
    return world.snapshotStrategy?.snapshots.filter(s => s.status === 'approved') || [];
  }, [world.snapshotStrategy]);

  const handleGetSuggestions = async () => {
    setIsGenerating(true);
    setChatMessages([
      {
        role: 'assistant',
        content: "Let me generate some snapshot ideas for you based on your profile and this world's aesthetic...",
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await fetch('/api/generate-snapshot-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldName: world.name,
          releaseDate: world.releaseDate,
          color: world.color,
          visualReferences: world.visualLandscape.images,
          artistProfile: artistProfile ? {
            genre: artistProfile.genre,
            enjoyedContentFormats: artistProfile.enjoyedContentFormats,
            bestPosts: artistProfile.bestPosts,
            visualAesthetic: artistProfile.visualAesthetic,
          } : undefined,
          existingSnapshots: approvedSnapshots.map(s => ({
            visualDescription: s.visualDescription,
            platform: s.platform,
          })),
        }),
      });

      if (response.ok) {
        const { ideas } = await response.json();
        setSuggestedIdeas(ideas);
        setChatMessages([
          {
            role: 'assistant',
            content: `I've generated ${ideas.length} snapshot ideas for you. Take a look and let me know which one you'd like to develop, or tell me your own idea!`,
            timestamp: new Date(),
          },
        ]);
      } else {
        throw new Error('Failed to generate ideas');
      }
    } catch (error) {
      console.error('Error generating ideas:', error);
      setChatMessages([
        {
          role: 'assistant',
          content: 'Sorry, I had trouble generating ideas. Try typing your own idea and I can help you develop it!',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUserMessage = async (message: string) => {
    const newMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, newMessage]);
    setUserInput('');

    // Simple response logic (can be enhanced with AI)
    const response: ChatMessage = {
      role: 'assistant',
      content: "That's a great idea! Let me help you develop it. Can you tell me more about what you envision? What's the mood, setting, or key visual elements?",
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, response]);

    // If user input looks like a snapshot idea, start building draft
    if (message.length > 20) {
      setCurrentSnapshotDraft({
        visualDescription: message,
        worldId: world.id,
        platform: 'instagram',
        contentType: 'reel',
        status: 'draft',
        order: approvedSnapshots.length + 1,
      });
    }
  };

  const handleSelectIdea = (idea: SnapshotIdea) => {
    setCurrentSnapshotDraft({
      visualDescription: idea.visualDescription,
      worldId: world.id,
      platform: idea.platform as any,
      contentType: idea.contentType as any,
      status: 'draft',
      order: approvedSnapshots.length + 1,
    });
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: `I like this idea: ${idea.visualDescription}`,
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: "Great choice! Let's refine this idea. What would you like to adjust or add?",
        timestamp: new Date(),
      },
    ]);
  };

  const handleApproveSnapshot = () => {
    if (!currentSnapshotDraft || !selectedOutlineId) return;

    const outlineItem = postingOutline.find((item) => item.id === selectedOutlineId);
    if (!outlineItem) return;

    // Calculate backwards planning dates
    const postingDate = new Date(outlineItem.postingDate);
    const shootDate = subDays(postingDate, 7); // 1 week before posting
    const editDeadline = subDays(postingDate, 2); // 2 days before posting
    const shotListDeadline = subDays(shootDate, 3); // 3 days before shoot
    const treatmentDeadline = subDays(shotListDeadline, 4); // 4 days before shot list

    const approvedSnapshot: Snapshot = {
      id: `snapshot-${Date.now()}`,
      worldId: world.id,
      visualDescription: currentSnapshotDraft.visualDescription || '',
      platform: currentSnapshotDraft.platform || 'instagram',
      contentType: currentSnapshotDraft.contentType || 'reel',
      postingDate: outlineItem.postingDate,
      weekLabel: outlineItem.weekLabel,
      order: approvedSnapshots.length + 1,
      status: 'approved',
      caption: currentSnapshotDraft.caption,
      suggestedFilmingDate: shootDate.toISOString().split('T')[0],
      shootDate: shootDate.toISOString().split('T')[0],
      editDeadline: editDeadline.toISOString().split('T')[0],
      shotListDeadline: shotListDeadline.toISOString().split('T')[0],
      treatmentDeadline: treatmentDeadline.toISOString().split('T')[0],
      timing: format(postingDate, 'EEEE') + ' 2pm',
    };

    onSnapshotApproved(approvedSnapshot);

    // Update outline
    const updatedOutline = postingOutline.map((item) =>
      item.id === selectedOutlineId
        ? { ...item, status: 'approved' as const, snapshotId: approvedSnapshot.id }
        : item
    );
    setPostingOutline(updatedOutline);

    // Reset
    setCurrentSnapshotDraft(null);
    setSelectedOutlineId(null);
    setChatMessages([]);
    setSuggestedIdeas([]);
    setViewMode('schedule');
  };

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex gap-2 border-b border-yellow-500/30 pb-4">
        <Button
          onClick={() => setViewMode('schedule')}
          variant={viewMode === 'schedule' ? 'default' : 'outline'}
          className={`font-star-wars ${
            viewMode === 'schedule'
              ? 'bg-yellow-500 text-black'
              : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
          }`}
        >
          View Schedule
        </Button>
        <Button
          onClick={() => setViewMode('create')}
          variant={viewMode === 'create' ? 'default' : 'outline'}
          className={`font-star-wars ${
            viewMode === 'create'
              ? 'bg-yellow-500 text-black'
              : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
          }`}
        >
          Create Snapshot
        </Button>
      </div>

      {/* Schedule View */}
      {viewMode === 'schedule' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-star-wars text-yellow-400 mb-4">
              Posting Schedule Outline
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              These are optimal posting dates. Fill them with snapshot ideas to build your schedule.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {postingOutline.map((item) => {
              const snapshot = approvedSnapshots.find((s) => s.id === item.snapshotId);
              return (
                <Card
                  key={item.id}
                  className={`border-yellow-500/30 bg-black/50 ${
                    item.status === 'approved' ? 'border-green-500/50' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-400 font-star-wars font-bold">
                            Post snapshot on {format(new Date(item.postingDate), 'MMM d, yyyy')}
                          </span>
                          <span className="text-xs text-gray-500">({item.weekLabel})</span>
                        </div>
                        {item.status === 'approved' && snapshot ? (
                          <div className="mt-2">
                            <p className="text-white text-sm font-medium">{snapshot.visualDescription.substring(0, 60)}...</p>
                            <p className="text-gray-400 text-xs mt-1">
                              {snapshot.platform} • {snapshot.contentType}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCurrentSnapshotDraft(snapshot);
                                  setSelectedOutlineId(item.id);
                                  setViewMode('create');
                                }}
                                className="text-xs font-star-wars border-yellow-500/30 text-yellow-400"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (confirm('Delete this snapshot?')) {
                                    onSnapshotDeleted(snapshot.id);
                                    const updated = postingOutline.map((i) =>
                                      i.id === item.id
                                        ? { ...i, status: 'pending' as const, snapshotId: undefined }
                                        : i
                                    );
                                    setPostingOutline(updated);
                                  }
                                }}
                                className="text-xs font-star-wars border-red-500/30 text-red-400"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm italic">- [idea pending]</p>
                        )}
                      </div>
                      {item.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedOutlineId(item.id);
                            setViewMode('create');
                          }}
                          className="font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black text-xs"
                        >
                          Add Idea
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Create View */}
      {viewMode === 'create' && (
        <div className="space-y-6">
          {/* Selected Posting Date */}
          {selectedOutlineId && (
            <Card className="border-yellow-500/30 bg-black/50">
              <CardContent className="p-4">
                <p className="text-yellow-400 font-star-wars">
                  Creating snapshot for:{' '}
                  {format(
                    new Date(
                      postingOutline.find((item) => item.id === selectedOutlineId)?.postingDate || ''
                    ),
                    'MMMM d, yyyy'
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Suggested Ideas */}
          {suggestedIdeas.length > 0 && !currentSnapshotDraft && (
            <div className="space-y-4">
              <h3 className="text-lg font-star-wars text-yellow-400">
                Suggested Snapshot Ideas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestedIdeas.map((idea, index) => (
                  <Card
                    key={index}
                    className="border-yellow-500/30 bg-black/50 cursor-pointer hover:border-yellow-500/70 transition-colors"
                    onClick={() => handleSelectIdea(idea)}
                  >
                    <CardContent className="p-4">
                      <p className="text-white font-medium mb-2">{idea.visualDescription}</p>
                      <p className="text-gray-400 text-sm mb-2">
                        {idea.platform} • {idea.contentType}
                      </p>
                      <p className="text-yellow-400 text-xs italic">{idea.whyItWorks}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Chat Interface */}
          <Card className="border-yellow-500/30 bg-black/50">
            <CardHeader>
              <CardTitle className="text-lg font-star-wars text-yellow-400">
                Brainstorm Your Snapshot Idea
              </CardTitle>
              <CardDescription className="text-gray-400">
                Type your idea or get suggestions from the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chat Messages */}
              <div className="space-y-3 max-h-64 overflow-y-auto border border-yellow-500/30 rounded p-4 bg-black/30">
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <p>Start by typing your idea or click "Get Suggestions"</p>
                  </div>
                )}
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-yellow-500/20 text-white'
                          : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 text-gray-300 rounded-lg p-3">
                      <p className="text-sm">Generating ideas...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && userInput.trim()) {
                      handleUserMessage(userInput);
                    }
                  }}
                  placeholder="Type your snapshot idea..."
                  className="flex-1 bg-black/50 border-yellow-500/30 text-white font-star-wars"
                />
                <Button
                  onClick={() => {
                    if (userInput.trim()) {
                      handleUserMessage(userInput);
                    }
                  }}
                  className="font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  Send
                </Button>
                <Button
                  onClick={handleGetSuggestions}
                  disabled={isGenerating}
                  variant="outline"
                  className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  Get Suggestions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Snapshot Draft Form */}
          {currentSnapshotDraft && (
            <Card className="border-yellow-500/30 bg-black/50">
              <CardHeader>
                <CardTitle className="text-lg font-star-wars text-yellow-400">
                  Finalize Your Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="font-star-wars text-yellow-400">Visual Description</Label>
                  <Textarea
                    value={currentSnapshotDraft.visualDescription || ''}
                    onChange={(e) =>
                      setCurrentSnapshotDraft({
                        ...currentSnapshotDraft,
                        visualDescription: e.target.value,
                      })
                    }
                    className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-star-wars text-yellow-400">Platform</Label>
                    <select
                      value={currentSnapshotDraft.platform || 'instagram'}
                      onChange={(e) =>
                        setCurrentSnapshotDraft({
                          ...currentSnapshotDraft,
                          platform: e.target.value as any,
                        })
                      }
                      className="w-full bg-black/50 border border-yellow-500/30 text-white font-star-wars p-2 rounded mt-2"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="twitter">Twitter</option>
                      <option value="youtube">YouTube</option>
                    </select>
                  </div>
                  <div>
                    <Label className="font-star-wars text-yellow-400">Content Type</Label>
                    <select
                      value={currentSnapshotDraft.contentType || 'reel'}
                      onChange={(e) =>
                        setCurrentSnapshotDraft({
                          ...currentSnapshotDraft,
                          contentType: e.target.value as any,
                        })
                      }
                      className="w-full bg-black/50 border border-yellow-500/30 text-white font-star-wars p-2 rounded mt-2"
                    >
                      <option value="reel">Reel</option>
                      <option value="video">Video</option>
                      <option value="photo">Photo</option>
                      <option value="story">Story</option>
                      <option value="carousel">Carousel</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="font-star-wars text-yellow-400">Caption (Optional)</Label>
                  <Textarea
                    value={currentSnapshotDraft.caption || ''}
                    onChange={(e) =>
                      setCurrentSnapshotDraft({
                        ...currentSnapshotDraft,
                        caption: e.target.value,
                      })
                    }
                    className="bg-black/50 border-yellow-500/30 text-white font-star-wars mt-2"
                    rows={2}
                    placeholder="Add a caption for this snapshot..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleApproveSnapshot}
                    disabled={!selectedOutlineId || !currentSnapshotDraft.visualDescription}
                    className="flex-1 font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  >
                    Approve & Add to Schedule
                  </Button>
                  <Button
                    onClick={() => {
                      setCurrentSnapshotDraft(null);
                      setSelectedOutlineId(null);
                    }}
                    variant="outline"
                    className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

