'use client';

import { useState } from 'react';
import type { ReminderSettings } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ReminderSettingsProps {
  userId: string;
  initialSettings?: ReminderSettings;
  onSave?: (settings: ReminderSettings) => void;
}

export function ReminderSettingsComponent({
  userId,
  initialSettings,
  onSave,
}: ReminderSettingsProps) {
  const [settings, setSettings] = useState<ReminderSettings>(
    initialSettings || {
      userId,
      emailReminders: true,
      inAppReminders: true,
      reminderDaysBefore: [7, 3, 1],
      reminderTime: '09:00',
      postReminders: true,
      shootReminders: true,
      editDeadlineReminders: true,
    }
  );

  const handleSave = () => {
    if (onSave) {
      onSave(settings);
    }
  };

  return (
    <Card className="border-yellow-500/30 bg-black/50">
      <CardHeader>
        <CardTitle className="text-xl font-star-wars text-yellow-400">
          Reminder Settings
        </CardTitle>
        <CardDescription className="text-gray-400 font-star-wars">
          Configure when and how you receive reminders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Methods */}
        <div className="space-y-3">
          <Label className="font-star-wars text-yellow-400">Notification Methods</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailReminders}
                onChange={(e) =>
                  setSettings({ ...settings, emailReminders: e.target.checked })
                }
                className="w-4 h-4 text-yellow-500 bg-black border-yellow-500 rounded focus:ring-yellow-500"
              />
              <span className="text-gray-300">Email reminders</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inAppReminders}
                onChange={(e) =>
                  setSettings({ ...settings, inAppReminders: e.target.checked })
                }
                className="w-4 h-4 text-yellow-500 bg-black border-yellow-500 rounded focus:ring-yellow-500"
              />
              <span className="text-gray-300">In-app notifications</span>
            </label>
          </div>
        </div>

        {/* Reminder Timing */}
        <div className="space-y-3">
          <Label className="font-star-wars text-yellow-400">Reminder Timing</Label>
          <div className="space-y-2">
            <div>
              <Label className="text-sm text-gray-400">Days before event</Label>
              <Input
                type="text"
                value={settings.reminderDaysBefore.join(', ')}
                onChange={(e) => {
                  const days = e.target.value
                    .split(',')
                    .map((d) => parseInt(d.trim()))
                    .filter((d) => !isNaN(d));
                  setSettings({ ...settings, reminderDaysBefore: days });
                }}
                placeholder="7, 3, 1"
                className="bg-black/50 border-yellow-500/30 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list (e.g., "7, 3, 1" for 7 days, 3 days, and 1 day before)
              </p>
            </div>
            <div>
              <Label className="text-sm text-gray-400">Reminder time</Label>
              <Input
                type="time"
                value={settings.reminderTime}
                onChange={(e) =>
                  setSettings({ ...settings, reminderTime: e.target.value })
                }
                className="bg-black/50 border-yellow-500/30 text-white"
              />
            </div>
          </div>
        </div>

        {/* Reminder Types */}
        <div className="space-y-3">
          <Label className="font-star-wars text-yellow-400">Reminder Types</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.postReminders}
                onChange={(e) =>
                  setSettings({ ...settings, postReminders: e.target.checked })
                }
                className="w-4 h-4 text-yellow-500 bg-black border-yellow-500 rounded focus:ring-yellow-500"
              />
              <span className="text-gray-300">Post reminders</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.shootReminders}
                onChange={(e) =>
                  setSettings({ ...settings, shootReminders: e.target.checked })
                }
                className="w-4 h-4 text-yellow-500 bg-black border-yellow-500 rounded focus:ring-yellow-500"
              />
              <span className="text-gray-300">Shoot day reminders</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.editDeadlineReminders}
                onChange={(e) =>
                  setSettings({ ...settings, editDeadlineReminders: e.target.checked })
                }
                className="w-4 h-4 text-yellow-500 bg-black border-yellow-500 rounded focus:ring-yellow-500"
              />
              <span className="text-gray-300">Edit deadline reminders</span>
            </label>
          </div>
        </div>

        <Button
          onClick={handleSave}
          className="w-full font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
        >
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}


