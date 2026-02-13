# Feature Roadmap - The Multiverse

**Date:** January 8, 2026  
**Based on:** Kiss Bang User Research

---

## 🎯 Core Features to Build

### **Phase 1: Consistency Engine** (Priority: HIGHEST)

#### 1.1 Enhanced Snapshot Strategy with Posting Schedule
- **What:** Add posting dates to each snapshot in the strategy
- **Details:**
  - AI generates 10+ snapshots with suggested posting dates
  - Timeline visualization (Week -2, -1, Release, +1, +2)
  - Posting schedule based on release date (2 weeks before, 8 after)
  - Visual timeline component showing all post dates
- **UI Location:** World Detail Modal → "Snapshots" tab
- **Files to Create:**
  - `components/multiverse/SnapshotTimeline.tsx`
  - `components/multiverse/PostingSchedule.tsx`
- **API Updates:**
  - Update `/api/generate-snapshots` to include posting dates

#### 1.2 Google Calendar Integration
- **What:** Sync posting schedule, shoot days, and edit deadlines to Google Calendar
- **Details:**
  - OAuth with Google Calendar API
  - Auto-create calendar events for:
    - Snapshot post dates
    - Shoot days
    - Edit deadlines
  - Two-way sync (changes in Google Calendar reflect in platform)
  - Reminder settings (email, push notifications)
- **UI Location:** World Detail Modal → "Schedule" tab → "Sync to Google Calendar" button
- **Files to Create:**
  - `lib/google-calendar.ts`
  - `app/api/calendar/sync/route.ts`
  - `components/multiverse/CalendarSync.tsx`
- **Dependencies:**
  - `googleapis` package
  - Google OAuth setup

#### 1.3 Reminder System
- **What:** Automatic reminders for posting, shoot days, edit deadlines
- **Details:**
  - In-app notifications
  - Email reminders (optional)
  - Push notifications (future)
  - Reminder settings per user
- **UI Location:** Settings/Preferences
- **Files to Create:**
  - `components/multiverse/ReminderSettings.tsx`
  - `lib/notifications.ts`
- **Backend:**
  - Scheduled job system (cron jobs or background workers)

#### 1.4 Shoot Day Suggestion System
- **What:** AI suggests optimal shoot days based on release timeline
- **Details:**
  - Calculates when shoots need to happen (1 week before post dates)
  - Suggests multiple date options
  - Considers team availability (Kiss Bang, Ruby, Kaya)
  - Visual calendar showing suggested dates
- **UI Location:** Galaxy View → "Schedule" sidebar
- **Files to Create:**
  - `components/multiverse/ShootDayScheduler.tsx`
  - `lib/shoot-day-calculator.ts`
- **API:**
  - `/api/schedule/suggest-shoot-days`

---

### **Phase 2: Treatment Generator** (Priority: HIGH)

#### 2.1 AI Treatment Generation
- **What:** Generate comprehensive treatments for each shoot day
- **Details:**
  - Input: World data (name, visual landscape, color, release date)
  - Output: Treatment document with:
    - Visual references (Pinterest integration)
    - Shot descriptions
    - Mood & aesthetic description
    - Color palette
    - Suggested shot list
    - Team assignments
  - Delivered 1 week before shoot day
- **UI Location:** World Detail Modal → "Treatments" tab
- **Files to Create:**
  - `components/multiverse/TreatmentView.tsx`
  - `components/multiverse/TreatmentGenerator.tsx`
  - `app/api/treatments/generate/route.ts`
- **AI Prompt:** Enhanced Claude prompt for treatment generation

#### 2.2 Pinterest Integration
- **What:** Import and display Pinterest boards as visual references
- **Details:**
  - OAuth with Pinterest API
  - Import existing boards
  - Create boards within platform
  - Display board preview in treatments
  - Similar image suggestions based on selected pins
- **UI Location:** 
  - Visual Landscape builder (galaxy/world creation)
  - Treatment view
- **Files to Create:**
  - `lib/pinterest.ts`
  - `app/api/pinterest/route.ts`
  - `components/multiverse/PinterestBoard.tsx`
- **Dependencies:**
  - Pinterest API access
  - OAuth setup

#### 2.3 Shot List Assistant
- **What:** AI-assisted shot list creation for Ruby
- **Details:**
  - Based on treatment and world data
  - Suggests shot list items
  - Ruby can edit and customize
  - Organized by scene/setup
  - Time estimates for each shot
- **UI Location:** Treatment View → "Shot List" section
- **Files to Create:**
  - `components/multiverse/ShotListEditor.tsx`
  - `app/api/treatments/suggest-shots/route.ts`
- **Features:**
  - Drag-and-drop reordering
  - Add/remove shots
  - Time tracking
  - Completion checkboxes

#### 2.4 Treatment Delivery System
- **What:** Automatically deliver treatments to team 1 week before shoot
- **Details:**
  - Auto-generate treatment when shoot day is confirmed
  - Email notification to Ruby and Kaya
  - In-app notification
  - Treatment appears in their dashboard
- **UI Location:** Team member views
- **Files to Create:**
  - `lib/treatment-delivery.ts`
  - Email templates
- **Backend:**
  - Scheduled job to check shoot dates and send treatments

---

### **Phase 3: Edit Workflow** (Priority: HIGH)

#### 3.1 Edit Upload System
- **What:** Ruby uploads video edits to platform
- **Details:**
  - Drag-and-drop file upload
  - Support for video formats (MP4, MOV, etc.)
  - File size limits and validation
  - Progress indicator
  - Auto-generate thumbnails
- **UI Location:** World Detail Modal → "Edits" tab
- **Files to Create:**
  - `components/multiverse/EditUpload.tsx`
  - `app/api/edits/upload/route.ts`
- **Dependencies:**
  - File storage (Uploadthing, S3, or similar)
  - Video processing library

#### 3.2 Edit Review Interface
- **What:** Kiss Bang reviews and approves edits
- **Details:**
  - Video player for review
  - Playback controls
  - Side-by-side comparison (if multiple versions)
  - Approval/rejection buttons
  - Feedback text area
  - Version history
- **UI Location:** World Detail Modal → "Edits" tab
- **Files to Create:**
  - `components/multiverse/EditReview.tsx`
  - `components/multiverse/VideoPlayer.tsx`
- **Features:**
  - Play/pause/scrub
  - Fullscreen mode
  - Download option
  - Comment system

#### 3.3 Version Control
- **What:** Track all edit versions
- **Details:**
  - Version numbering (v1, v2, v3)
  - Version comparison
  - Revert to previous version
  - Version notes/comments
  - Download any version
- **UI Location:** Edit Review interface
- **Files to Create:**
  - `components/multiverse/VersionHistory.tsx`
- **Database:**
  - Edit version tracking schema

#### 3.4 Feedback System
- **What:** Structured feedback on edits
- **Details:**
  - Text comments
  - Timestamp markers ("at 0:15, change this...")
  - Approval workflow
  - Notification to Ruby when feedback received
- **UI Location:** Edit Review interface
- **Files to Create:**
  - `components/multiverse/EditFeedback.tsx`
- **Features:**
  - Comment threading
  - Mark as resolved
  - Email notifications

---

### **Phase 4: Performance Insights** (Priority: MEDIUM-HIGH)

#### 4.1 Social Media API Integration
- **What:** Connect Instagram, TikTok, Twitter to track performance
- **Details:**
  - OAuth with each platform
  - Fetch post metrics (views, likes, comments, shares, saves)
  - Track which snapshots were posted
  - Link snapshots to social posts
- **UI Location:** Performance tab (background sync)
- **Files to Create:**
  - `lib/instagram-api.ts`
  - `lib/tiktok-api.ts`
  - `lib/twitter-api.ts`
  - `app/api/social/connect/route.ts`
- **Dependencies:**
  - Platform-specific APIs
  - OAuth for each platform

#### 4.2 Stream Attribution
- **What:** Track which snapshots drive Spotify/streaming activity
- **Details:**
  - Connect Spotify for Artists API (when available)
  - Manual CSV upload option
  - Correlate posting dates with stream spikes
  - Attribution: "This snapshot → X streams"
- **UI Location:** Performance tab → "Stream Attribution"
- **Files to Create:**
  - `lib/spotify-api.ts`
  - `components/multiverse/StreamAttribution.tsx`
  - `app/api/performance/streams/route.ts`
- **Dependencies:**
  - Spotify for Artists API (or manual upload)

#### 4.3 Fan Discovery Metrics
- **What:** Track NEW fan engagement (not just existing followers)
- **Details:**
  - Distinguish new vs. existing followers
  - Track which snapshots reach new fans
  - New fan engagement rate
  - Superfan indicators (repeated engagement, shares, saves)
- **UI Location:** Performance tab
- **Files to Create:**
  - `components/multiverse/FanDiscovery.tsx`
  - `lib/fan-metrics.ts`
- **Challenges:**
  - Social APIs may not provide new vs. existing fan data
  - May need to track over time to identify new fans

#### 4.4 Pattern Recognition
- **What:** AI identifies what's working
- **Details:**
  - Analyze performance data
  - Find patterns: "Posts with 80s aesthetic at 2pm reach 3x more fans"
  - Compare high vs. low performing snapshots
  - Identify common elements in successful content
- **UI Location:** Performance tab → "Insights" section
- **Files to Create:**
  - `components/multiverse/PerformanceInsights.tsx`
  - `app/api/insights/analyze/route.ts`
- **AI:**
  - Claude API for pattern analysis

#### 4.5 Replication Suggestions
- **What:** Suggest how to replicate successful snapshots
- **Details:**
  - "This snapshot drove 500 streams because [reason]"
  - "Create 3 more like this one"
  - Specific recommendations (visual style, timing, content type)
  - Auto-generate similar snapshot ideas
- **UI Location:** Performance tab → Individual snapshot view
- **Files to Create:**
  - `components/multiverse/ReplicationSuggestions.tsx`
- **AI:**
  - Claude API for suggestion generation

#### 4.6 Performance Dashboard
- **What:** Visual dashboard showing overall performance
- **Details:**
  - Total streams driven
  - New fans acquired
  - Top performing snapshots
  - Engagement trends over time
  - Charts and graphs
- **UI Location:** World Detail Modal → "Performance" tab
- **Files to Create:**
  - `components/multiverse/PerformanceDashboard.tsx`
- **Dependencies:**
  - Chart library (recharts, chart.js, etc.)

---

### **Phase 5: Team Collaboration** (Priority: MEDIUM)

#### 5.1 Team Member Management
- **What:** Invite and manage team members
- **Details:**
  - Invite via email
  - Set permissions (view, edit, admin)
  - Role assignment (Artist, Videographer, Editor, Bandmate)
  - Remove team members
- **UI Location:** Universe/Galaxy View → Team Panel
- **Files to Create:**
  - `components/multiverse/TeamPanel.tsx`
  - `components/multiverse/InviteMember.tsx`
  - `app/api/team/invite/route.ts`
- **Database:**
  - Team member schema with permissions

#### 5.2 Team Activity Feed
- **What:** Show what team members are doing
- **Details:**
  - Recent actions (uploaded edit, created treatment, etc.)
  - Who did what and when
  - Filter by team member
  - Real-time updates
- **UI Location:** Team Panel → Activity tab
- **Files to Create:**
  - `components/multiverse/ActivityFeed.tsx`
- **Backend:**
  - Activity logging system

#### 5.3 Team Availability Coordination
- **What:** Coordinate shoot days with team availability
- **Details:**
  - Team members mark availability
  - Calendar view showing everyone's schedule
  - Find common available dates
  - Confirm shoot days
- **UI Location:** Schedule tab → Team Availability
- **Files to Create:**
  - `components/multiverse/TeamAvailability.tsx`
  - `components/multiverse/AvailabilityCalendar.tsx`
- **Integration:**
  - Google Calendar sync for availability

#### 5.4 Team-Specific Views
- **What:** Different views for different team roles
- **Details:**
  - Ruby sees: Treatments, shot lists, edit upload
  - Kaya sees: Schedules, treatments (read-only)
  - Kiss Bang sees: Everything (full access)
  - Permission-based UI rendering
- **UI Location:** Throughout app (conditional rendering)
- **Files to Create:**
  - `lib/permissions.ts`
  - Permission hooks/components

---

### **Phase 6: Visual Enhancements** (Priority: MEDIUM)

#### 6.1 World Status Indicators
- **What:** Visual indicators showing world status
- **Details:**
  - Glowing green ring = Performing well
  - Glowing yellow ring = Ready to post
  - Pulsing red ring = Needs attention
  - Static grey = Not yet released
- **UI Location:** Galaxy 3D View
- **Files to Update:**
  - `components/multiverse/Galaxy3DView.tsx`

#### 6.2 Snapshot Performance Badges
- **What:** Performance indicators on snapshot thumbnails
- **Details:**
  - Green badge = High performance
  - Yellow badge = Medium performance
  - Red badge = Low performance
  - Click badge → see performance details
- **UI Location:** World View (snapshots around world)
- **Files to Create:**
  - `components/multiverse/SnapshotBadge.tsx`

#### 6.3 Timeline Visualization
- **What:** Visual timeline around galaxy showing events
- **Details:**
  - Concentric rings showing time progression
  - Markers: 📸 = post date, 🎬 = shoot day, ✏️ = edit deadline
  - Color coding: Gold = upcoming, Green = completed, Red = overdue
  - Click marker → see details
- **UI Location:** Galaxy 3D View
- **Files to Create:**
  - `components/multiverse/TimelineRings.tsx`

#### 6.4 Shoot Day Markers
- **What:** Special markers for shoot days in 3D view
- **Details:**
  - Icons/rings around galaxy
  - Different states: planned, confirmed, completed
  - Click → treatment view
- **UI Location:** Galaxy 3D View
- **Files to Create:**
  - `components/multiverse/ShootDayMarker.tsx`

---

### **Phase 7: Advanced Features** (Priority: LOW-MEDIUM)

#### 7.1 Benchmarking
- **What:** Compare performance to similar artists
- **Details:**
  - "Similar artists in your genre post 3x/week"
  - "Your engagement rate is X% vs. Y% average"
  - Genre-specific benchmarks
- **UI Location:** Performance tab
- **Requirements:**
  - Aggregate data from multiple artists
  - Privacy considerations

#### 7.2 Predictive Insights
- **What:** Predict what will work before posting
- **Details:**
  - "This snapshot is likely to perform well because..."
  - Based on historical data and patterns
  - Confidence scores
- **UI Location:** Snapshot creation/preview
- **AI:**
  - Machine learning on performance patterns

#### 7.3 Content Library
- **What:** Reuse successful snapshots/concepts
- **Details:**
  - Save snapshots as templates
  - Reuse for future releases
  - Adapt to new worlds
- **UI Location:** Universe level
- **Files to Create:**
  - `components/multiverse/ContentLibrary.tsx`

#### 7.4 Automated Posting
- **What:** Auto-post snapshots to social media
- **Details:**
  - Connect Instagram/TikTok accounts
  - Schedule posts directly from platform
  - Auto-post at optimal times
- **UI Location:** Snapshot view → "Schedule Post" button
- **Dependencies:**
  - Social media APIs with posting permissions

---

## 📋 Implementation Priority

### **Week 1-2: Consistency Engine**
1. Enhanced Snapshot Strategy with Posting Schedule
2. Google Calendar Integration
3. Reminder System
4. Shoot Day Suggestion System

### **Week 3-4: Treatment Generator**
5. AI Treatment Generation
6. Pinterest Integration
7. Shot List Assistant
8. Treatment Delivery System

### **Week 5-6: Edit Workflow**
9. Edit Upload System
10. Edit Review Interface
11. Version Control
12. Feedback System

### **Week 7-8: Performance Insights**
13. Social Media API Integration
14. Stream Attribution
15. Fan Discovery Metrics
16. Pattern Recognition
17. Replication Suggestions
18. Performance Dashboard

### **Week 9-10: Team Collaboration**
19. Team Member Management
20. Team Activity Feed
21. Team Availability Coordination
22. Team-Specific Views

### **Week 11-12: Polish & Enhancements**
23. Visual Enhancements (status indicators, badges, timeline)
24. Advanced Features (as needed)

---

## 🔧 Technical Requirements

### **New Dependencies Needed**
- `googleapis` - Google Calendar integration
- `react-colorful` - Color picker (already added)
- `recharts` or `chart.js` - Performance charts
- Video player library (react-player, video.js)
- File upload service (Uploadthing, AWS S3)
- OAuth libraries for social platforms

### **New API Integrations**
- Google Calendar API
- Pinterest API
- Instagram Graph API
- TikTok API (if available)
- Twitter API
- Spotify for Artists API (or manual CSV)

### **Database Schema Additions**
- Treatments table
- Edits table (with versions)
- Performance metrics table
- Team members table
- Activity log table
- Calendar events table

---

## 📝 Notes

- All features should integrate seamlessly with existing 3D UI
- Maintain the visual universe metaphor throughout
- Keep team collaboration simple and intuitive
- Performance insights should be actionable, not just data
- Consistency is the #1 priority - everything else supports that goal

---

**This roadmap will guide development over the next few weeks. Features will be built one at a time, starting with the Consistency Engine.**


