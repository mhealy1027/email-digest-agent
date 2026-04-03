export interface EmailMessage {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  labels: string[];
}

export interface CategorizedEmail {
  from: string;
  subject: string;
  summary: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface EmailDigest {
  tiers: {
    tier1: CategorizedEmail[];
    tier2: CategorizedEmail[];
    tier3: CategorizedEmail[];
    tier4_summary: string;
  };
  total_emails: number;
  action_items: string[];
}
