# Team Collaboration System - Design Document

## 🎯 Vision
Transform the platform from a solo creator tool into a **team collaboration platform** where artists, managers, videographers, editors, and other collaborators work together on content strategy.

---

## 📊 Decisions Made

| Question | Decision |
|----------|----------|
| Team scope | **Universe-level** — Ruby is on Kiss Bang's team across all galaxies |
| Multi-team support | **Yes** — Ruby can be on Kiss Bang's AND Cam Okoro's team, with a universe switcher |
| Role assignment | **Inviter specifies** the role at invite time |
| Manager as admin | **Yes** — if manager creates account, they're admin. Artist inviting a manager triggers a "give full permissions?" prompt |
| Todo list format | **Checklist in Galaxy View** below galaxy title, clickable tasks open completion window |
| Due date display | Show **time** for today's tasks, **day name** for this week, **date** for later |
| Notifications | **All three:** bell icon, toast, email |
| Share modal | **Custom modal** with Email/Text/Copy Link + native share on mobile |
| "Invite team" task | Only shows if artist said they have a team. Only for admin users. |
| First task scheduling | **Immediately actionable** — scheduled right now, don't check preferred times |
| Task completion | **Auto-complete** when action is done (not manual checkbox). Tasks disappear when completed. |
| Recurring tasks | **One-time only** for now |
| Real-time updates | **Instant** via Supabase Realtime |
| Invite link expiry | **Never expires** |

---

## 👥 Roles & Permissions

### Role Types
- `admin` — Full access (artist who created account, or manager with full permissions)
- `manager` — Can be elevated to admin by artist
- `videographer` — Member access
- `editor` — Member access  
- `artist` — The invited artist (if manager created account)
- `other` — Generic collaborator

### Permission Matrix

| Action | Admin | Manager (full perms) | Manager (basic) | Member (videographer/editor/other) |
|--------|-------|---------------------|-----------------|-----------------------------------|
| View galaxy | ✅ | ✅ | ✅ | ✅ |
| View full calendar | ✅ | ✅ | ❌ | ❌ |
| View own tasks + shared events | ✅ | ✅ | ✅ | ✅ |
| Create tasks | ✅ | ✅ | ❌ | ❌ |
| Assign tasks | ✅ | ✅ | ❌ | ❌ |
| Reschedule own tasks | ✅ | ✅ | ✅ | ✅ |
| Reschedule others' tasks | ✅ | ✅ | ❌ | ❌ |
| See other members' tasks | ✅ | ✅ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |

---

## 🗄️ Database Schema

### New Tables

#### `teams`
```sql
- id: uuid (PK)
- universe_id: text (FK → universes.id)
- name: text (e.g., "Kiss Bang's Team")
- created_by: uuid (FK → auth.users.id)
- created_at: timestamptz
```

#### `team_members`
```sql
- id: uuid (PK)
- team_id: uuid (FK → teams.id)
- user_id: uuid (FK → auth.users.id)
- role: text ('admin' | 'manager' | 'videographer' | 'editor' | 'artist' | 'other')
- permissions: text ('full' | 'member')
- display_name: text (e.g., "Ruby")
- invited_by: uuid (FK → auth.users.id, nullable)
- joined_at: timestamptz
- created_at: timestamptz
```

#### `team_invitations`
```sql
- id: uuid (PK)
- team_id: uuid (FK → teams.id)
- invite_token: text (UNIQUE, e.g., "abc123xyz")
- role: text
- invited_by: uuid (FK → auth.users.id)
- invited_name: text (optional, e.g., "Ruby")
- invited_email: text (optional)
- status: text ('pending' | 'accepted' | 'declined')
- created_at: timestamptz
- accepted_at: timestamptz (nullable)
- accepted_by: uuid (nullable, FK → auth.users.id)
```

#### `team_tasks`
```sql
- id: uuid (PK)
- team_id: uuid (FK → teams.id)
- galaxy_id: text (FK → galaxies.id, nullable)
- title: text
- description: text
- type: text ('invite_team' | 'brainstorm' | 'prep' | 'film' | 'edit' | 'review' | 'post' | 'custom')
- task_category: text ('task' | 'event')
  -- 'task' = personal, assigned to individuals
  -- 'event' = shared, visible to entire team (release dates, post dates, shoot days)
- date: date
- start_time: time
- end_time: time
- assigned_to: uuid (FK → auth.users.id, nullable for events)
- assigned_by: uuid (FK → auth.users.id)
- status: text ('pending' | 'in_progress' | 'completed')
- completed_at: timestamptz (nullable)
- created_at: timestamptz
- updated_at: timestamptz
```

#### `notifications`
```sql
- id: uuid (PK)
- user_id: uuid (FK → auth.users.id)
- team_id: uuid (FK → teams.id)
- type: text ('task_assigned' | 'task_completed' | 'task_rescheduled' | 'invite_accepted' | 'member_joined')
- title: text
- message: text
- data: jsonb (additional context — task_id, member_name, etc.)
- read: boolean (default false)
- created_at: timestamptz
```

### Shared Events (auto-generated)
These are `team_tasks` with `task_category = 'event'`:
- **Release dates** — from galaxy/world data
- **Post dates** — from calendar schedule (teaser, promo, audience-builder)
- **Shoot days** — generated after brainstorm task completion

---

## 🔄 User Flows

### Flow 1: Artist Finishes Onboarding
```
1. Artist completes onboarding → Galaxy View loads
2. System checks: did artist say they have a team?
   - YES → Auto-create team, add artist as admin
          → Schedule tasks: "Invite team members" (now → +15min)
                           "Brainstorm Content" (+15min → +30min)
   - NO  → Auto-create team, add artist as admin
          → Schedule tasks: "Brainstorm Content" (now → +15min)
3. Galaxy View shows todo list with these tasks
4. Admin user sees "Invite Team" button in Galaxy View header (always visible)
```

### Flow 2: Admin Invites Team Member
```
1. Admin clicks "Invite Team Members" (task or header button)
2. Share modal opens:
   - Input: Name (optional), Role (required dropdown)
   - Buttons: "📧 Email" | "💬 Text" | "🔗 Copy Link"
   - On mobile: also shows native share
3. System generates invite token → creates team_invitation record
4. Admin sends link: https://app.com/invite/{token}
5. "Invite team members" task auto-completes → disappears from todo
```

### Flow 3: Team Member Accepts Invite
```
1. Ruby clicks invite link → /invite/{token} page loads
2. Page shows: "Kiss Bang has invited you to join their 'Now You Got It' universe as a Videographer"
3. Ruby clicks "Accept Invite"
4. Ruby is prompted to create account (email + password only, NO onboarding)
5. After account creation → team_invitation status = 'accepted'
   → New team_member record created
   → Kiss Bang gets notification: "Ruby joined your team!"
6. Ruby's Galaxy View loads with Kiss Bang's universe
   → Her todo list shows only HER assigned tasks
   → Her calendar shows her tasks + shared events
```

### Flow 4: Admin Assigns Task
```
1. Admin views any task on calendar or todo list
2. Next to task: "Assign" button (not shown on "Invite team" task)
3. Click → dropdown shows:
   - Existing team members (with role badges)
   - "+ Invite someone new" option
4. Select Ruby → task assigned_to = Ruby's user_id
5. Ruby gets real-time notification: "Kiss Bang assigned you 'Brainstorm Content'"
6. Task appears on Ruby's todo list and calendar
```

### Flow 5: Team Member Reschedules Task
```
1. Ruby drags "Brainstorm Content" from today 9:30PM to tomorrow 5:30PM
2. System updates task date/time
3. Kiss Bang gets real-time notification: "Ruby rescheduled 'Brainstorm Content' to Wed 5:30 PM"
4. Task updates on Kiss Bang's calendar view too
```

### Flow 6: Task Completion
```
1. Ruby completes "Brainstorm Content" (completion = doing the task action, not checkbox)
2. Task status → 'completed', completed_at → now
3. Task disappears from Ruby's todo list and calendar
4. Kiss Bang gets notification: "Ruby completed 'Brainstorm Content'"
```

---

## 🎨 UI Components

### Galaxy View Todo List
```
╔══════════════════════════════════════════════╗
║  🌌 NOW YOU GOT IT                          ║
║  Release: March 5, 2026                     ║
╠══════════════════════════════════════════════╣
║  📋 YOUR TASKS                              ║
║                                              ║
║  ☐ 👥 Invite team members     (9:00 PM)     ║
║  ☐ 💡 Brainstorm Content      (9:15 PM)     ║
║  ☐ 📍 Scout locations         (Sat)         ║
║  ☐ 🎬 Film Session 1          (Mon)         ║
║                                              ║
╚══════════════════════════════════════════════╝

(Each task is clickable → opens task completion modal)
```

### Galaxy View Header (Admin)
```
┌─────────────────────────────────────────────┐
│ [VIEW CALENDAR]   🌌 Galaxy   [👥 INVITE]  │
└─────────────────────────────────────────────┘
```

### Role-Based Calendar Views

**Admin Calendar (Kiss Bang):**
- All prep tasks, posts, events, shoot days
- See all team members' tasks (color-coded by member)
- Can assign/reassign tasks

**Member Calendar (Ruby):**
- Only HER assigned tasks
- Shared events: release dates, post dates, shoot days
- Can drag to reschedule her own tasks

### Invite Share Modal
```
╔═══════════════════════════════════════════╗
║  👥 Invite Team Member                   ║
║                                           ║
║  Name: [Ruby_____________]                ║
║  Role: [▼ Videographer    ]               ║
║                                           ║
║  ┌─────────┐ ┌──────┐ ┌──────────┐      ║
║  │ 📧 Email│ │💬 Text│ │🔗 Copy   │      ║
║  └─────────┘ └──────┘ └──────────┘      ║
║                                           ║
║  Invite link:                             ║
║  https://app.com/invite/abc123xyz         ║
║                                           ║
╚═══════════════════════════════════════════╝
```

### Invite Acceptance Page (/invite/{token})
```
╔═══════════════════════════════════════════╗
║                                           ║
║  🎵 You've been invited!                 ║
║                                           ║
║  Kiss Bang has invited you to join        ║
║  their universe as a Videographer         ║
║                                           ║
║  🌌 Now You Got It                       ║
║  Releasing March 5, 2026                  ║
║                                           ║
║  ┌─────────────────────────┐              ║
║  │   ✅ Accept Invitation   │              ║
║  └─────────────────────────┘              ║
║                                           ║
╚═══════════════════════════════════════════╝
```

### Notification Bell
```
🔔 (2)
┌──────────────────────────────────┐
│ Ruby joined your team!       2m  │
│ Ruby rescheduled 'Brainstorm     │
│ Content' to Wed 5:30 PM     5m  │
│ ─────────────────────────────── │
│ Mark all as read                 │
└──────────────────────────────────┘
```

---

## 🏗️ Implementation Phases

### Phase 1: Foundation (Database + Types)
- SQL schema for all new tables + RLS policies
- TypeScript interfaces
- Basic API routes

### Phase 2: Team Creation + Invite System
- Auto-create team on onboarding completion
- Invite link generation + share modal
- /invite/{token} acceptance page
- Skip onboarding for invited members

### Phase 3: Galaxy View Todo List
- Todo list component below galaxy title
- Auto-schedule "Invite team" + "Brainstorm Content" tasks
- Clickable tasks (basic modal for now)
- "Invite Team" button in Galaxy View header

### Phase 4: Task Assignment
- "Assign" button on tasks
- Member picker dropdown
- Real-time task updates via Supabase Realtime

### Phase 5: Notifications
- Notifications table + API
- Bell icon with dropdown
- Toast notifications
- Supabase Realtime subscriptions
- Email notifications (Supabase Edge Functions or API route)

### Phase 6: Role-Based Calendar
- Member-filtered calendar view
- Task rescheduling with drag
- Admin notification on reschedule

---

## 🔮 Future Considerations (Not Building Yet)
- Task-specific completion interfaces (brainstorming board, etc.)
- Chat/messaging between team members
- File sharing per task
- Team analytics/activity feed
- Payment/invoicing for freelance team members
- Recurring task templates

---

**Status:** Design Finalized ✅  
**Waiting on:** Ruby's "Brainstorm Content" task workflow walkthrough  
**Last Updated:** Feb 11, 2026

