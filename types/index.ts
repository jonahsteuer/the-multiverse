// ============================================================================
// THE MULTIVERSE - NEW DATA MODEL
// ============================================================================

// User Types
export type UserType = 'artist' | 'videographer' | 'editor' | 'viewer';

// Account Creation / Onboarding
export interface CreatorAccountData {
  creatorName: string;
  email: string;
  password: string; // "creator encryption"
  userType: UserType;
  spotifyLinked?: boolean;
  instagramLinked?: boolean;
  onboardingComplete?: boolean; // Track if conversational onboarding is complete
  onboardingProfile?: Partial<ArtistProfile>; // Save partial profile data for resume
}

// Enhanced Onboarding Data (Phase 1)
export interface ArtistProfile {
  userId: string;
  // Q1: Genre & Musical Style
  genre: string[];
  musicalInspiration?: string[]; // Artists that inspire
  // Q2: Visual Style
  visualAesthetic: string; // Selected aesthetic
  visualStyleDescription?: string; // Custom description if "custom" selected
  // Q3: Best Performing Posts
  hasBestPosts: boolean;
  bestPosts?: BestPost[];
  // Q4: Platforms & Frequency
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'twitter')[];
  primaryPlatform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  currentPostingFrequency: 'daily' | '2-3x_week' | 'weekly' | 'less_than_weekly';
  desiredPostingFrequency: 'daily' | '2-3x_week' | 'weekly' | 'less_than_weekly';
  // Q5: Content Enjoyment & Experience
  enjoyedContentFormats: string[]; // Video formats they enjoy making
  enjoyedContentFormatsOther?: string; // If "other" selected
  contentCreationLevel: 'beginner' | 'intermediate' | 'advanced';
  equipment: 'phone' | 'phone_basic' | 'camera' | 'full_setup';
  planningComfort: 'spontaneous' | 'some_planning' | 'detailed_planning' | 'love_planning';
  contentStylePreference?: string;
  
  // Q6: Visual Themes
  visualThemes?: string[]; // Themes they want to explore
  visualTrends?: string[]; // Trends they want to incorporate
  // Pinterest Integration (placeholder)
  pinterestBoards?: string[]; // Pinterest board IDs/URLs
  
  // NEW: Time Budget & Availability (from conversational onboarding)
  timeBudgetHoursPerWeek?: number; // e.g., 6
  preferredDays?: string[]; // e.g., ['saturday', 'sunday'] — kept for data storage but not shown in UI
  homeCity?: string; // e.g., 'Los Angeles' — pre-fills location area in brainstorm sessions

  // NEW: Content inventory (from conversational onboarding)
  editedClipCount?: number; // How many edited clips are ready to post
  rawFootageDescription?: string; // Description of any unedited raw footage
  
  // NEW: Existing Assets
  existingAssets?: ExistingAssets;
  
  // NEW: Team & Collaborators
  hasTeam?: boolean;
  teamMembers?: TeamMember[];
  
  // NEW: Releases (collected during onboarding)
  releases?: ArtistRelease[];
  
  // NEW: Content creation approach
  contentCreationApproach?: string;
  hasExistingAssets?: boolean;
  existingAssetsDescription?: string;
  bestPostDescription?: string;
  teamDescription?: string;
  
  // NEW: Release Strategy (what they want to promote)
  releaseStrategy?: 'promote_recent' | 'build_to_release' | 'audience_growth' | 'balanced';
  releaseStrategyDescription?: string; // Their specific answer

  // Stafford: target listener interests (B) — what else they're into besides music
  targetListenerInterests?: string; // e.g. "comedy, late nights, fitness, nostalgia"
  
  createdAt: string;
  updatedAt: string;
}

// NEW: Artist release (collected during onboarding)
export interface ArtistRelease {
  type: string; // 'single' | 'ep' | 'album'
  name: string;
  releaseDate: string | null; // ISO date or null/TBD
  isReleased: boolean;
  songs: string[];
}

// NEW: Existing assets the artist can repurpose
export interface ExistingAssets {
  musicVideos?: AssetItem[];
  footage?: AssetItem[];
  photos?: AssetItem[];
  behindTheScenes?: AssetItem[];
  studioSessions?: AssetItem[];
  other?: AssetItem[];
}

export interface AssetItem {
  id: string;
  description: string;
  url?: string; // Optional URL if uploaded
  forSong?: string; // Which song/world this is for
  createdAt: string;
}

// NEW: Team member
export interface TeamMember {
  id: string;
  name: string;
  role: 'videographer' | 'editor' | 'photographer' | 'manager' | 'other';
  availability: 'always' | 'sometimes' | 'rarely';
  notes?: string;
}

export interface BestPost {
  id: string;
  description: string; // Why they think it was successful
  postFormat: 'vlog' | 'lipsync' | 'guitar_performance' | 'dance' | 'lyric_video' | 'behind_scenes' | 'live_performance' | 'other';
  postFormatOther?: string; // If "other" selected
  screenshotUrl?: string; // Uploaded screenshot
  postUrl?: string; // Instagram/TikTok URL
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    streams?: number;
  };
}

// Snapshot Schedule Configuration
export interface SnapshotScheduleConfig {
  releaseDate: string; // ISO date
  nextReleaseDate?: string; // ISO date
  hoursPerWeek: '2-4' | '5-8' | '9-12' | '13+';
  platforms: ('instagram' | 'tiktok' | 'youtube')[];
  preferredFrequency: 'low' | 'medium' | 'high';
  // Adaptive tracking
  postingHistory?: {
    date: string;
    posted: boolean;
    snapshotId: string;
  }[];
  // Current target (adjusts based on performance)
  currentTargetSnapshotsPerWeek: number;
}

// Universe
export interface Universe {
  id: string;
  name: string; // e.g., "The Leon Taxverse"
  creatorId: string;
  createdAt: string;
  galaxies: Galaxy[];
}

// GalaxyEntry — used for multi-galaxy navigation (user's own + team galaxies)
export interface GalaxyEntry {
  galaxy: Galaxy;
  universe: Universe;
  isAdmin: boolean;
  artistName: string; // e.g. "Kiss Bang" or "Leon Tax"
}

// Galaxy (Release block/project)
export interface Galaxy {
  id: string;
  name: string;
  universeId: string;
  releaseDate?: string; // ISO date string: YYYY-MM-DD (optional - not needed for single song releases)
  visualLandscape: VisualLandscape;
  worlds: World[];
  createdAt: string;
}

// Visual Landscape
export interface VisualLandscape {
  images: string[]; // URLs or Pinterest image URLs
  colorPalette: string[]; // Hex color codes
  pinterestBoardId?: string;
}

// World (Individual song/release)
export interface World {
  id: string;
  name: string; // e.g., "Will I Find You"
  galaxyId: string;
  releaseDate: string; // ISO date string: YYYY-MM-DD
  color: string; // Hex color code
  visualLandscape: VisualLandscape; // More specific than galaxy
  snapshotStrategy?: SnapshotStrategy;
  isPublic: boolean;
  isReleased: boolean;
  createdAt: string;
  // Stafford approach: per-song context (C, D, D+)
  songEmotion?: string;       // 1-2 words: "heartbreak", "confidence" etc. (C)
  songStage?: string;         // writing/recorded/mixed/mastered/ready (D)
  listeningContext?: string;  // "late-night drive", "gym", "bedroom" etc. (D+)
}

// Snapshot Strategy
export interface SnapshotStrategy {
  id: string;
  worldId: string;
  snapshots: Snapshot[];
  generatedAt: string;
}

// Snapshot (Individual social media content)
export interface Snapshot {
  id: string;
  worldId: string;
  memoryId?: string; // Which "memory" (master video) it came from
  visualDescription: string; // Imagery-rich description of what it looks like
  mood?: string; // Energetic, Dreamy, Dark, Bright, etc.
  caption?: string;
  captions?: Record<string, string>; // Platform-specific captions
  platform: 'instagram' | 'tiktok' | 'twitter' | 'youtube';
  contentType: 'photo' | 'video' | 'story' | 'reel' | 'carousel';
  videoLength?: number; // Duration in seconds
  suggestedFilmingDate?: string; // ISO date string
  postingDate?: string; // ISO date string - specific date when to post
  postingDates?: Record<string, string>; // Platform-specific posting dates
  timing?: string; // e.g., "Tuesday 2pm"
  order: number; // Order in release cycle
  weekLabel?: string; // e.g., "Week -2", "Release Week", "Week +1"
  // Backwards planning dates
  editDeadline?: string; // ISO date
  shotListDeadline?: string; // ISO date
  treatmentDeadline?: string; // ISO date
  shootDate?: string; // ISO date
  // Status
  status: 'draft' | 'treatment_ready' | 'shot_list_ready' | 'filmed' | 'edited' | 'approved' | 'posted';
  // Performance data (collected over time)
  performance?: SnapshotPerformance;
}

export interface SnapshotPerformance {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  streamsAttributed?: number;
  newFansReached?: number;
  engagementRate?: number;
  performanceScore?: number;
  insights?: string; // Why it performed well/poorly
  measuredAt: string;
}

// Memory (Master video that gets cut into snapshots)
export interface Memory {
  id: string;
  worldId: string;
  visualDirection: string; // Overall visual direction
  treatment: string; // Required treatment/script
  shotList: ShotListItem[]; // Required shot list
  filmingDate?: string; // ISO date
  location?: string;
  teamMembers?: string[]; // User IDs
  rawFootageUrl?: string; // Uploaded video URL
  status: 'draft' | 'treatment_ready' | 'shot_list_ready' | 'filmed' | 'cut_into_snapshots' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface ShotListItem {
  id: string;
  description: string;
  type: 'close_up' | 'wide' | 'movement' | 'static' | 'other';
  duration?: number; // Estimated duration in seconds
  notes?: string;
}

// ============================================================================
// LEGACY TYPES (Keeping for backward compatibility during migration)
// ============================================================================

// Artist onboarding form data
// Based on previous FastAPI ArtistBase and ArtistCreate schemas
export interface ArtistOnboardingData {
  artistName: string;
  singleTitle: string;
  releaseDate: string; // ISO date string: YYYY-MM-DD
  genre: string;
  vibe: string; // Tone/style description
  targetAudience?: string; // Optional audience description
}

// Generated social media post (LEGACY - use Snapshot instead)
// Based on previous FastAPI ContentPostBase schema, adapted for generated content
export interface GeneratedPost {
  id: string;
  week: string; // "Week -2" | "Week -1" | "Release Week" | "Week +1" | "Week +2"
  caption: string;
  platform: 'instagram' | 'tiktok' | 'twitter';
  contentType: 'photo' | 'video' | 'story' | 'reel' | 'carousel';
  timing: string; // e.g., "Tuesday 2pm"
}

// API response from content generation
export interface ContentGenerationResponse {
  posts: GeneratedPost[];
  summary: string;
  generatedAt: string; // ISO timestamp
}

// Error response structure
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
}

// Content generation request validation
export interface ContentGenerationRequest extends ArtistOnboardingData {
  // All fields from ArtistOnboardingData are required
}

// Platform-specific post variations (for future use)
export interface PlatformPost extends GeneratedPost {
  hashtags?: string[];
  mentions?: string[];
  callToAction?: string;
}

// Content performance tracking (for Phase 2)
export interface ContentPerformance {
  postId: string;
  platform: string;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  impressions?: number;
  reach?: number;
  engagementRate?: number;
  measuredAt: string;
}

// Phase 1: Consistency Engine Types

// Shoot Day
export interface ShootDay {
  id: string;
  worldId: string;
  date: string; // ISO date string
  suggestedDate: string; // ISO date string - original suggestion
  confirmedDate?: string; // ISO date string - when confirmed
  status: 'suggested' | 'confirmed' | 'completed';
  snapshots: string[]; // Array of snapshot IDs to be filmed
  treatmentId?: string; // Link to treatment document
  createdAt: string;
}

// Calendar Event
export interface CalendarEvent {
  id: string;
  type: 'post' | 'shoot' | 'edit_deadline' | 'release';
  title: string;
  description?: string;
  date: string; // ISO date string
  time?: string; // e.g., "14:00"
  worldId?: string;
  snapshotId?: string;
  shootDayId?: string;
  syncedToGoogle?: boolean;
  googleEventId?: string;
  createdAt: string;
}

// Reminder Settings
export interface ReminderSettings {
  userId: string;
  emailReminders: boolean;
  inAppReminders: boolean;
  reminderDaysBefore: number[]; // e.g., [7, 3, 1] = 7 days, 3 days, 1 day before
  reminderTime: string; // e.g., "09:00"
  postReminders: boolean;
  shootReminders: boolean;
  editDeadlineReminders: boolean;
}

// ============================================================================
// TEAM COLLABORATION TYPES
// ============================================================================

// Team Role Types
export type TeamRole = 'admin' | 'manager' | 'videographer' | 'editor' | 'artist' | 'other';
export type TeamPermission = 'full' | 'member';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';
export type TeamTaskType = 'invite_team' | 'brainstorm' | 'prep' | 'film' | 'edit' | 'review' | 'post' | 'release' | 'shoot' | 'custom';
export type TeamTaskCategory = 'task' | 'event' | 'footage';
export type TeamTaskStatus = 'pending' | 'in_progress' | 'completed';
export type NotificationType = 'task_assigned' | 'task_completed' | 'task_rescheduled' | 'invite_accepted' | 'member_joined' | 'brainstorm_completed' | 'brainstorm_revision' | 'general' | 'review_notes_sent';

// Team — one per universe
export interface Team {
  id: string;
  universeId: string;
  galaxyId?: string; // galaxy-level sharing — the specific galaxy this team is for
  name: string;
  createdBy: string; // user_id
  createdAt: string;
  // Populated client-side
  members?: TeamMemberRecord[];
}

// Team Member
export interface TeamMemberRecord {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  permissions: TeamPermission;
  displayName: string;
  invitedBy?: string; // user_id
  joinedAt: string;
  createdAt: string;
}

// Team Invitation
export interface TeamInvitation {
  id: string;
  teamId: string;
  inviteToken: string;
  role: TeamRole;
  invitedBy: string; // user_id
  invitedName?: string;
  invitedEmail?: string;
  status: InvitationStatus;
  createdAt: string;
  acceptedAt?: string;
  acceptedBy?: string; // user_id
  // Populated for invite page
  team?: Team;
  inviterName?: string;
}

// Team Task — assigned to individuals or shared as events
export interface TeamTask {
  id: string;
  teamId: string;
  galaxyId?: string;
  title: string;
  description: string;
  type: TeamTaskType;
  taskCategory: TeamTaskCategory;
  date: string; // ISO date YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  assignedTo?: string; // user_id (null for shared events)
  assignedBy?: string; // user_id
  status: TeamTaskStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Populated client-side
  assigneeName?: string;
  assignerName?: string;
  // Video / post fields (set via Upload Posts modal)
  videoUrl?: string;
  videoSource?: 'google_drive' | 'dropbox' | 'youtube' | 'direct';
  videoEmbedUrl?: string;
  markNotes?: string;
  markAnalysis?: Record<string, unknown>;
  caption?: string;
  hashtags?: string;
  postStatus?: string; // 'unlinked' | 'linked' | 'analyzed' | 'caption_written' | 'revision_requested' | 'approved' | 'scheduled' | 'posted'
  revisionNotes?: string;
}

// Notification
export interface AppNotification {
  id: string;
  userId: string;
  teamId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>; // Additional context
  read: boolean;
  createdAt: string;
}

// ============================================================================
// BRAINSTORM CONTENT TYPES
// ============================================================================

// Content format options for brainstorming
export type ContentFormat = 
  | 'music_video_snippet'
  | 'bts_performance'
  | 'visualizer'
  | 'custom';

export interface ContentFormatOption {
  id: ContentFormat;
  label: string;
  emoji: string;
  description: string;
  requiresFootage: boolean; // true = needs existing footage OR a shoot day
  recommended?: boolean; // chatbot can flag based on existing assets
}

// Assignment of a content format to a specific post
export interface ContentFormatAssignment {
  postIndex: number; // Which of the 6 posts (0-based)
  postId: string; // ID of the scheduled post
  format: ContentFormat;
  customFormatName?: string; // If format is 'custom'
  ideaTitle?: string;        // The brainstormed idea title (e.g. "Power Reclaim Moment")
  ideaHook?: string;         // The 3-second hook for this idea
  postType: 'teaser' | 'promo' | 'audience-builder'; // Original post type
  date: string; // ISO date of the post
  // Stafford: soundbyte + shoot look
  soundbyte?: string;        // which song section: intro/verse/pre-chorus/chorus/bridge/outro
  shootLook?: string;        // e.g. "Look 2 — close-up, side angle, seated"
  rolloutZone?: 'pre-release' | 'release-week' | 'post-release'; // where in the campaign arc
  // Variation tracking
  variationIndex?: number;     // 0 = original, 1+ = variation (all shot same day)
  variationOf?: string;        // postId of the original this is a variation of
  variationRationale?: string; // Why this variation is worth shooting
  // Trial reels: slight edit-level changes posted on Instagram the day before to test
  trialReelDate?: string;      // date string for trial reel post (day before this.date)
}

// A single look (camera setup) planned for a shoot day
export interface ShootLook {
  number: number;          // 1-based index
  description: string;     // e.g. "Wide, standing, front-facing"
  angle: string;           // wide / medium / close-up
  energy: string;          // calm / mid-energy / high-energy
}

// An expected edit derived from footage — maps to a post slot
export interface ExpectedEdit {
  postIndex: number;
  postDate: string;
  postTitle: string;
  lookNumber: number;          // which ShootLook to pull footage from
  soundbyte: string;           // intro/verse/pre-chorus/chorus/bridge/outro
  targetLength: string;        // "7s" | "15s" | "30s"
  textOverlaySuggestion: string;
  editDayDate: string;         // scheduled date to do this edit
}

// Generated edit/shoot tasks from brainstorm
export interface BrainstormEditDay {
  id: string;
  format: ContentFormat;
  customFormatName?: string;
  postsCovered: number[]; // Indices of posts this edit day covers
  duration: number; // Minutes
  date: string; // ISO date
  startTime: string;
  endTime: string;
  assignedTo?: string; // user_id (e.g., Ruby)
  // Stafford: explicit editor instructions
  editorInstructions?: string; // What footage to pull, soundbyte targets, etc.
  footageRef?: string;         // Reference to footage item
}

export interface BrainstormShootDay {
  id: string;
  format: ContentFormat;
  customFormatName?: string;
  reason: string; // e.g., "Visualizer footage needed"
  duration: number; // Minutes
  date: string; // ISO date
  startTime: string;
  endTime: string;
  timeOfDay?: string;    // morning / afternoon / evening
  crew?: string;         // solo / have help
  location?: string;     // confirmed shoot location name
  locationUrl?: string;  // Google Maps link
  looks?: ShootLook[];   // auto-generated look list
  assignedTo?: string; // user_id
  sharedWith?: string[]; // user_ids who also need to attend (e.g., artist)
}

// Complete result of a brainstorm session
export interface BrainstormResult {
  id: string;
  galaxyId: string;
  galaxyName: string;
  formatAssignments: ContentFormatAssignment[];
  editDays: BrainstormEditDay[];
  shootDays: BrainstormShootDay[];
  shootDayAction?: 'plan_now' | 'schedule_task' | 'skip'; // What to do about shoot days
  shootDayDate?: string; // YYYY-MM-DD — the chosen shoot date when action is 'plan_now'
  // Stafford: shoot day details
  confirmedLocation?: string;    // shoot location name
  confirmedLocationUrl?: string; // Google Maps link
  shootTimeOfDay?: string;       // morning / afternoon / evening
  shootCrew?: string;            // solo / have help
  looks?: ShootLook[];           // shot list
  expectedEdits?: ExpectedEdit[]; // derived edit targets
  confirmedScenes?: Array<{      // locked scene ideas from brainstorm (E1-E3)
    title: string;
    setting?: string;
    action?: string;
    emotionalAngle?: string;
    timeOfDay?: string;
    difficulty?: string;
    practicalRequirements?: string;
  }>;
  // Trial reels: Instagram-only test posts scheduled the day before each real post
  trialReels?: Array<{
    postIndex: number;
    postDate: string;   // the actual post date
    trialDate: string;  // day before postDate
    postTitle: string;
  }>;
  completedBy?: string; // user_id
  completedAt: string;
  reviewedBy?: string; // user_id (admin who reviewed)
  reviewedAt?: string;
  revisionNotes?: string; // Notes from admin if sent back
  status: 'completed' | 'pending_review' | 'revision_requested';
}

// Post Edit — one uploaded edit version for a scheduled post
export interface PostEdit {
  id: string;
  postTaskId: string;
  teamId: string;
  galaxyId: string;
  uploadedBy?: string;
  uploaderName: string;
  videoUrl: string;
  versionNumber: number;
  description?: string; // "What changed?" for v2+
  createdAt: string;
  updatedAt: string;
}

// Helper: Check if a team member has admin/full permissions
export function hasFullPermissions(member: TeamMemberRecord): boolean {
  return member.permissions === 'full';
}

// Helper: Check if user is admin of a team
export function isTeamAdmin(members: TeamMemberRecord[], userId: string): boolean {
  const member = members.find(m => m.userId === userId);
  return member ? member.permissions === 'full' : false;
}

