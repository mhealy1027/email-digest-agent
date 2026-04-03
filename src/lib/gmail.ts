import { google } from 'googleapis';
import { EmailMessage } from './types';

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  return oauth2Client;
}

function getHeader(headers: { name?: string | null; value?: string | null }[], name: string): string {
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value || '';
}

function extractPlainTextBody(payload: any): string {
  // Direct plain text body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  // Multipart — recurse through parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }

  return '';
}

export async function fetchUnreadEmails(): Promise<EmailMessage[]> {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread newer_than:6h',
    maxResults: 100,
  });

  const messageIds = listResponse.data.messages || [];

  if (messageIds.length === 0) {
    return [];
  }

  const emails: EmailMessage[] = [];

  for (const msg of messageIds) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'full',
    });

    const headers = detail.data.payload?.headers || [];
    const body = extractPlainTextBody(detail.data.payload);

    emails.push({
      messageId: detail.data.id!,
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      subject: getHeader(headers, 'Subject'),
      snippet: detail.data.snippet || '',
      body: body.substring(0, 500),
      date: getHeader(headers, 'Date'),
      labels: detail.data.labelIds || [],
    });
  }

  return emails;
}

export async function markAsRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;

  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });

  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: {
      ids: messageIds,
      removeLabelIds: ['UNREAD'],
    },
  });
}
