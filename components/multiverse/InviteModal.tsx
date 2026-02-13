'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TeamRole, TeamInvitation } from '@/types';

interface InviteModalProps {
  teamId: string;
  teamName: string;
  onClose: () => void;
  onInviteCreated?: (invitation: TeamInvitation) => void;
}

const ROLE_OPTIONS: { value: TeamRole; label: string; emoji: string; description: string }[] = [
  { value: 'videographer', label: 'Videographer', emoji: '🎬', description: 'Films and edits content' },
  { value: 'editor', label: 'Editor', emoji: '✂️', description: 'Edits and post-produces content' },
  { value: 'manager', label: 'Manager', emoji: '📋', description: 'Manages strategy and scheduling' },
  { value: 'artist', label: 'Artist', emoji: '🎵', description: 'The musical artist' },
  { value: 'other', label: 'Other', emoji: '🤝', description: 'General collaborator' },
];

export function InviteModal({ teamId, teamName, onClose, onInviteCreated }: InviteModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<TeamRole>('videographer');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateInvite = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          role: selectedRole,
          invitedName: name || undefined,
          invitedEmail: email || undefined,
        }),
      });

      const data = await response.json();
      if (data.success && data.invitation) {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/invite/${data.invitation.inviteToken}`;
        setInviteLink(link);
        onInviteCreated?.(data.invitation);
      } else {
        setError(data.error || 'Failed to create invite');
      }
    } catch (err) {
      setError('Failed to create invite. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = inviteLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmail = () => {
    if (!inviteLink) return;
    const subject = encodeURIComponent(`Join ${teamName} on Come Up`);
    const body = encodeURIComponent(
      `Hey${name ? ` ${name}` : ''}!\n\nI'd like you to join my team as a ${selectedRole}.\n\nClick here to accept: ${inviteLink}\n\nSee you there!`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  const handleText = () => {
    if (!inviteLink) return;
    const message = encodeURIComponent(
      `Hey${name ? ` ${name}` : ''}! Join my team on Come Up as a ${selectedRole}: ${inviteLink}`
    );
    // Try native share first on mobile
    if (navigator.share) {
      navigator.share({
        title: `Join ${teamName}`,
        text: `Join my team on Come Up as a ${selectedRole}`,
        url: inviteLink,
      }).catch(() => {
        // Fallback to SMS
        window.open(`sms:?body=${message}`);
      });
    } else {
      window.open(`sms:?body=${message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-gradient-to-b from-gray-900 to-black border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👥</span>
              <h2 className="text-xl font-bold text-white">Invite Team Member</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {!inviteLink ? (
            <>
              {/* Name Input */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Name (optional)</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Ruby"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Email (optional)</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ruby@email.com"
                  type="email"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Role</label>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role.value}
                      onClick={() => setSelectedRole(role.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        selectedRole === role.value
                          ? 'border-purple-500 bg-purple-500/10 text-white'
                          : 'border-gray-700 bg-gray-800/30 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-lg">{role.emoji}</span>
                      <div className="text-left">
                        <div className="font-medium text-sm">{role.label}</div>
                        <div className="text-xs text-gray-400">{role.description}</div>
                      </div>
                      {selectedRole === role.value && (
                        <div className="ml-auto text-purple-400">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</div>
              )}

              {/* Generate Link Button */}
              <Button
                onClick={handleCreateInvite}
                disabled={isCreating}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-medium"
              >
                {isCreating ? 'Creating invite...' : 'Generate Invite Link'}
              </Button>
            </>
          ) : (
            <>
              {/* Success State — share options */}
              <div className="text-center space-y-2">
                <div className="text-3xl">✅</div>
                <h3 className="text-lg font-bold text-white">Invite Created!</h3>
                <p className="text-sm text-gray-400">
                  Share this link with {name || 'your team member'} to invite them as {selectedRole}.
                </p>
              </div>

              {/* Invite Link Display */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Invite link:</div>
                <div className="text-sm text-purple-300 break-all font-mono">{inviteLink}</div>
              </div>

              {/* Share Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleEmail}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-700 bg-gray-800/30 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all text-gray-300 hover:text-blue-300"
                >
                  <span className="text-xl">📧</span>
                  <span className="text-xs font-medium">Email</span>
                </button>
                <button
                  onClick={handleText}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-700 bg-gray-800/30 hover:border-green-500/50 hover:bg-green-500/10 transition-all text-gray-300 hover:text-green-300"
                >
                  <span className="text-xl">💬</span>
                  <span className="text-xs font-medium">Text</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-700 bg-gray-800/30 hover:border-yellow-500/50 hover:bg-yellow-500/10 transition-all text-gray-300 hover:text-yellow-300"
                >
                  <span className="text-xl">{copied ? '✅' : '🔗'}</span>
                  <span className="text-xs font-medium">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* Done Button */}
              <Button
                onClick={onClose}
                variant="outline"
                className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 py-3 rounded-xl"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

