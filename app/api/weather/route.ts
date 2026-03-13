import { NextRequest, NextResponse } from 'next/server';

// ── Open-Meteo weather codes → human-readable descriptions ───────────────────
const WMO_CODES: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'icy fog',
  51: 'light drizzle', 53: 'moderate drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'moderate rain', 65: 'heavy rain',
  71: 'light snow', 73: 'moderate snow', 75: 'heavy snow',
  80: 'light showers', 81: 'moderate showers', 82: 'violent showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'heavy thunderstorm',
};

// ── Derive a filmmaker-friendly weather note ─────────────────────────────────
function getFilmNote(code: number, tempMax: number): string {
  if ([95, 96, 99].includes(code)) return 'thunderstorms forecast — strongly consider rescheduling';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'rain forecast — outdoor shooting will be difficult';
  if ([51, 53, 55].includes(code)) return 'light drizzle — equipment may need protection';
  if ([71, 73, 75].includes(code)) return 'snow forecast — check location accessibility';
  if (code === 3) return 'overcast — flat diffused light, great for even skin tones';
  if (code === 2) return 'partly cloudy — natural diffuser effect, intermittent shadows';
  if (tempMax >= 38) return 'extreme heat — schedule golden hour or early morning to avoid midday';
  if (tempMax >= 32) return 'hot day — plan for shade; golden hour light will look great';
  if (tempMax <= 5) return 'cold day — keep takes short; breath vapor can add atmosphere';
  if ([0, 1].includes(code)) return 'clear sky — strong directional light; best at golden hour or early morning';
  return 'good conditions for filming';
}

function isBadWeather(code: number): boolean {
  return [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
}

// ── Geocode location area using Open-Meteo's free geocoding API ──────────────
async function geocode(locationArea: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationArea)}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;
    return { lat: result.latitude, lng: result.longitude };
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { locationArea, shootDate } = await req.json();

    if (!locationArea || !shootDate) {
      return NextResponse.json({ error: 'locationArea and shootDate are required' }, { status: 400 });
    }

    const coords = await geocode(locationArea);
    if (!coords) {
      return NextResponse.json({ weatherSummary: null, isBad: false, filmNote: 'Could not determine location' });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset&timezone=auto&start_date=${shootDate}&end_date=${shootDate}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();

    const code: number = data.daily?.weathercode?.[0] ?? 0;
    const tempMax: number = data.daily?.temperature_2m_max?.[0] ?? 20;
    const tempMin: number = data.daily?.temperature_2m_min?.[0] ?? 10;
    const precipitation: number = data.daily?.precipitation_sum?.[0] ?? 0;
    const sunrise: string = data.daily?.sunrise?.[0] ?? '';
    const sunset: string = data.daily?.sunset?.[0] ?? '';

    const condition = WMO_CODES[code] || 'variable conditions';
    const filmNote = getFilmNote(code, tempMax);
    const bad = isBadWeather(code);

    // Format sunrise/sunset as readable times
    const fmtTime = (iso: string) => {
      if (!iso) return '';
      try {
        return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      } catch { return iso; }
    };

    const weatherSummary = `${condition}, ${Math.round(tempMax)}°C high / ${Math.round(tempMin)}°C low${precipitation > 0 ? `, ${precipitation}mm rain` : ''}${sunrise ? `. Sunrise ${fmtTime(sunrise)}, sunset ${fmtTime(sunset)}` : ''}`;

    return NextResponse.json({
      weatherSummary,
      condition,
      tempMax,
      tempMin,
      precipitation,
      sunrise: fmtTime(sunrise),
      sunset: fmtTime(sunset),
      filmNote,
      isBad: bad,
      weatherCode: code,
    });
  } catch (err: any) {
    console.error('[Weather API] Error:', err);
    return NextResponse.json({ weatherSummary: null, isBad: false, filmNote: 'Weather unavailable' });
  }
}
