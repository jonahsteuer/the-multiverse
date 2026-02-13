'use client';

import { useState } from 'react';
import type { ContentGenerationResponse, GeneratedPost } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ResultsDisplayProps {
  results: ContentGenerationResponse;
  onReset: () => void;
}

export function ResultsDisplay({ results, onReset }: ResultsDisplayProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, postId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(postId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadAsJSON = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `content-calendar-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAsCSV = () => {
    const headers = ['Week', 'Platform', 'Content Type', 'Timing', 'Caption'];
    const rows = results.posts.map(post => [
      post.week,
      post.platform,
      post.contentType,
      post.timing,
      `"${post.caption.replace(/"/g, '""')}"` // Escape quotes for CSV
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `content-calendar-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const groupPostsByWeek = (posts: GeneratedPost[]) => {
    const grouped: Record<string, GeneratedPost[]> = {};
    posts.forEach(post => {
      if (!grouped[post.week]) {
        grouped[post.week] = [];
      }
      grouped[post.week].push(post);
    });
    return grouped;
  };

  const groupedPosts = groupPostsByWeek(results.posts);
  const weekOrder = ['Week -2', 'Week -1', 'Release Week', 'Week +1', 'Week +2'];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Content Calendar</h1>
          <p className="text-muted-foreground">{results.summary}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Generated on {new Date(results.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadAsJSON}>
            Download JSON
          </Button>
          <Button variant="outline" onClick={downloadAsCSV}>
            Download CSV
          </Button>
          <Button onClick={onReset}>
            Generate Another
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {weekOrder.map(week => {
          const posts = groupedPosts[week];
          if (!posts || posts.length === 0) return null;

          return (
            <Card key={week}>
              <CardHeader>
                <CardTitle>{week}</CardTitle>
                <CardDescription>
                  {posts.length} {posts.length === 1 ? 'post' : 'posts'} scheduled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2 items-center">
                          <span className="px-2 py-1 text-xs font-medium rounded bg-primary/10 text-primary">
                            {post.platform}
                          </span>
                          <span className="px-2 py-1 text-xs font-medium rounded bg-secondary text-secondary-foreground">
                            {post.contentType}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {post.timing}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(post.caption, post.id)}
                          className="h-8"
                        >
                          {copiedId === post.id ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

