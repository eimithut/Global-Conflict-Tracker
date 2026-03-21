// Cloudflare Pages Function: Server-side proxy for aircraft data
// This runs on Cloudflare's edge network, bypassing all CORS restrictions.
// Route: /api/aircraft

export const onRequest: PagesFunction = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Primary: ADSB.lol (free, no auth needed)
    let data = null;

    try {
      const res = await fetch('https://api.adsb.lol/v2/all', {
        headers: { 'User-Agent': 'Global-Conflict-Tracker/1.0' },
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      console.error('ADSB.lol failed:', e);
    }

    // Fallback: OpenSky (no auth, best effort)
    if (!data || !data.ac) {
      try {
        const res = await fetch('https://opensky-network.org/api/states/all');
        if (res.ok) {
          const opensky = await res.json() as any;
          if (opensky && opensky.states) {
            // Convert OpenSky format to ADSB.lol-compatible format
            data = {
              ac: opensky.states
                .filter((s: any[]) => s[5] !== null && s[6] !== null)
                .map((s: any[]) => ({
                  flight: (s[1] || '').trim(),
                  r: '',
                  ownOp: s[2] || 'Unknown',
                  lat: s[6],
                  lon: s[5],
                  gs: ((s[9] || 0) / 1.852), // m/s to knots (app converts back)
                  track: s[10] || 0,
                  category: '',
                })),
              total: opensky.states.length,
            };
          }
        }
      } catch (e) {
        console.error('OpenSky fallback failed:', e);
      }
    }

    if (data) {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'All upstream APIs failed' }), {
      status: 502,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};
