'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ArtistProfile } from '@/types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const GENRES = [
  'pop', 'hip-hop', 'r&b', 'indie', 'alternative', 'electronic', 'dance',
  'singer-songwriter', 'country', 'rock', 'jazz', 'soul', 'afrobeats',
  'latin', 'classical', 'folk', 'punk', 'metal', 'gospel', 'reggae',
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm text-gray-300 mb-1 font-medium">{label}</label>
      {hint && <p className="text-[11px] text-gray-600 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/70 transition-colors"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/70 resize-none transition-colors"
    />
  );
}

function SaveBadge({ saved }: { saved: boolean }) {
  if (!saved) return null;
  return <span className="text-[11px] text-green-400 ml-2">✓ Saved</span>;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProfileEditPanelProps {
  userId: string;
  currentEmail?: string;
  displayName?: string;
  artistProfile?: Partial<ArtistProfile>;
  /** Called after any successful save so GalaxyView can refresh profile data */
  onProfileUpdated?: (updated: Partial<ArtistProfile>) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ProfileEditPanel({
  userId,
  currentEmail,
  displayName,
  artistProfile,
  onProfileUpdated,
}: ProfileEditPanelProps) {

  // ── Identity ────────────────────────────────────────────────────────────────
  const [creatorName, setCreatorName] = useState(
    (artistProfile as any)?.creatorName || displayName || ''
  );
  const [bio, setBio] = useState((artistProfile as any)?.bio || '');

  // ── Genre ───────────────────────────────────────────────────────────────────
  const [genres, setGenres] = useState<string[]>(artistProfile?.genre || []);
  const [customGenre, setCustomGenre] = useState('');

  // ── Social Handles ──────────────────────────────────────────────────────────
  const [tiktok, setTiktok] = useState((artistProfile as any)?.tiktokHandle || '');
  const [instagram, setInstagram] = useState((artistProfile as any)?.instagramHandle || '');
  const [youtube, setYoutube] = useState((artistProfile as any)?.youtubeHandle || '');
  const [spotify, setSpotify] = useState((artistProfile as any)?.spotifyUrl || '');

  // ── Location & Logistics ────────────────────────────────────────────────────
  const [homeCity, setHomeCity] = useState((artistProfile as any)?.homeCity || '');
  const [zipCode, setZipCode] = useState((artistProfile as any)?.zipCode || '');
  const [maxTravelTime, setMaxTravelTime] = useState(
    (artistProfile as any)?.maxTravelTime || '30 minutes'
  );
  const [preferredDays, setPreferredDays] = useState<string[]>(
    artistProfile?.preferredDays || []
  );

  // ── Save state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState<string | null>(null);

  const markSaved = (section: string) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2500);
  };

  const saveToSupabase = useCallback(async (updates: Partial<ArtistProfile> & Record<string, unknown>) => {
    setSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: prof } = await supabase
        .from('profiles')
        .select('onboarding_profile')
        .eq('id', userId)
        .single();
      const merged = { ...(prof?.onboarding_profile || {}), ...updates };
      await supabase.from('profiles').update({ onboarding_profile: merged }).eq('id', userId);
      onProfileUpdated?.(merged as Partial<ArtistProfile>);
    } catch (e) {
      console.error('[ProfileEditPanel] save error:', e);
    } finally {
      setSaving(false);
    }
  }, [userId, onProfileUpdated]);

  // ── Section savers ──────────────────────────────────────────────────────────

  const saveIdentity = async () => {
    await saveToSupabase({ creatorName, bio } as any);
    // Also update creator_name in the profiles table directly
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('profiles').update({ creator_name: creatorName }).eq('id', userId);
    } catch { /* silent */ }
    markSaved('identity');
  };

  const saveGenres = async () => {
    await saveToSupabase({ genre: genres });
    markSaved('genres');
  };

  const saveSocials = async () => {
    await saveToSupabase({ tiktokHandle: tiktok, instagramHandle: instagram, youtubeHandle: youtube, spotifyUrl: spotify } as any);
    markSaved('socials');
  };

  const saveLocation = async () => {
    await saveToSupabase({ homeCity, zipCode, maxTravelTime, preferredDays } as any);
    markSaved('location');
  };

  const toggleDay = (day: string) =>
    setPreferredDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );

  const toggleGenre = (g: string) =>
    setGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );

  const addCustomGenre = () => {
    const trimmed = customGenre.trim().toLowerCase();
    if (trimmed && !genres.includes(trimmed)) {
      setGenres(prev => [...prev, trimmed]);
    }
    setCustomGenre('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Identity ── */}
      <div className="bg-gray-800/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Identity</SectionTitle>
          <SaveBadge saved={savedSection === 'identity'} />
        </div>
        <Field label="Display name">
          <TextInput value={creatorName} onChange={setCreatorName} placeholder="Your artist name" />
        </Field>
        <Field label="Email" hint="Contact only — cannot be changed here">
          <div className="w-full bg-gray-800/30 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-500">
            {currentEmail || '—'}
          </div>
        </Field>
        <Field label="Bio" hint="One sentence about your music / style">
          <TextArea value={bio} onChange={setBio} placeholder="e.g. LA-based alt-pop artist writing about late nights and long drives." rows={2} />
        </Field>
        <button
          onClick={saveIdentity}
          disabled={saving}
          className="mt-1 px-4 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save identity
        </button>
      </div>

      {/* ── Genre & Style ── */}
      <div className="bg-gray-800/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Genre & style</SectionTitle>
          <SaveBadge saved={savedSection === 'genres'} />
        </div>
        <Field label="Genres" hint="Select all that apply">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                  genres.includes(g)
                    ? 'bg-purple-600/40 border border-purple-500/60 text-purple-200'
                    : 'bg-gray-700/50 border border-gray-600/50 text-gray-400 hover:border-gray-500'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <TextInput
              value={customGenre}
              onChange={setCustomGenre}
              placeholder="Add custom genre…"
            />
            <button
              onClick={addCustomGenre}
              disabled={!customGenre.trim()}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white disabled:opacity-40 transition-colors flex-shrink-0"
            >
              Add
            </button>
          </div>
          {genres.filter(g => !GENRES.includes(g)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {genres.filter(g => !GENRES.includes(g)).map(g => (
                <span
                  key={g}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-blue-600/30 border border-blue-500/40 text-blue-300"
                >
                  {g}
                  <button onClick={() => toggleGenre(g)} className="text-blue-400 hover:text-blue-200 text-[10px]">✕</button>
                </span>
              ))}
            </div>
          )}
        </Field>
        <button
          onClick={saveGenres}
          disabled={saving}
          className="px-4 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save genres
        </button>
      </div>

      {/* ── Social handles ── */}
      <div className="bg-gray-800/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Social handles</SectionTitle>
          <SaveBadge saved={savedSection === 'socials'} />
        </div>
        {[
          { label: '🎵 TikTok', value: tiktok, setter: setTiktok, placeholder: '@yourhandle' },
          { label: '📸 Instagram', value: instagram, setter: setInstagram, placeholder: '@yourhandle' },
          { label: '▶️ YouTube', value: youtube, setter: setYoutube, placeholder: '@yourchannel' },
          { label: '💚 Spotify', value: spotify, setter: setSpotify, placeholder: 'Artist URL or name' },
        ].map(({ label, value, setter, placeholder }) => (
          <Field key={label} label={label}>
            <TextInput value={value} onChange={setter} placeholder={placeholder} />
          </Field>
        ))}
        <button
          onClick={saveSocials}
          disabled={saving}
          className="px-4 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save handles
        </button>
      </div>

      {/* ── Location & Logistics ── */}
      <div className="bg-gray-800/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Location & logistics</SectionTitle>
          <SaveBadge saved={savedSection === 'location'} />
        </div>
        <Field label="Home city" hint="Pre-fills location suggestions in brainstorm sessions">
          <TextInput value={homeCity} onChange={setHomeCity} placeholder="e.g. Los Angeles" />
        </Field>
        <Field label="Zip / postal code" hint="Used for hyper-local weather checks during planning">
          <TextInput value={zipCode} onChange={setZipCode} placeholder="e.g. 90028" />
        </Field>
        <Field label="Max travel time to shoot">
          <div className="flex flex-wrap gap-2">
            {['10 minutes', '20 minutes', '30 minutes', '1 hour', '2+ hours'].map(t => (
              <button
                key={t}
                onClick={() => setMaxTravelTime(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  maxTravelTime === t
                    ? 'bg-purple-600/40 border border-purple-500/60 text-purple-200'
                    : 'bg-gray-700/50 border border-gray-600/50 text-gray-400 hover:border-gray-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Preferred shoot days">
          <div className="flex flex-wrap gap-2">
            {DAYS.map(d => (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  preferredDays.includes(d)
                    ? 'bg-purple-600/40 border border-purple-500/60 text-purple-200'
                    : 'bg-gray-700/50 border border-gray-600/50 text-gray-400 hover:border-gray-500'
                }`}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </Field>
        <button
          onClick={saveLocation}
          disabled={saving}
          className="px-4 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save location
        </button>
      </div>

    </div>
  );
}
