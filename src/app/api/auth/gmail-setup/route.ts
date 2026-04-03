import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

/**
 * Gmail OAuth2 Setup Helper
 *
 * ONE-TIME USE ONLY — Do NOT deploy this route to production.
 * Use it locally to obtain a refresh token, then remove or disable it.
 *
 * Step 1: Visit http://localhost:3000/api/auth/gmail-setup to start OAuth flow
 * Step 2: Authorize with your Google account
 * Step 3: Copy the refresh token displayed on screen into your .env.local
 */
export async function GET(request: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3000/api/auth/gmail-setup'
  );

  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // If no code, redirect to Google OAuth consent screen
  if (!code) {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent to always get refresh token
    });

    console.log('\n========================================');
    console.log('Gmail OAuth Setup');
    console.log('========================================');
    console.log('Redirecting to Google OAuth consent screen...');
    console.log('After authorizing, you will be redirected back here.');
    console.log('========================================\n');

    return NextResponse.redirect(authUrl);
  }

  // Exchange code for tokens
  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log('\n========================================');
    console.log('SUCCESS! Tokens received.');
    console.log('========================================');
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('========================================');
    console.log('Copy the refresh token above into your .env.local file');
    console.log('as GMAIL_REFRESH_TOKEN=<token>');
    console.log('========================================\n');

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Gmail Setup Complete</title></head>
        <body style="font-family: monospace; max-width: 600px; margin: 40px auto; padding: 20px;">
          <h1>Gmail OAuth Setup Complete</h1>
          <p style="color: green; font-weight: bold;">Tokens received successfully!</p>

          <h2>Your Refresh Token:</h2>
          <textarea
            readonly
            style="width: 100%; height: 100px; font-family: monospace; font-size: 12px; padding: 10px;"
            onclick="this.select()"
          >${tokens.refresh_token || 'No refresh token returned — you may have already authorized this app. Try revoking access at https://myaccount.google.com/permissions and retrying.'}</textarea>

          <h2>Next Steps:</h2>
          <ol>
            <li>Copy the refresh token above</li>
            <li>Paste it into your <code>.env.local</code> file as <code>GMAIL_REFRESH_TOKEN=&lt;token&gt;</code></li>
            <li>Restart your dev server</li>
            <li><strong>Remove or disable this auth route before deploying to production</strong></li>
          </ol>

          ${tokens.access_token ? `<p><small>Access Token (for debugging): ${tokens.access_token.substring(0, 20)}...</small></p>` : ''}
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Token exchange failed:', error);
    return NextResponse.json(
      { error: 'Failed to exchange code for tokens', details: String(error) },
      { status: 500 }
    );
  }
}
