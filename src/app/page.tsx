export default function Home() {
  return (
    <main style={{ fontFamily: 'monospace', maxWidth: 600, margin: '40px auto', padding: 20 }}>
      <h1>Email Digest Agent</h1>
      <p>This app runs as a Vercel cron job every 6 hours.</p>
      <p>
        API endpoint: <code>/api/digest</code> (requires Authorization header)
      </p>
    </main>
  );
}
