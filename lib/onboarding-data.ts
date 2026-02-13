/**
 * Utility to load the latest onboarding conversation data for a creator
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export async function getLatestOnboardingData(creatorName: string): Promise<any | null> {
  try {
    const logsDir = join(process.cwd(), 'logs', 'onboarding-chats');
    
    // Get all files for this creator
    const files = await readdir(logsDir);
    const creatorFiles = files
      .filter(f => f.startsWith(creatorName) && f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
    
    if (creatorFiles.length === 0) {
      console.log(`[Onboarding Data] No logs found for ${creatorName}`);
      return null;
    }
    
    // Read the most recent file
    const latestFile = join(logsDir, creatorFiles[0]);
    const fileContent = await readFile(latestFile, 'utf-8');
    const logData = JSON.parse(fileContent);
    
    // Return the extracted profile data
    if (logData.extractedProfile) {
      console.log(`[Onboarding Data] Loaded profile data from ${creatorFiles[0]}`);
      return logData.extractedProfile;
    }
    
    return null;
  } catch (error) {
    console.error(`[Onboarding Data] Error loading data for ${creatorName}:`, error);
    return null;
  }
}

