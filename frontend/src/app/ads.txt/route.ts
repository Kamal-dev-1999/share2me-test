export const dynamic = 'force-static';

export async function GET() {
  return new Response('google.com, pub-3981074780272106, DIRECT, f08c47fec0942fa0\n', {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
