import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const PLACES_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return json({ error: 'No URL provided' }, 400);

    const platform = url.includes('tiktok.com') ? 'tiktok'
      : (url.includes('instagram.com') || url.includes('instagr.am')) ? 'instagram'
      : 'unknown';

    let caption = '';
    let thumbnail_url: string | null = null;

    if (platform === 'tiktok') {
      try {
        const oembed = await fetch(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
        ).then((r) => r.json());
        caption = oembed.title ?? '';
        thumbnail_url = oembed.thumbnail_url ?? null;
      } catch { /* silently continue */ }
    } else {
      try {
        const html = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
        }).then((r) => r.text());
        caption =
          html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] ??
          html.match(/<meta name="description" content="([^"]+)"/)?.[1] ??
          '';
        thumbnail_url =
          html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? null;
      } catch { /* silently continue */ }
    }

    if (!caption) {
      return json({ error: 'Could not extract content from this URL. Try pasting the caption directly.' }, 422);
    }

    // Claude extraction
    let extracted: { shop_name: string | null; location: string | null; summary: string | null } = {
      shop_name: null, location: null, summary: null,
    };

    if (ANTHROPIC_KEY) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: `Extract coffee shop info from this social media post. Respond with JSON only, no markdown.

Post text: "${caption.slice(0, 800)}"

Required JSON:
{
  "shop_name": "exact name of the coffee shop/cafe, or null if not a coffee shop post",
  "location": "city or neighborhood mentioned, or null",
  "summary": "one sentence about what was said, starting with the shop name, or null"
}`,
          }],
        }),
      });
      const claudeData = await claudeRes.json();
      try {
        extracted = JSON.parse(claudeData.content?.[0]?.text ?? '{}');
      } catch { /* use defaults */ }
    }

    if (!extracted.shop_name) {
      return json({ error: 'Could not identify a coffee shop in this post.' }, 422);
    }

    // Google Places geocode
    let shop: null | {
      id: string; name: string; address: string; lat: number | null; lng: number | null; photo_url: string | null;
    } = null;

    if (PLACES_KEY) {
      try {
        const query = [extracted.shop_name, extracted.location].filter(Boolean).join(' ');
        const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': PLACES_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos',
          },
          body: JSON.stringify({ textQuery: query, includedType: 'cafe', maxResultCount: 1 }),
        });
        const placesData = await placesRes.json();
        const place = placesData.places?.[0];
        if (place) {
          shop = {
            id: place.id,
            name: place.displayName?.text ?? extracted.shop_name,
            address: place.formattedAddress ?? '',
            lat: place.location?.latitude ?? null,
            lng: place.location?.longitude ?? null,
            photo_url: place.photos?.[0]
              ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=800&key=${PLACES_KEY}`
              : null,
          };
        }
      } catch { /* geocode failed, return without shop coords */ }
    }

    return json({
      platform,
      extracted_name: extracted.shop_name,
      extracted_summary: extracted.summary,
      source_caption: caption.slice(0, 500),
      thumbnail_url,
      shop,
    });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
