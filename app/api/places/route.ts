import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export interface LocationOption {
  name: string;        // Real place name, e.g. "Echo Park Lake"
  address: string;     // Full address
  type: string;        // e.g. "park", "parking garage", "diner"
  whyItFits: string;   // One line on why it matches the song's vibe
  mapsUrl: string;     // Direct Google Maps link
}

// ── If Google Places API key is present, use real Places Text Search ─────────
async function fetchRealPlaces(
  locationArea: string,
  emotion: string,
  listeningContext: string,
  placeType: string,
  radius = 20000
): Promise<LocationOption[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  try {
    // Target specific named sub-spots: trailheads, viewpoints, overlooks, named trail access points
    // rather than broad park/forest names. Add "trailhead OR viewpoint OR overlook" to narrow results.
    const specificQuery = `${placeType} trailhead OR viewpoint OR overlook OR access point near ${locationArea}`;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(specificQuery)}&radius=${radius}&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json();

    // Filter out results that are just the broad park/forest name — prefer specific named spots
    const results = (data.results || [])
      .filter((place: any) => {
        const name: string = (place.name || '').toLowerCase();
        // Skip generic regional names (national forest, state park as a whole)
        const isTooGeneric = name.includes('national forest') || name.includes('state park') || name.includes('county park');
        return !isTooGeneric;
      })
      .slice(0, 3);

    // Fall back to any results if filtering removed everything
    const finalResults = results.length > 0 ? results : (data.results || []).slice(0, 3);

    return finalResults.map((place: any) => ({
      name: place.name,
      address: place.formatted_address || place.vicinity || '',
      type: placeType,
      whyItFits: `Specific, driveable spot — matches the ${emotion} vibe`,
      mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
    }));
  } catch {
    return [];
  }
}

// ── Claude fallback: generate realistic place suggestions + Maps search URLs ──
async function generatePlacesWithClaude(
  locationArea: string,
  emotion: string,
  listeningContext: string,
  weatherContext = ''
): Promise<LocationOption[]> {
  const prompt = `You are helping a music artist find a real, specific shooting location for their music content.

ARTIST'S AREA: "${locationArea}"
SONG EMOTION: "${emotion}"
LISTENING CONTEXT: "${listeningContext}" (where someone would listen to this song)${weatherContext ? `\nWEATHER ON SHOOT DAY: ${weatherContext} — factor this into location suitability (e.g. avoid exposed hillsides in extreme heat; overcast is great for shaded urban spots)` : ''}

Generate exactly 3 SPECIFIC, named shooting locations near this area. These must be precise enough that the artist can navigate directly to them — think named trailheads, viewpoints, overlooks, specific parks with a named entrance or trail access point, or a specific street corner/plaza. NOT broad regions like "Angeles National Forest" or "Griffith Park" as a whole.

Rules:
- Give a SPECIFIC named spot (e.g. "Eaton Canyon Falls Trailhead", "Griffith Observatory East Lawn", "Mulholland Scenic Overlook at mile marker 3")
- Include the actual address or enough detail to navigate to it
- Must be accessible (not private property)
- Match the emotional energy of the song and the listening context
- Think cinematic — where would this scene feel authentic and visually compelling?

Return ONLY valid JSON, no markdown:
[
  {
    "name": "Specific location name (e.g. 'Multi-story parking garage')",
    "address": "Specific area in ${locationArea} where this type of place exists",
    "type": "location type",
    "whyItFits": "One sentence on why this matches the ${emotion} vibe",
    "searchQuery": "exact Google Maps search query to find this place near ${locationArea}"
  }
]`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.map((p: any) => ({
      name: p.name,
      address: p.address,
      type: p.type,
      whyItFits: p.whyItFits,
      mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(p.searchQuery || `${p.name} ${locationArea}`)}`,
    }));
  } catch {
    return getFallbackLocations(locationArea, emotion);
  }
}

function getFallbackLocations(locationArea: string, emotion: string): LocationOption[] {
  const area = encodeURIComponent(locationArea);
  return [
    {
      name: 'Multi-story parking garage (top level)',
      address: locationArea,
      type: 'parking structure',
      whyItFits: `Urban, cinematic feel matches the ${emotion} energy`,
      mapsUrl: `https://www.google.com/maps/search/parking+garage+near+${area}`,
    },
    {
      name: '24-hour diner or late-night cafe',
      address: locationArea,
      type: 'diner',
      whyItFits: `Warm artificial lighting, familiar and intimate — fits the ${emotion} vibe`,
      mapsUrl: `https://www.google.com/maps/search/24+hour+diner+near+${area}`,
    },
    {
      name: 'Quiet side street at golden hour',
      address: locationArea,
      type: 'street',
      whyItFits: `Natural light, minimal distractions — lets the ${emotion} feeling carry`,
      mapsUrl: `https://www.google.com/maps/search/quiet+street+${area}`,
    },
  ];
}

// ── Derive best place type from emotion + listening context ───────────────────
function derivePlaceType(emotion: string, listeningContext: string): string {
  const combined = `${emotion} ${listeningContext}`.toLowerCase();
  if (combined.includes('drive') || combined.includes('car')) return 'parking garage OR scenic road';
  if (combined.includes('gym') || combined.includes('workout')) return 'gym OR warehouse';
  if (combined.includes('bedroom') || combined.includes('alone')) return 'quiet indoor space';
  if (combined.includes('party') || combined.includes('night') || combined.includes('club')) return 'rooftop bar OR parking garage at night';
  if (combined.includes('walk') || combined.includes('park') || combined.includes('outside')) return 'park OR trail';
  if (combined.includes('heartbreak') || combined.includes('sad') || combined.includes('cry')) return 'diner OR rainy street';
  if (combined.includes('confident') || combined.includes('power') || combined.includes('hype')) return 'rooftop OR urban street';
  return 'cinematic urban location';
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { locationArea, emotion, listeningContext, radius, weatherContext } = await req.json();

    if (!locationArea) {
      return NextResponse.json({ error: 'locationArea is required' }, { status: 400 });
    }

    const placeType = derivePlaceType(emotion || '', listeningContext || '');
    const searchRadius = typeof radius === 'number' ? radius : 20000;

    // Try real Places API first, fall back to Claude
    let locations = await fetchRealPlaces(locationArea, emotion || '', listeningContext || '', placeType, searchRadius);
    if (locations.length < 2) {
      locations = await generatePlacesWithClaude(locationArea, emotion || '', listeningContext || '', weatherContext || '');
    }

    return NextResponse.json({ locations, placeType });
  } catch (err: any) {
    console.error('[Places API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
