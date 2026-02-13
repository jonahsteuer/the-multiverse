# Visual Universe Architecture Reference

**Version:** 1.0  
**Date:** January 8, 2026

---

## Core Concepts

### Universe
- **Definition:** The entire artist persona - everything we know about the artist visually and analytically
- **Contains:** All galaxies (release blocks) for the artist
- **Data:** Artist's data (atoms and molecules) inform the universe's decisions
- **Example:** Kendrick Lamar's entire discography and visual identity

### Galaxy
- **Definition:** An entire release "block" for an artist (album, EP, or project)
- **Contains:** Multiple worlds (songs/releases)
- **Relationship:** Part of the artist's universe
- **Example:** Kendrick Lamar's "DAMN" album/project

### World
- **Definition:** A single song or release within a galaxy
- **Contains:** 
  - Visual landscape (images, color palettes, Pinterest board)
  - Snapshot strategy (AI-generated snapshots with visual direction)
  - Countdown timer (real-time release countdown)
- **Relationship:** Part of a galaxy
- **Timeline:** Distance from sun represents release date (farther = later release)
- **Example:** "DNA" song within the "DAMN" galaxy

### Snapshots
- **Definition:** Individual pieces of social media content that are "snapshots" of the artist's visual landscape
- **Contains:** 
  - Caption
  - Platform (Instagram, TikTok, Twitter)
  - Content type (Photo, Video, Story, Reel, Carousel)
  - Timing recommendation
  - **Visual/creative direction** (NEW - more than just captions)
- **Relationship:** Part of a snapshot strategy for a world
- **Old Term:** "Posts" or "Content"

### Snapshot Strategy / Snapshot Plan
- **Definition:** A plan for creating snapshots for a world's release
- **Contains:** Multiple snapshots organized by release cycle timing
- **Old Term:** "Content Plan" or "Content Strategy"

---

## Visual Navigation

### Google Earth-Style Interface
- **Zoom:** In/out to see universe → galaxy → world detail levels
- **Pan:** Left/right/up/down to navigate between galaxies and worlds
- **Click:** On galaxies or worlds to unlock detailed information
- **Spatial Representation:** Distance from sun = release timeline

### Visual Landscape
- **Components:**
  - User-uploaded images
  - Color palettes
  - Pinterest board integration
- **Purpose:** Visually communicate what the universe/galaxy/world will look like
- **Location:** Accessible when clicking on a world

---

## User Types & Permissions

### Artists
- **Role:** Primary users, universe owners
- **Permissions:** Full access (create, edit, delete)
- **Actions:**
  - Create galaxies and worlds
  - Generate snapshot strategies
  - Invite collaborators
  - Manage visual landscapes

### Videographers
- **Role:** Invited collaborators
- **Permissions:** View or Edit (set by artist)
- **Access:** Shareable link with permissions
- **Actions:**
  - View visual landscapes
  - View snapshot strategies
  - Edit (if granted edit access)
  - Same interface/UI as artists

### Editors
- **Role:** Invited collaborators
- **Permissions:** View or Edit (set by artist)
- **Access:** Shareable link with permissions
- **Actions:**
  - View visual landscapes
  - View snapshot strategies
  - Edit (if granted edit access)
  - Same interface/UI as artists

---

## Data Flow

### Initial State
1. Artist signs up
2. Immediately receives: **Empty galaxy with a sun**
3. Can create first world using form

### World Creation Flow
1. Artist clicks on galaxy (or uses form)
2. Fills out world creation form (separate from onboarding)
3. World appears in galaxy at appropriate distance from sun
4. Artist can add visual landscape (images, Pinterest board, color palette)
5. Artist can generate snapshot strategy
6. Countdown timer starts automatically

### Collaboration Flow
1. Artist creates shareable link
2. Sets permissions (view or edit)
3. Shares link with videographer/editor
4. Collaborator accesses via link
5. Sees same interface with appropriate permissions

---

## Technical Components Needed

### Navigation System
- Google Earth-style pan/zoom interface
- Click-to-explore interactions
- Spatial representation of timeline

### Visual Landscape System
- Image upload and management
- Color palette extraction/display
- Pinterest API integration
- Mood board interface

### Countdown System
- Real-time countdown timers
- Updates every second
- WebSocket or polling for accuracy

### Collaboration System
- Shareable link generation
- Permission management (view/edit)
- Multi-user access handling

---

## Terminology Mapping

| Old Terminology | New Terminology | Context |
|----------------|----------------|---------|
| Content | Snapshots | Individual social media pieces |
| Posts | Snapshots | Same as above |
| Content Plan | Snapshot Strategy | Plan for creating snapshots |
| Content Strategy | Snapshot Plan | Same as above |
| Release | World | Single song/release |
| Project/Album | Galaxy | Collection of releases |
| Artist Account | Universe | Entire artist persona |

---

## Example: Kendrick Lamar

**Universe:** Kendrick Lamar's entire discography and visual identity

**Galaxy:** "DAMN" project/album

**World:** "DNA" song
- Visual Landscape: Dark, moody aesthetic with red/black color palette
- Snapshot Strategy: 15+ snapshots for release cycle
- Countdown: "DNA dropping in 65 days 10 hours, 30 mins, and 25 seconds"

**Snapshots:** Individual Instagram posts, TikTok videos, Twitter posts that capture the "DNA" visual universe

---

## Key Principles

1. **Visual-First:** Everything starts with visual identity, not just content generation
2. **Universe Cohesion:** All snapshots should feel part of the same visual universe
3. **Collaboration:** Built for teams, not just individual artists
4. **Timeline Awareness:** Spatial representation reflects release timing
5. **Music Industry Context:** Designed specifically for music release cycles

---

**This document will be updated as implementation progresses and user journeys are documented.**


