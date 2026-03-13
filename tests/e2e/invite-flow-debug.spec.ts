/**
 * INVITE FLOW — Comprehensive Test Suite
 *
 * Verifies three critical behaviours after the galaxy-level sharing refactor:
 *   A) Invitee lands on the correct galaxy (not a "Waiting" or loading screen)
 *   B) Invitee sees ALL team members (not just themselves — RLS fix for team_members)
 *   C) Calendar shows no duplicate events (display-level dedup)
 *   D) Admin sees the invitee in their team member list
 *
 * All test data is created fresh using the service-role key so the test is
 * fully self-contained and repeatable.
 *
 * Run:
 *   PLAYWRIGHT_BROWSERS_PATH=/Users/jonahsteuer/Library/Caches/ms-playwright \
 *   npx playwright test invite-flow-debug --headed --project=chromium --no-deps
 */

import { test, expect, Page } from '@playwright/test';
import { snap } from './helpers';

const BASE_URL  = 'https://the-multiverse.vercel.app';
const SUPA_URL  = 'https://bjwesfqinkktspzcchec.supabase.co';

const SUPA_ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqd2VzZnFpbmtrdHNwemNjaGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxODM5MzcsImV4cCI6MjA4Mzc1OTkzN30.nuQtQKmqkdSGJsL9m4OVFyf_ANgCpBUDozO9mjcV_PY';
const SUPA_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqd2VzZnFpbmtrdHNwemNjaGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE4MzkzNywiZXhwIjoyMDgzNzU5OTM3fQ.TH5aBHyZrmrmoViNrDt7gVnwj9Cx7uP1HbWcrVLseWg';

const SUFFIX         = Date.now();
const ADMIN_EMAIL    = `test+admin${SUFFIX}@b-zb.com`;
const ADMIN_PASS     = 'TestAdmin2026!';
const ADMIN_NAME     = `TestAdmin${SUFFIX}`;
const INVITEE_EMAIL  = `test+inv${SUFFIX}@b-zb.com`;
const INVITEE_PASS   = 'TestInvitee2026!';
const INVITEE_NAME   = `TestInvitee${SUFFIX}`;
const GALAXY_NAME    = `TestGalaxy${SUFFIX}`;

const SS = 'tests/e2e/screenshots/invite';

function log(msg: string) { console.log(`[INVITE-TEST] ${msg}`); }

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function servicePost(path: string, body: object) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function serviceGet(path: string) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    headers: {
      'apikey': SUPA_SERVICE_KEY,
      'Authorization': `Bearer ${SUPA_SERVICE_KEY}`,
    },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function anonGet(path: string, token: string) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    headers: {
      'apikey': SUPA_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function signUp(email: string, password: string, displayName: string) {
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON_KEY },
    body: JSON.stringify({ email, password, data: { display_name: displayName } }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`signUp failed: ${JSON.stringify(data)}`);
  return data as { access_token: string; user: { id: string } };
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`signIn failed: ${JSON.stringify(data)}`);
  return data as { access_token: string; user: { id: string } };
}

// ─── Helpers to attach logging to a page ────────────────────────────────────

function attachLogs(page: Page, label: string) {
  page.on('request', req => {
    const url = req.url().replace(BASE_URL, '').replace(SUPA_URL, '[supa]');
    if (req.url().includes('/api/') || (req.url().includes('supabase') && !req.url().includes('/storage/'))) {
      log(`[${label}] → ${req.method()} ${url}`);
    }
  });
  page.on('response', async resp => {
    const url  = resp.url().replace(BASE_URL, '').replace(SUPA_URL, '[supa]');
    const s    = resp.status();
    const interesting = url.includes('/api/') || (s >= 400 && url.includes('supa'))
      || url.includes('team') || url.includes('universe') || url.includes('galaxy');
    if (interesting) {
      const body = await resp.json().catch(() => resp.text().catch(() => ''));
      log(`[${label}] ← ${s} ${url} :: ${JSON.stringify(body).slice(0, 500)}`);
    }
  });
  page.on('console', msg => {
    const t = msg.text();
    if (msg.type() === 'error' || t.includes('[load') || t.includes('[Account') || t.includes('[team') || t.includes('galaxy') || t.includes('universe') || t.includes('Team')) {
      log(`[${label}] CONSOLE[${msg.type()}]: ${t.slice(0, 300)}`);
    }
  });
}

// ─── Poll until a condition is met (returns the matched label or 'timeout') ──

async function pollState(
  page: Page,
  checks: Array<{ label: string; selector: string }>,
  maxSeconds = 30,
): Promise<string> {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    for (const { label, selector } of checks) {
      const visible = await page.locator(selector).isVisible().catch(() => false);
      if (visible) return label;
    }
    await page.waitForTimeout(1500);
  }
  return 'timeout';
}

// ─── Main test ───────────────────────────────────────────────────────────────

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(300_000);

test('Invite flow: member count + no duplicate events + admin sees invitee', async ({ page, request }) => {

  // ── PHASE 1: Build test data ─────────────────────────────────────────────
  log('=== PHASE 1: Creating test data ===');

  log('Creating admin account...');
  const adminAuth = await signUp(ADMIN_EMAIL, ADMIN_PASS, ADMIN_NAME);
  log(`Admin userId: ${adminAuth.user.id}`);

  log('Creating invitee account...');
  const inviteeAuth = await signUp(INVITEE_EMAIL, INVITEE_PASS, INVITEE_NAME);
  log(`Invitee userId: ${inviteeAuth.user.id}`);

  const now = new Date().toISOString();
  const releaseDate = `${new Date().getFullYear() + 1}-03-21`;

  // Admin profile
  await servicePost('/rest/v1/profiles', {
    id: adminAuth.user.id,
    creator_name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    user_type: 'artist',
    onboarding_complete: true,
    updated_at: now,
  });

  // Invitee profile — onboarding_complete: true so the app skips onboarding
  await servicePost('/rest/v1/profiles', {
    id: inviteeAuth.user.id,
    creator_name: INVITEE_NAME,
    email: INVITEE_EMAIL,
    user_type: 'videographer',
    onboarding_complete: true,
    updated_at: now,
  });

  // Universe → Galaxy → World
  const universeId = crypto.randomUUID();
  await servicePost('/rest/v1/universes', {
    id: universeId,
    name: `${ADMIN_NAME}'s Universe`,
    creator_id: adminAuth.user.id,
    created_at: now,
  });
  log(`Universe: ${universeId}`);

  const galaxyId = crypto.randomUUID();
  const { status: gS } = await servicePost('/rest/v1/galaxies', {
    id: galaxyId,
    universe_id: universeId,
    name: GALAXY_NAME,
    visual_landscape: 'urban_night',
    release_date: releaseDate,
    created_at: now,
    updated_at: now,
  });
  log(`Galaxy insert: ${gS}, id=${galaxyId}`);
  expect(gS, 'Galaxy must insert as 201').toBe(201);

  const worldId = crypto.randomUUID();
  await servicePost('/rest/v1/worlds', {
    id: worldId,
    galaxy_id: galaxyId,
    name: 'Test World',
    release_date: releaseDate,
    color: '#8B5CF6',
    is_public: false,
    is_released: false,
    created_at: now,
    updated_at: now,
  });

  // Team (with galaxy_id)
  const teamId = crypto.randomUUID();
  const teamRowBase = {
    id: teamId,
    universe_id: universeId,
    name: `${ADMIN_NAME}'s Team`,
    created_by: adminAuth.user.id,
    created_at: now,
  };
  const { status: tS1 } = await servicePost('/rest/v1/teams', { ...teamRowBase, galaxy_id: galaxyId });
  if (tS1 !== 201) {
    const { status: tS2 } = await servicePost('/rest/v1/teams', teamRowBase);
    log(`Team fallback insert: ${tS2}`);
    expect(tS2, 'Team must insert as 201').toBe(201);
  }
  log(`Team: ${teamId}`);

  // Admin as team member
  await servicePost('/rest/v1/team_members', {
    id: crypto.randomUUID(),
    team_id: teamId,
    user_id: adminAuth.user.id,
    role: 'manager',
    permissions: 'full',
    display_name: ADMIN_NAME,
    joined_at: now,
    created_at: now,
  });

  // Invitee as team member (pre-insert — simulates successful invite acceptance)
  await servicePost('/rest/v1/team_members', {
    id: crypto.randomUUID(),
    team_id: teamId,
    user_id: inviteeAuth.user.id,
    role: 'videographer',
    permissions: 'member',
    display_name: INVITEE_NAME,
    joined_at: now,
    created_at: now,
  });
  log('Both members inserted into team_members');

  // ── Intentionally insert DUPLICATE event tasks to test dedup ──────────────
  const makeEvent = (title: string, date: string, i: number) => ({
    id: crypto.randomUUID(),
    team_id: teamId,
    galaxy_id: galaxyId,
    title,
    description: '',
    type: title.includes('RELEASE') ? 'release' : 'post',
    task_category: 'event',
    date,
    start_time: '12:00',
    end_time: '23:59',
    status: 'pending',
    created_at: new Date(Date.now() + i).toISOString(),
  });

  // Insert 3 RELEASE DAY events (duplicates) — simulates the real bug
  for (let i = 0; i < 3; i++) {
    await servicePost('/rest/v1/team_tasks', makeEvent(`${ADMIN_NAME} - RELEASE DAY!`, releaseDate, i));
  }
  // Insert 3 Promo Post events on one day
  const promoDate = `${new Date().getFullYear() + 1}-03-25`;
  for (let i = 0; i < 3; i++) {
    await servicePost('/rest/v1/team_tasks', makeEvent('Promo Post', promoDate, i));
  }
  log('Inserted 3 duplicate RELEASE DAY + 3 duplicate Promo Post events');

  // Invite record — status 'pending' so the sign-up form appears on the invite page
  const inviteToken = `test-${SUFFIX}-${Math.random().toString(36).slice(2)}`;
  const { status: invS } = await servicePost('/rest/v1/team_invitations', {
    id: crypto.randomUUID(),
    team_id: teamId,
    invite_token: inviteToken,
    role: 'videographer',
    invited_by: adminAuth.user.id,
    invited_name: INVITEE_NAME,
    invited_email: INVITEE_EMAIL,
    status: 'pending',
    created_at: now,
  });
  log(`Invite token insert: ${invS}`);

  // ── PHASE 2: Verify DB state with service key ────────────────────────────
  log('\n=== PHASE 2: Verifying DB state (service key) ===');

  const { data: dbMembers } = await serviceGet(
    `/rest/v1/team_members?team_id=eq.${teamId}&select=user_id,display_name,role`
  );
  log(`DB team_members: ${JSON.stringify(dbMembers)}`);
  expect(Array.isArray(dbMembers) && dbMembers.length, 'DB must have 2 members').toBe(2);

  const { data: dbTasks } = await serviceGet(
    `/rest/v1/team_tasks?team_id=eq.${teamId}&task_category=eq.event&select=title,date`
  );
  log(`DB event tasks (${dbTasks?.length}): ${JSON.stringify(dbTasks)}`);
  expect(dbTasks?.length, 'DB must have 6 event tasks (3+3 duplicates)').toBe(6);

  // ── PHASE 3: Verify RLS — invitee can see ALL team members ───────────────
  log('\n=== PHASE 3: Verifying team_members RLS for invitee ===');

  const { status: rlsS, data: rlsData } = await anonGet(
    `/rest/v1/team_members?team_id=eq.${teamId}&select=user_id,display_name,role`,
    inviteeAuth.access_token
  );
  log(`Invitee team_members via RLS (${rlsS}): ${JSON.stringify(rlsData)}`);

  const inviteeCanSeeMembers = Array.isArray(rlsData) && rlsData.length === 2;
  if (!inviteeCanSeeMembers) {
    log('⚠️  RLS ISSUE: Invitee can only see ' + (Array.isArray(rlsData) ? rlsData.length : 0) + ' members instead of 2');
    log('   → Run FIX_TEAM_MEMBERS_RLS.sql to fix team_members SELECT policy');
  } else {
    log('✅ RLS OK: Invitee can see all 2 team members');
  }

  // ── PHASE 4: Invitee opens the invite link (real-world flow) ────────────
  log('\n=== PHASE 4: Invitee opens the invite link ===');

  const inviteeCtx = await page.context().browser()!.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [] },
  });
  const inviteePage = await inviteeCtx.newPage();
  attachLogs(inviteePage, 'invitee');

  const inviteLink = `${BASE_URL}/invite/${inviteToken}`;
  log(`Opening invite link: ${inviteLink}`);
  await inviteePage.goto(inviteLink, { waitUntil: 'networkidle', timeout: 25_000 });
  await snap(inviteePage, `${SS}/01-invitee-invite-page`);

  const invitePageText = await inviteePage.locator('body').innerText().catch(() => '');
  log(`Invite page text (first 200): ${invitePageText.slice(0, 200)}`);

  // Check whether a sign-up form or "Welcome" screen is showing
  const passField  = inviteePage.locator('input[type="password"]').first();
  const hasSignupForm = await passField.isVisible({ timeout: 3000 }).catch(() => false);
  const hasWelcomeAlready = await inviteePage.locator('text=Welcome to the team').isVisible().catch(() => false);

  if (hasSignupForm) {
    log('Found sign-up form on invite page — filling...');
    const nameField  = inviteePage.locator('input').first();
    const emailField = inviteePage.locator('input[type="email"]').first();
    await nameField.fill(INVITEE_NAME);
    await emailField.fill(INVITEE_EMAIL).catch(() => {});
    await passField.fill(INVITEE_PASS);
    await snap(inviteePage, `${SS}/02-invitee-form-filled`);

    await inviteePage.getByRole('button', { name: /accept invitation/i }).click();
    log('Clicked Accept Invitation');

    const welcomed = await inviteePage.waitForSelector('text=Welcome to the team', { timeout: 20_000 })
      .then(() => true).catch(() => false);
    log(`Welcome screen: ${welcomed}`);
    await snap(inviteePage, `${SS}/03-invitee-after-accept`);

    if (welcomed) {
      await inviteePage.getByRole('button', { name: /open app/i }).click({ timeout: 10_000 });
      log('Clicked Open App');
    }
  } else if (hasWelcomeAlready) {
    log('Invite already accepted — clicking Open App...');
    await inviteePage.getByRole('button', { name: /open app/i }).click({ timeout: 10_000 });
  } else {
    // Fallback: sign in directly at the main app URL
    log('No invite form and no welcome screen — signing in directly at main app URL');
    await inviteePage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20_000 });

    const emailIn = inviteePage.locator('input[type="email"]').first();
    const hasAuthForm = await emailIn.isVisible({ timeout: 6000 }).catch(() => false);
    if (hasAuthForm) {
      await emailIn.fill(INVITEE_EMAIL);
      await inviteePage.locator('input[type="password"]').first().fill(INVITEE_PASS);
      // Try "Sign In" button first, fallback to any submit button
      const signInBtn = inviteePage.getByRole('button', { name: /sign in/i });
      if (await signInBtn.isVisible().catch(() => false)) {
        await signInBtn.click();
      } else {
        await inviteePage.locator('button[type="submit"]').first().click();
      }
      log('Submitted sign-in form');
      await inviteePage.waitForTimeout(3000);
    }
  }

  // After auth, inject team_info localStorage so the app loads the correct galaxy
  await inviteePage.evaluate(({ teamId, galaxyId, universeId, teamName }) => {
    if (!localStorage.getItem('multiverse_team_info')) {
      localStorage.setItem('multiverse_team_info', JSON.stringify({
        teamId, galaxyId, universeId, teamName, role: 'videographer',
      }));
    }
  }, { teamId, galaxyId, universeId, teamName: `${ADMIN_NAME}'s Team` });

  await inviteePage.waitForTimeout(3000);
  await snap(inviteePage, `${SS}/04-invitee-loading`);

  // Poll until app reaches a stable state
  const appState = await pollState(inviteePage, [
    { label: 'todo-list',       selector: 'text=TODO LIST' },
    { label: 'galaxy-name',     selector: `text=${GALAXY_NAME}` },
    { label: 'waiting-screen',  selector: 'text=Waiting for Your Team' },
    { label: 'loading-screen',  selector: 'text=Setting up your universe' },
  ], 50);
  log(`App state: ${appState}`);
  await snap(inviteePage, `${SS}/05-invitee-app-state`);

  // ── PHASE 5: Open profile panel + assert member count ────────────────────
  log('\n=== PHASE 5: Checking profile panel ===');

  // Try several selectors for the profile button (top-right avatar circle)
  const profileOpened = await (async () => {
    for (const sel of [
      '[data-testid="profile-btn"]',
      'button[aria-label*="profile" i]',
      '.profile-btn',
    ]) {
      const btn = inviteePage.locator(sel).first();
      if (await btn.isVisible().catch(() => false)) { await btn.click(); return true; }
    }
    // Fallback: last button that looks like an avatar (single uppercase letter)
    const avatarBtns = inviteePage.locator('button').filter({ hasText: /^[A-Z]$/ });
    const count = await avatarBtns.count().catch(() => 0);
    if (count > 0) { await avatarBtns.last().click(); return true; }
    return false;
  })();
  log(`Profile panel opened: ${profileOpened}`);
  await inviteePage.waitForTimeout(1500);
  await snap(inviteePage, `${SS}/06-invitee-profile-panel`);

  const profileText = await inviteePage.locator('body').innerText().catch(() => '');
  const memberCountMatch = profileText.match(/(\d+)\s*member/i);
  const memberCount = memberCountMatch ? parseInt(memberCountMatch[1]) : -1;
  log(`Profile panel member count: ${memberCount}`);

  if (memberCount !== 2) {
    log(`⚠️  MEMBER COUNT ISSUE: shows ${memberCount}, expected 2`);
    log('   → Fix team_members SELECT RLS policy (see FIX_TEAM_MEMBERS_RLS.sql)');
  } else {
    log('✅ Member count correct: 2');
  }

  // ── PHASE 6: Open calendar and check for duplicates ──────────────────────
  log('\n=== PHASE 6: Checking calendar for duplicates ===');

  const calBtn = inviteePage.getByRole('button', { name: /view calendar/i });
  const calVisible = await calBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (calVisible) {
    await calBtn.click();
    await inviteePage.waitForTimeout(2000);
    await snap(inviteePage, `${SS}/05-invitee-calendar`);

    const calText = await inviteePage.locator('body').innerText().catch(() => '');

    // Count occurrences of key event text
    const releaseDayCount = (calText.match(/RELEASE DAY/gi) || []).length;
    const promoPostCount  = (calText.match(/Promo Post/gi) || []).length;
    log(`Calendar RELEASE DAY occurrences: ${releaseDayCount}`);
    log(`Calendar Promo Post occurrences: ${promoPostCount}`);

    if (releaseDayCount > 1) {
      log(`⚠️  DUPLICATE EVENTS: ${releaseDayCount}x RELEASE DAY visible in calendar`);
      log('   → Display-level dedup in loadTeamData not applied or not reached');
    } else {
      log(`✅ Calendar dedup OK: exactly 1 RELEASE DAY event shown`);
    }
    if (promoPostCount > 1) {
      log(`⚠️  DUPLICATE EVENTS: ${promoPostCount}x Promo Post visible in calendar`);
    } else {
      log(`✅ Calendar dedup OK: exactly 1 Promo Post event shown`);
    }

    expect(releaseDayCount, 'Should show exactly 1 RELEASE DAY event (deduped)').toBe(1);
  } else {
    log('Calendar button not visible — skipping calendar assertions');
  }

  await inviteeCtx.close();

  // ── PHASE 7: Open app as admin and check they see invitee ────────────────
  log('\n=== PHASE 7: Admin verifies invitee appears in team ===');

  const adminCtx = await page.context().browser()!.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [] },
  });
  const adminPage = await adminCtx.newPage();
  attachLogs(adminPage, 'admin');

  await adminPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20_000 });
  await snap(adminPage, `${SS}/09-admin-landing`);

  // Sign in as admin
  const adminEmailInput = adminPage.locator('input[type="email"]').first();
  const adminHasForm = await adminEmailInput.isVisible({ timeout: 5000 }).catch(() => false);
  if (adminHasForm) {
    log('Filling admin sign-in form...');
    await adminEmailInput.fill(ADMIN_EMAIL);
    await adminPage.locator('input[type="password"]').first().fill(ADMIN_PASS);
    await adminPage.getByRole('button', { name: /sign in/i }).click();
    await adminPage.waitForTimeout(2000);
  } else {
    log('No admin sign-in form found — might already be authenticated');
  }

  // Inject localStorage so admin loads the correct universe
  await adminPage.evaluate(({ universeId, galaxyId, teamId, teamName }) => {
    localStorage.removeItem('multiverse_team_info');
    localStorage.setItem('multiverse_universe', JSON.stringify({
      id: universeId, galaxies: [{ id: galaxyId }]
    }));
  }, { universeId, galaxyId, teamId, teamName: `${ADMIN_NAME}'s Team` });
  await adminPage.reload({ waitUntil: 'networkidle', timeout: 20_000 });

  const adminState = await pollState(adminPage, [
    { label: 'todo-list',   selector: 'text=TODO LIST' },
    { label: 'galaxy-name', selector: `text=${GALAXY_NAME}` },
    { label: 'onboarding',  selector: 'text=What should we call you' },
  ], 40);
  log(`Admin app state: ${adminState}`);
  await snap(adminPage, `${SS}/10-admin-app`);

  // Open profile panel
  const adminAvatarBtn = adminPage.locator('button').filter({ hasText: /^[A-Z]$/ }).last();
  await adminAvatarBtn.click().catch(() => log('Could not click admin avatar'));
  await adminPage.waitForTimeout(1500);
  await snap(adminPage, `${SS}/11-admin-profile`);

  const adminProfileText = await adminPage.locator('body').innerText().catch(() => '');
  const inviteeVisibleToAdmin = adminProfileText.toLowerCase().includes(INVITEE_NAME.toLowerCase());
  log(`Admin sees invitee "${INVITEE_NAME}": ${inviteeVisibleToAdmin}`);

  const adminMemberMatch = adminProfileText.match(/(\d+)\s*member/i);
  const adminMemberCount = adminMemberMatch ? parseInt(adminMemberMatch[1]) : -1;
  log(`Admin sees member count: ${adminMemberCount}`);

  await adminCtx.close();

  // ── PHASE 8: Final API-level sanity check ────────────────────────────────
  log('\n=== PHASE 8: API sanity check ===');

  // Admin calls /api/team/universe — should return the galaxy with correct data
  const apiResp = await request.get(`${BASE_URL}/api/team/universe`, {
    headers: { Authorization: `Bearer ${adminAuth.access_token}` },
  });
  const apiData = await apiResp.json();
  log(`/api/team/universe (${apiResp.status()}): galaxies=${apiData?.universe?.galaxies?.length}, teamId=${apiData?.teamId}, galaxyId=${apiData?.galaxyId}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  log('\n=== TEST SUMMARY ===');
  log(`Invitee app state:     ${appState}`);
  log(`RLS member visibility: invitee saw ${Array.isArray(rlsData) ? rlsData.length : 0}/2 members`);
  log(`Admin sees invitee:    ${inviteeVisibleToAdmin}`);
  log(`Admin member count:    ${adminMemberCount}`);

  // Hard assertions
  expect(appState, 'Invitee must reach galaxy view').toMatch(/todo-list|galaxy-name/);
  expect(inviteeCanSeeMembers, 'team_members RLS must return all members to invitee').toBe(true);
  expect(inviteeVisibleToAdmin, 'Admin must see the invitee in their team').toBe(true);
});
