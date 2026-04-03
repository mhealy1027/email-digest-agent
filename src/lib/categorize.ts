import Anthropic from '@anthropic-ai/sdk';
import { EmailMessage, EmailDigest } from './types';

const SYSTEM_PROMPT = `You are an email triage assistant for Michael, a professional in career transition who is actively job searching while working at PwC Strategy&.

Categorize each email into exactly ONE of these priority tiers:

**TIER 1 — JOB SEARCH (Highest Priority)**
Emails from recruiters, hiring managers, prospective companies, job boards, interview scheduling, offer letters, application confirmations, networking contacts related to job search. Look for signals like: company names he may have applied to, recruiter outreach, LinkedIn messages forwarded to email, scheduling tools like Calendly for interviews, follow-ups on applications.

**TIER 2 — FAMILY & IMPORTANT PERSONAL**
Emails from Paul Healy (any email containing "Paul Healy" or "Healy" in the from field that appears to be family). Also include any emails that appear to be from close family or friends with urgent/important content (not marketing).

**TIER 3 — WORK (PwC / Professional)**
Emails related to current work at PwC Strategy&, internal communications, project updates, team messages, professional development.

**TIER 4 — MARKETING & LOW PRIORITY**
Newsletters, promotional emails, subscription updates, automated notifications, social media digests, shopping receipts, app notifications. Summarize these in one brief line — do not detail each one.

For each email, respond in this exact JSON format:
{
  "tiers": {
    "tier1": [
      {
        "from": "sender name",
        "subject": "subject line",
        "summary": "1-2 sentence summary of what this is and any action needed",
        "urgency": "high" | "medium" | "low"
      }
    ],
    "tier2": [...same format...],
    "tier3": [...same format...],
    "tier4_summary": "Brief one-liner about the junk/marketing batch, e.g. '12 marketing emails — promotions from Amazon, LinkedIn notifications, 2 newsletters'"
  },
  "total_emails": number,
  "action_items": ["list of things Michael should respond to or act on today"]
}

Respond ONLY with valid JSON. No markdown, no backticks, no preamble.`;

function buildUserPrompt(emails: EmailMessage[]): string {
  const emailSummaries = emails.map((e, i) => (
    `Email ${i + 1}:
From: ${e.from}
To: ${e.to}
Subject: ${e.subject}
Date: ${e.date}
Snippet: ${e.snippet}
Body preview: ${e.body}
Labels: ${e.labels.join(', ')}
---`
  )).join('\n\n');

  return `Here are ${emails.length} unread emails from the last 6 hours. Categorize and summarize them:\n\n${emailSummaries}`;
}

async function callClaude(emails: EmailMessage[]): Promise<string> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(emails),
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.text || '';
}

export async function categorizeEmails(emails: EmailMessage[]): Promise<EmailDigest> {
  if (emails.length === 0) {
    return {
      tiers: {
        tier1: [],
        tier2: [],
        tier3: [],
        tier4_summary: '',
      },
      total_emails: 0,
      action_items: [],
    };
  }

  let responseText = await callClaude(emails);

  // Try to parse JSON response
  try {
    return JSON.parse(responseText) as EmailDigest;
  } catch {
    // Retry once on malformed JSON
    console.warn('Claude returned malformed JSON, retrying...');
    try {
      responseText = await callClaude(emails);
      return JSON.parse(responseText) as EmailDigest;
    } catch {
      // Fall back to a simple list
      console.error('Claude retry also failed, falling back to simple list');
      return {
        tiers: {
          tier1: [],
          tier2: [],
          tier3: emails.map((e) => ({
            from: e.from,
            subject: e.subject,
            summary: e.snippet,
            urgency: 'medium' as const,
          })),
          tier4_summary: '',
        },
        total_emails: emails.length,
        action_items: ['Review emails manually — automated categorization failed'],
      };
    }
  }
}
