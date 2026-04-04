# Email Digest Agent

A Vercel-hosted agent that runs twice daily, reads your Gmail inbox, categorizes and prioritizes emails using Claude, marks them as read, and posts a formatted digest to Slack.

## How It Works

```
External Cron (cron-job.org, twice daily at 9am ET / 8pm ET)
  -> GET /api/digest (with Authorization header)
    -> Fetch unread Gmail messages
    -> Send batch to Claude for categorization + summarization
    -> Mark all fetched emails as READ
    -> Post formatted digest to Slack
```

Emails are categorized into 4 tiers:
1. **Job Search & Recruiting** (highest priority)
2. **Family & Important Personal**
3. **Work (PwC / Professional)**
4. **Marketing & Low Priority** (summarized in one line)

## Setup

### 1. Google Cloud Project + OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Gmail API**: APIs & Services > Library > search "Gmail API" > Enable
4. Create OAuth credentials:
   - APIs & Services > Credentials > Create Credentials > OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: add `http://localhost:3000/api/auth/gmail-setup`
   - Copy the **Client ID** and **Client Secret**

### 2. Get Gmail Refresh Token

1. Clone this repo and install dependencies:
   ```bash
   git clone https://github.com/mhealy1027/email-digest-agent.git
   cd email-digest-agent
   npm install
   ```

2. Fill in `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in `.env.local`

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Visit `http://localhost:3000/api/auth/gmail-setup` in your browser

5. Authorize with your Google account. You'll be redirected back with your refresh token displayed on screen.

6. Copy the refresh token into `.env.local` as `GMAIL_REFRESH_TOKEN`

> **Note:** The `/api/auth/gmail-setup` route is for one-time local use only. Do not deploy it to production.

### 3. Slack Incoming Webhook

1. Go to [Slack API: Apps](https://api.slack.com/apps)
2. Create a new app > From scratch
3. Go to **Incoming Webhooks** > Activate
4. Click **Add New Webhook to Workspace** > Select your channel
5. Copy the webhook URL into `.env.local` as `SLACK_WEBHOOK_URL`

### 4. Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Copy it into `.env.local` as `ANTHROPIC_API_KEY`

### 5. Cron Secret

Generate a random secret for securing the cron endpoint:

```bash
openssl rand -hex 32
```

Copy it into `.env.local` as `CRON_SECRET`.

### 6. Fill in .env.local

Your completed `.env.local` should look like:

```env
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_USER_EMAIL=your-email@gmail.com

ANTHROPIC_API_KEY=sk-ant-...

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...

CRON_SECRET=your-random-hex-secret
```

### 7. Deploy to Vercel

1. Push to GitHub (already done if you cloned this repo)
2. Import the project on [Vercel](https://vercel.com/new)
3. Add all environment variables from `.env.local` to Vercel's Environment Variables settings
4. Deploy:
   ```bash
   npx vercel --prod
   ```

### 8. Set Up External Cron Scheduler

Vercel's free tier only allows one cron job per day, so we use [cron-job.org](https://cron-job.org/) as an external scheduler to hit the endpoint twice daily.

1. Create a free account at [cron-job.org](https://cron-job.org/)
2. Create two cron jobs (or one with the expression `0 0,13 * * *` in UTC):
   - **Morning digest**: `0 13 * * *` (1pm UTC = 9am ET)
   - **Evening digest**: `0 0 * * *` (12am UTC = 8pm ET)
3. Set the URL to `https://your-app.vercel.app/api/digest`
4. Set the request method to **GET**
5. Add a custom header: `Authorization: Bearer YOUR_CRON_SECRET`

## Testing Locally

Start the dev server:

```bash
npm run dev
```

Trigger the digest manually:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/digest
```

## Manual Trigger in Production

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/digest
```

This works anytime. The endpoint responds to any authenticated GET request, not just cron triggers.

## Adjusting the Schedule

The schedule is managed via [cron-job.org](https://cron-job.org/), not `vercel.json`. Log in to cron-job.org to adjust timing. The current schedule is twice daily at 9am ET and 8pm ET (`0 0,13 * * *` UTC).

See [crontab.guru](https://crontab.guru/) for help building cron expressions.

## File Structure

```
src/
├── app/
│   └── api/
│       ├── digest/route.ts           # Main cron endpoint
│       └── auth/gmail-setup/route.ts # One-time OAuth helper
├── lib/
│   ├── gmail.ts                      # Gmail API: fetch + mark as read
│   ├── categorize.ts                 # Claude API: categorize + summarize
│   ├── slack.ts                      # Slack webhook poster
│   └── types.ts                      # Shared TypeScript types
vercel.json                           # Vercel project config
.env.local                            # Secrets (not committed)
```
