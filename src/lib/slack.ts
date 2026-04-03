import { EmailDigest } from './types';

function getUrgencyEmoji(urgency: string): string {
  if (urgency === 'high') return ' 🚨';
  return '';
}

function formatTimeRange(): string {
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    });

  return `${fmt(sixHoursAgo)} – ${fmt(now)} ET`;
}

function buildDigestMessage(digest: EmailDigest): string {
  const timeRange = formatTimeRange();
  const lines: string[] = [];

  lines.push(`📬 *Email Digest — ${timeRange}*`);
  lines.push(`_${digest.total_emails} new emails processed_`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Tier 1 — Job Search
  if (digest.tiers.tier1.length > 0) {
    lines.push('🔴 *JOB SEARCH & RECRUITING*');
    for (const email of digest.tiers.tier1) {
      lines.push(`• *From:* ${email.from} — ${email.subject}`);
      lines.push(`  _${email.summary}_${getUrgencyEmoji(email.urgency)}`);
    }
    lines.push('');
  }

  // Tier 2 — Family & Personal
  if (digest.tiers.tier2.length > 0) {
    lines.push('🟡 *FAMILY & PERSONAL*');
    for (const email of digest.tiers.tier2) {
      lines.push(`• *From:* ${email.from} — ${email.subject}`);
      lines.push(`  _${email.summary}_`);
    }
    lines.push('');
  }

  // Tier 3 — Work
  if (digest.tiers.tier3.length > 0) {
    lines.push('🟢 *WORK*');
    for (const email of digest.tiers.tier3) {
      lines.push(`• *From:* ${email.from} — ${email.subject}`);
      lines.push(`  _${email.summary}_`);
    }
    lines.push('');
  }

  // Tier 4 — Marketing
  if (digest.tiers.tier4_summary) {
    lines.push('⚪ *MARKETING & LOW PRIORITY*');
    lines.push(`_${digest.tiers.tier4_summary}_`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Action Items
  if (digest.action_items.length > 0) {
    lines.push('✅ *Action Items:*');
    for (const item of digest.action_items) {
      lines.push(`• ${item}`);
    }
    lines.push('');
  }

  lines.push(`_All ${digest.total_emails} emails marked as read._`);

  return lines.join('\n');
}

export async function postToSlack(digest: EmailDigest | null): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error('SLACK_WEBHOOK_URL is not configured');
  }

  let text: string;

  if (!digest || digest.total_emails === 0) {
    text = '📬 *Email Digest* — All clear! No new emails in the last 6 hours.';
  } else {
    text = buildDigestMessage(digest);
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
  }
}
