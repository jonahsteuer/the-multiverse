import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const POST_SLOT_TYPES = ['post', 'teaser', 'promo', 'story', 'release', 'audience-builder'] as const;
type PostSlotType = typeof POST_SLOT_TYPES[number];

function toTaskType(type: string): PostSlotType {
  if ((POST_SLOT_TYPES as readonly string[]).includes(type)) return type as PostSlotType;
  return 'post';
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  try {
    const { teamId, galaxyId, slots } = await req.json() as {
      teamId: string;
      galaxyId?: string;
      slots: Array<{ date: string; type: string; title?: string }>;
    };

    if (!teamId || !slots?.length) {
      return NextResponse.json({ error: 'teamId and slots required' }, { status: 400 });
    }

    const inserted: any[] = [];
    for (const slot of slots) {
      const taskType = toTaskType(slot.type);
      const label = slot.title || `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} Post`;

      const { data, error } = await supabase.from('team_tasks').insert({
        team_id: teamId,
        galaxy_id: galaxyId || null,
        title: label,
        description: 'Empty post slot — add content when ready.',
        type: taskType,
        task_category: 'event',
        date: slot.date,
        start_time: '12:00',
        end_time: '13:00',
        status: 'pending',
      }).select().single();

      if (error) {
        console.error('[add-post-slots] insert error:', error);
      } else {
        inserted.push(data);
      }
    }

    return NextResponse.json({ success: true, count: inserted.length, tasks: inserted });
  } catch (err: any) {
    console.error('[add-post-slots] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
