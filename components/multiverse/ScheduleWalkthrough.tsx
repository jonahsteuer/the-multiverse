'use client';

import { useState, useEffect } from 'react';

interface ScheduleWalkthroughProps {
  creatorName: string;
  songName: string;
  releaseDate: string;
  releaseStrategy?: 'promote_recent' | 'build_to_release' | 'audience_growth' | 'balanced';
  releaseStrategyDescription?: string;
  releases?: Array<{ title: string; releaseDate: string; type: string }>;
  highlightPhase: 'none' | 'intro' | 'release_info' | 'posting_phase' | 'prep_phase' | 'complete';
  onComplete?: () => void;
  /** Whether the artist already has raw footage (so we skip Film Day tasks) */
  hasExistingAssets?: boolean;
  rawFootageDescription?: string;
  /** Whether the artist has team members to invite */
  hasTeam?: boolean;
  teamMembersStr?: string;
}

interface CalendarDay {
  date: Date;
  label: string;
  type: 'prep' | 'posting' | 'release' | 'empty';
  postType?: 'audience-builder' | 'teaser' | 'promo';
  task?: string;
  isHighlighted?: boolean;
}

export function ScheduleWalkthrough({
  creatorName,
  songName,
  releaseDate,
  releaseStrategy = 'audience_growth',
  releaseStrategyDescription = '',
  releases = [],
  highlightPhase,
  hasExistingAssets = false,
  rawFootageDescription = '',
  hasTeam = false,
  teamMembersStr = '',
}: ScheduleWalkthroughProps) {
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);

  // Computed at component level so JSX can reference it too
  const hasFootage = hasExistingAssets || rawFootageDescription.length > 0;
  const editorName = teamMembersStr?.split(/[,&]/)[0]?.trim() || '';

  // Generate calendar based on release date
  useEffect(() => {
    console.log('[ScheduleWalkthrough] Generating calendar with:', {
      releaseDate,
      releaseStrategy,
      songName
    });
    
    const release = new Date(releaseDate);
    const today = new Date();
    const launchDay = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now
    
    console.log('[ScheduleWalkthrough] Release date parsed:', {
      releaseDate,
      releaseDateParsed: release.toISOString(),
      today: today.toISOString()
    });
    
    const days: CalendarDay[] = [];
    
    // Generate 4 weeks of calendar (2 prep + 2 posting)
    for (let i = 0; i < 28; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const isPrep = i < 14;
      const isRelease = date.toDateString() === release.toDateString();
      const isPostRelease = date.getTime() > release.getTime();
      
      let day: CalendarDay = {
        date,
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        type: isRelease ? 'release' : isPrep ? 'prep' : 'posting',
        isHighlighted: false,
      };
      
      // Add prep tasks for prep phase — adapt based on whether footage exists
      if (isPrep) {
        if (hasFootage) {
          // Artist already has footage: review/edit workflow instead of filming
          if (i === 0) day.task = hasTeam ? `👥 Invite ${editorName || 'team member'}` : '📁 Review & organize footage';
          if (i === 2) day.task = '📁 Review & organize footage';
          if (i === 5) day.task = editorName ? `📤 Send clips to ${editorName}` : '✂️ Start editing clips';
          if (i === 9) day.task = `✅ Review ${editorName ? `${editorName}'s` : ''} edits`;
          if (i === 13) day.task = '📱 Finalize posts for launch';
        } else {
          // Artist needs to create content from scratch
          if (i === 0) day.task = hasTeam ? `👥 Invite ${editorName || 'team member'}` : '📋 Plan content ideas';
          if (i === 1) day.task = hasTeam ? '📋 Plan content ideas' : undefined;
          if (i === 3) day.task = '🎬 Film Day 1';
          if (i === 7) day.task = '🎬 Film Day 2';
          if (i === 10) day.task = '✂️ Edit posts';
          if (i === 13) day.task = '✅ Review & finalize';
        }
      }
      
      // Add posting schedule — also post during the final prep days if release is near
      const daysToRelease = Math.floor((release.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      const isNearRelease = daysToRelease > 0 && daysToRelease <= 7;
      const shouldPost = !isRelease && (!isPrep || isNearRelease);

      if (shouldPost) {
        const dayOfWeek = date.getDay();
        
        // Post on Mon(1), Wed(3), Fri(5), Sat(6) to get enough teasers before release
        // In regular posting phase use Wed+Sat; in the final teaser week use Mon/Wed/Fri/Sat
        const isPostingDay = isNearRelease
          ? (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5 || dayOfWeek === 6)
          : (dayOfWeek === 3 || dayOfWeek === 6);

        if (isPostingDay) {
          // Count posts this week so far
          const postsThisWeek = days.filter(d => {
            const dWeekNum = Math.floor((days.indexOf(d)) / 7);
            return dWeekNum === Math.floor(i / 7) && d.postType;
          }).length;
          
          // CAMPAIGN WINDOW SYSTEM: Determine post type based on release timing
          let postType: 'audience-builder' | 'teaser' | 'promo' = 'audience-builder';
          const postDate = date;
          const strategyDesc = (releaseStrategyDescription || '').toLowerCase();
          
          console.log('[ScheduleWalkthrough] Post on', date.toDateString(), {
            releaseStrategy,
            releases: releases.length,
            postsThisWeek
          });
          
          // PRIORITY 1: Check for upcoming releases within 2 weeks (TEASER PHASE)
          let upcomingRelease = null;
          for (const release of releases) {
            if (!release.releaseDate || release.releaseDate === 'TBD') continue;
            const releaseDate = new Date(release.releaseDate);
            const daysUntilRelease = Math.floor((releaseDate.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilRelease > 0 && daysUntilRelease <= 14) {
              upcomingRelease = release;
              break; // Use the closest upcoming release
            }
          }
          
          if (upcomingRelease) {
            postType = 'teaser';
            console.log('[ScheduleWalkthrough] 🚨 TEASER PHASE: Release within 2 weeks:', upcomingRelease.title);
          } else {
            // PRIORITY 2: Check for recent releases within 1 month (PROMO PHASE)
            let recentRelease = null;
            for (const release of releases) {
              if (!release.releaseDate || release.releaseDate === 'TBD') continue;
              const releaseDate = new Date(release.releaseDate);
              const daysSinceRelease = Math.floor((postDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysSinceRelease > 0 && daysSinceRelease <= 30) {
                recentRelease = release;
                break; // Use the most recent release
              }
            }
            
            if (recentRelease) {
              postType = 'promo';
              console.log('[ScheduleWalkthrough] 🎵 PROMO PHASE: Release within 1 month:', recentRelease.title);
            } else {
              // PRIORITY 3: Check for manual override (old releases mentioned in description)
              if (strategyDesc.includes('promote') && strategyDesc.includes('bit')) {
                // "promote X a bit" = ~25% promo, 75% audience-builder
                postType = postsThisWeek % 4 === 0 ? 'promo' : 'audience-builder';
                console.log('[ScheduleWalkthrough] 💭 MANUAL OVERRIDE: Promote old release a bit');
              } else {
                // PRIORITY 4: Default to audience-builder
                postType = 'audience-builder';
                console.log('[ScheduleWalkthrough] 🌱 DEFAULT: Audience-builder');
              }
            }
          }
          
          day.postType = postType;
        } // end isPostingDay
      } // end shouldPost
      
      days.push(day);
    }
    
    setCalendar(days);
  }, [releaseDate, releaseStrategy, hasFootage, hasTeam, editorName]);

  // Update highlights based on current phase
  useEffect(() => {
    setCalendar(prev => prev.map(day => ({
      ...day,
      isHighlighted: 
        (highlightPhase === 'prep_phase' && day.type === 'prep' && !!day.task) ||
        (highlightPhase === 'posting_phase' && !!(day.postType || day.type === 'release')) ||
        (highlightPhase === 'release_info' && day.type === 'release'),
    })));
  }, [highlightPhase]);

  const getPostTypeColor = (type?: string) => {
    switch (type) {
      case 'audience-builder': return 'bg-green-500/30 border-green-500';
      case 'teaser': return 'bg-purple-500/30 border-purple-500';
      case 'promo': return 'bg-yellow-500/30 border-yellow-500';
      default: return 'bg-gray-800 border-gray-700';
    }
  };

  const getPostTypeEmoji = (type?: string) => {
    switch (type) {
      case 'audience-builder': return '🌱';
      case 'teaser': return '👀';
      case 'promo': return '🎵';
      default: return '';
    }
  };

  // Split calendar into weeks
  const weeks = [];
  for (let i = 0; i < calendar.length; i += 7) {
    weeks.push(calendar.slice(i, i + 7));
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Phase Labels */}
      <div className="flex mb-4 text-sm">
        <div className={`flex-1 text-center py-2 rounded-l-lg transition-all duration-500 ${
          highlightPhase === 'prep_phase' 
            ? 'bg-blue-500/30 border-2 border-blue-500 text-blue-300' 
            : 'bg-gray-800/50 border border-gray-700 text-gray-400'
        }`}>
          {hasFootage ? '📁 Pre-release Prep' : '📋 2-Week Prep Phase'}
        </div>
        <div className={`flex-1 text-center py-2 rounded-r-lg transition-all duration-500 ${
          highlightPhase === 'posting_phase' 
            ? 'bg-yellow-500/30 border-2 border-yellow-500 text-yellow-300' 
            : 'bg-gray-800/50 border border-gray-700 text-gray-400'
        }`}>
          🚀 Release & Promo
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex gap-1">
            {/* Week label */}
            <div className="w-20 flex items-center justify-center text-xs text-gray-500">
              {weekIndex === 0 && 'Week 1'}
              {weekIndex === 1 && 'Week 2'}
              {weekIndex === 2 && 'Week 3'}
              {weekIndex === 3 && 'Week 4'}
            </div>
            
            {/* Days */}
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`flex-1 min-h-[80px] p-2 rounded-lg border transition-all duration-500 ${
                  day.isHighlighted 
                    ? 'scale-105 shadow-lg ring-2 ring-yellow-400' 
                    : ''
                } ${
                  day.type === 'release'
                    ? 'bg-red-500/30 border-red-500'
                    : day.postType
                    ? getPostTypeColor(day.postType)
                    : day.task
                    ? 'bg-blue-500/20 border-blue-500/50'
                    : 'bg-gray-900/50 border-gray-800'
                }`}
              >
                {/* Date */}
                <div className="text-[10px] text-gray-400 mb-1">
                  {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                  <br />
                  {day.date.getMonth() + 1}/{day.date.getDate()}
                </div>
                
                {/* Content */}
                {day.type === 'release' && (
                  <div className="text-[10px] text-red-300 font-bold">
                    🎵 RELEASE DAY
                  </div>
                )}
                
                {day.postType && (
                  <div className="text-[10px] text-white">
                    {getPostTypeEmoji(day.postType)}
                    <span className="ml-1 capitalize">{day.postType.replace('-', ' ')}</span>
                  </div>
                )}
                
                {day.task && (
                  <div className="text-[10px] text-blue-300">
                    {day.task}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500"></div>
          <span className="text-gray-400">🌱 Audience Builder</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500"></div>
          <span className="text-gray-400">👀 Teaser</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/50"></div>
          <span className="text-gray-400">📋 Prep Task</span>
        </div>
      </div>
    </div>
  );
}

