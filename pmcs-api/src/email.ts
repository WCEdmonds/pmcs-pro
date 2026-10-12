// Notification emails through Resend. Callers run these in background() so a
// failure is logged and never fails a request.
import type { Env } from './index';
import { escapeHtml } from './validate';

export interface Email {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: string }>;
}

const split = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Recipients for a unit: its unit_settings.notification_emails, or the env
 * NOTIFICATION_EMAIL fallback when the unit has none.
 */
export async function recipientsFor(env: Env, uic: string | null | undefined): Promise<string[]> {
  if (uic) {
    const row = await env.DB.prepare('SELECT notification_emails FROM unit_settings WHERE uic = ?')
      .bind(uic).first<{ notification_emails: string | null }>();
    try {
      const list = JSON.parse(row?.notification_emails ?? '[]');
      if (Array.isArray(list) && list.length) return list.filter((e): e is string => typeof e === 'string');
    } catch { /* fall through to the default */ }
  }
  return split(env.NOTIFICATION_EMAIL);
}

/** Sends one email. Skipped unless RESEND_API_KEY is set and there is a recipient. */
export async function sendEmail(env: Env, msg: Email): Promise<void> {
  if (!env.RESEND_API_KEY || !msg.to.length) return;
  const res = await fetch(env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.NOTIFICATION_FROM || 'PMCS Pro <onboarding@resend.dev>', ...msg }),
  });
  if (!res.ok) console.error({ event: 'resend_failed', status: res.status, body: (await res.text()).slice(0, 500) });
}

export interface Member {
  rank?: unknown; first_name?: unknown; last_name?: unknown; mi?: unknown; dod_id?: unknown;
}

/** "PMCS Pro: new member in <UIC>" to the target unit's recipients. */
export async function sendJoinEmail(env: Env, uic: string, member: Member, at = new Date().toISOString()) {
  const to = await recipientsFor(env, uic);
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = [s(member.first_name), s(member.mi), s(member.last_name)].filter(Boolean).join(' ') || '(no name)';
  const last4 = s(member.dod_id).slice(-4);
  const note = 'Unit membership in PMCS Pro is self-asserted: anyone can join a unit without approval. '
    + 'You can review membership changes in the dashboard audit log.';
  const rows: Array<[string, string]> = [
    ['Rank', s(member.rank) || '-'], ['Name', name], ['DoD ID (last 4)', last4 || '-'], ['UIC', uic], ['Time (UTC)', at],
  ];
  const subject = `PMCS Pro: new member in ${uic}`;
  await sendEmail(env, {
    to,
    subject,
    text: `A new member joined ${uic} in PMCS Pro.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${note}`,
    html: `<p>A new member joined <b>${escapeHtml(uic)}</b> in PMCS Pro.</p><table>${rows
      .map(([k, v]) => `<tr><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(v)}</td></tr>`).join('')}</table><p>${escapeHtml(note)}</p>`,
  });
}
