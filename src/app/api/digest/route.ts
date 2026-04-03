import { NextRequest, NextResponse } from 'next/server';
import { fetchUnreadEmails, markAsRead } from '@/lib/gmail';
import { categorizeEmails } from '@/lib/categorize';
import { postToSlack } from '@/lib/slack';

export async function GET(request: NextRequest) {
  // Verify authorization — Vercel crons send this automatically
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Step 1: Fetch unread emails from last 6 hours
    console.log('Fetching unread emails...');
    let emails;
    try {
      emails = await fetchUnreadEmails();
    } catch (error) {
      console.error('Gmail fetch failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch emails from Gmail' },
        { status: 500 }
      );
    }

    console.log(`Found ${emails.length} unread emails`);

    // Step 2 & 3: Categorize with Claude (or handle empty inbox)
    let digest;
    if (emails.length === 0) {
      digest = null;
    } else {
      try {
        digest = await categorizeEmails(emails);
      } catch (error) {
        console.error('Claude categorization failed, posting raw subjects:', error);
        // Fallback: post raw email subjects to Slack
        const fallbackText = emails
          .map((e) => `• ${e.from}: ${e.subject}`)
          .join('\n');
        try {
          await fetch(process.env.SLACK_WEBHOOK_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `📬 *Email Digest (categorization failed)*\n\n${emails.length} new emails:\n${fallbackText}`,
            }),
          });
        } catch (slackError) {
          console.error('Slack fallback also failed:', slackError);
        }
        // Still mark as read even if categorization failed
        digest = null;
      }
    }

    // Step 4: Mark all fetched emails as read
    if (emails.length > 0) {
      try {
        const messageIds = emails.map((e) => e.messageId);
        await markAsRead(messageIds);
        console.log(`Marked ${messageIds.length} emails as read`);
      } catch (error) {
        console.error('Failed to mark emails as read:', error);
        // Continue to post to Slack even if marking fails
      }
    }

    // Step 5: Post digest to Slack
    try {
      if (digest) {
        await postToSlack(digest);
      } else if (emails.length === 0) {
        await postToSlack(null);
      }
      // If digest is null due to Claude failure, we already posted fallback above
    } catch (error) {
      console.error('Slack post failed:', error);
      return NextResponse.json(
        {
          error: 'Failed to post to Slack',
          emailsProcessed: emails.length,
          markedAsRead: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailsProcessed: emails.length,
      markedAsRead: emails.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in digest route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
