import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { recipientUserId, senderName, itemName, editUrl, note, teamName } = await req.json() as {
      recipientUserId: string;
      senderName: string;
      itemName: string;
      editUrl?: string;
      note: string;
      teamName?: string;
    };

    if (!recipientUserId || !senderName || !note) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // Gracefully skip — email not configured
      return NextResponse.json({ skipped: true, reason: 'RESEND_API_KEY not set' });
    }

    // Look up recipient's email via service role (bypasses RLS on auth.users)
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(recipientUserId);
    if (userError || !userData?.user?.email) {
      console.warn('[send-edit-notification] Could not resolve recipient email:', userError?.message);
      return NextResponse.json({ skipped: true, reason: 'Could not resolve email' });
    }

    const recipientEmail = userData.user.email;

    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);

    const editLinkHtml = editUrl
      ? `<p style="margin:16px 0"><a href="${editUrl}" style="background:#3b82f6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">View ${itemName}</a></p>`
      : '';

    await resend.emails.send({
      from: 'The Multiverse <noreply@themultiverse.space>',
      to: recipientEmail,
      subject: `${senderName} sent you notes on ${itemName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f0f0f;color:#e5e7eb;border-radius:12px;">
          <h2 style="margin:0 0 8px;color:#fff">Notes from ${senderName}</h2>
          <p style="margin:0 0 16px;color:#9ca3af;font-size:14px;">${teamName ? `${teamName} · ` : ''}${itemName}</p>
          <div style="background:#1f2937;border-radius:8px;padding:16px;border-left:3px solid #6366f1;">
            <p style="margin:0;white-space:pre-wrap;font-size:15px;">${note}</p>
          </div>
          ${editLinkHtml}
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">Sent via The Multiverse · Reply in your team chat</p>
        </div>
      `,
    });

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    console.error('[send-edit-notification] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
