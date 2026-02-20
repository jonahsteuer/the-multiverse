-- ============================================================
-- DEDUPLICATE CALENDAR EVENTS IN team_tasks
-- Run this in the Supabase SQL Editor to remove duplicate
-- post/release events that were created by multiple renders
-- of the calendar.
--
-- It keeps the OLDEST record for each (team_id, galaxy_id,
-- date, title) combination and deletes all newer duplicates.
-- ============================================================

-- Step 1: Preview what will be deleted (run this first to check)
SELECT
  id,
  team_id,
  galaxy_id,
  title,
  date,
  task_category,
  created_at,
  ROW_NUMBER() OVER (
    PARTITION BY team_id, galaxy_id, date, title
    ORDER BY created_at ASC
  ) AS row_num
FROM public.team_tasks
WHERE task_category = 'event'
ORDER BY team_id, galaxy_id, date, title, created_at;

-- Step 2: Delete duplicates (keep the oldest per group)
-- Uncomment and run after reviewing Step 1.
/*
DELETE FROM public.team_tasks
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY team_id, galaxy_id, date, title
        ORDER BY created_at ASC
      ) AS row_num
    FROM public.team_tasks
    WHERE task_category = 'event'
  ) ranked
  WHERE row_num > 1
);
*/

-- Step 3: Verify — should show 1 row per (team_id, galaxy_id, date, title)
/*
SELECT team_id, galaxy_id, date, title, COUNT(*) as cnt
FROM public.team_tasks
WHERE task_category = 'event'
GROUP BY team_id, galaxy_id, date, title
HAVING COUNT(*) > 1;
*/

