'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TeamInvitation } from '@/types';

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Account creation form
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Load invitation details
  useEffect(() => {
    async function loadInvitation() {
      try {
        const response = await fetch(`/api/team/invite?token=${token}`);
        const data = await response.json();

        if (data.success && data.invitation) {
          setInvitation(data.invitation);
          if (data.invitation.invitedName) {
            setDisplayName(data.invitation.invitedName);
          }
          if (data.invitation.invitedEmail) {
            setEmail(data.invitation.invitedEmail);
          }
          if (data.invitation.status === 'accepted') {
            setAccepted(true);
          }
        } else {
          setError('This invite link is invalid or has expired.');
        }
      } catch (err) {
        setError('Failed to load invitation. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadInvitation();
    }
  }, [token]);

  const handleAccept = async () => {
    if (!displayName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      // 1. Create account via Supabase Auth
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });

      if (authError) {
        // Try to sign in if user already exists
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(authError.message);
          setIsAccepting(false);
          return;
        }

        if (!signInData.user) {
          setError('Failed to sign in.');
          setIsAccepting(false);
          return;
        }

        // Accept the invitation with existing user
        const response = await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'accept',
            token,
            userId: signInData.user.id,
            displayName,
          }),
        });

        const result = await response.json();
        if (result.success) {
          setAccepted(true);
        } else {
          setError('Failed to accept invitation.');
        }
        setIsAccepting(false);
        return;
      }

      if (!authData.user) {
        setError('Failed to create account.');
        setIsAccepting(false);
        return;
      }

      // 2. Create profile (minimal — no onboarding)
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        creator_name: displayName,
        email,
        user_type: invitation?.role || 'videographer',
        onboarding_complete: true, // Skip onboarding for invited members
        updated_at: new Date().toISOString(),
      });

      // 3. Accept the invitation
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          token,
          userId: authData.user.id,
          displayName,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setAccepted(true);
      } else {
        setError('Failed to accept invitation.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-purple-400 animate-pulse text-lg">Loading invitation...</div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="text-4xl">❌</div>
          <h1 className="text-xl font-bold text-white">Invalid Invite</h1>
          <p className="text-gray-400">{error}</p>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="border-gray-700 text-gray-300"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-6 p-8 max-w-md">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-bold text-white">Welcome to the team!</h1>
          <p className="text-gray-400">
            You&apos;ve joined {invitation?.inviterName ? `${invitation.inviterName}'s` : 'the'} team
            as a {invitation?.role}.
          </p>
          <Button
            onClick={() => window.location.href = '/'}
            className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl"
          >
            Open App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Space background effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-black" />
      <div className="absolute inset-0">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: Math.random() * 0.5 + 0.2,
            }}
          />
        ))}
      </div>

      {/* Invite Card */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-gradient-to-b from-gray-900/95 to-black/95 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/20 overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <div className="p-8 text-center border-b border-purple-500/20">
          <div className="text-4xl mb-4">🎵</div>
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;ve been invited!</h1>
          <p className="text-gray-300">
            {invitation?.inviterName || 'Someone'} has invited you to join
            their team as a <span className="text-purple-300 font-medium">{invitation?.role}</span>
          </p>
          {invitation?.team && (
            <div className="mt-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <div className="text-sm text-gray-400">Team</div>
              <div className="text-lg font-bold text-purple-300">{invitation.team.name}</div>
            </div>
          )}
        </div>

        {/* Account Creation Form */}
        <div className="p-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Create your account</h2>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Your Name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Ruby"
              className="bg-gray-800/50 border-gray-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ruby@email.com"
              type="email"
              className="bg-gray-800/50 border-gray-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Password</label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              type="password"
              className="bg-gray-800/50 border-gray-700 text-white"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
          )}

          <Button
            onClick={handleAccept}
            disabled={isAccepting || !displayName || !email || !password}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-medium text-lg"
          >
            {isAccepting ? 'Joining...' : '✅ Accept Invitation'}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Already have an account? Use the same email and password to sign in.
          </p>
        </div>
      </div>
    </div>
  );
}

