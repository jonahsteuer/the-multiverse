-- Add brainstorm_result column to galaxies table
-- This stores the brainstorm result so it's accessible to all team members

ALTER TABLE galaxies ADD COLUMN IF NOT EXISTS brainstorm_result jsonb DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN galaxies.brainstorm_result IS 'Stores the brainstorm content result (format assignments, edit days, shoot days) for cross-user sync';

