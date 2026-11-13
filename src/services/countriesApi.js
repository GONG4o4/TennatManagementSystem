// Global Countries & Locations API client
// Primary: https://cdn.jsdelivr.net/gh/dr5hn/countries-states-cities-database@master/json/countries.json
// Secondary: https://countriesnow.space/api/v0.1/countries

const COUNTRIES_CDN_URL = 'https://cdn.jsdelivr.net/gh/dr5hn/countries-states-cities-database@master/json/countries.json';
const COUNTRIES_NOW_URL = 'https://countriesnow.space/api/v0.1/countries';

let cachedCountries = null;
const stateCache = new Map();
const cityCache = new Map();

// Fallback list of popular countries in case of network issues
export const POPULAR_COUNTRIES = [
  'Philippines',
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Japan',
  'Singapore',
  'South Korea',
  'Germany',
  'France',
  'United Arab Emirates',
  'Saudi Arabia',
  'New Zealand',
  'China',
  'Hong Kong',
  'Taiwan',
  'Malaysia',
  'Thailand',
  'Indonesia',
  'Vietnam',
  'India',
  'Spain',
  'Italy',
  'Netherlands',
  'Switzerland',
  'Qatar',
  'Kuwait',
];

export async function fetchAllCountries() {
  if (cachedCountries && cachedCountries.length > 0) {
    return cachedCountries;
  }

  try {
    const res = await fetch(COUNTRIES_CDN_URL);
    if (res.ok) {
      const data = await res.json();
      const countryNames = data.map((c) => c.name).filter(Boolean);
      const sorted = Array.from(new Set(countryNames)).sort((a, b) => a.localeCompare(b));
      cachedCountries = sorted;
      return sorted;
    }
  } catch (err) {
    console.warn('CDN countries fetch failed, trying fallback API:', err.message);
  }

  try {
    const res = await fetch(COUNTRIES_NOW_URL);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        const countryNames = json.data.map((c) => c.country).filter(Boolean);
        const sorted = Array.from(new Set(countryNames)).sort((a, b) => a.localeCompare(b));
        cachedCountries = sorted;
        return sorted;
      }
    }
  } catch (err) {
    console.warn('Fallback countries API also failed, using local list:', err.message);
  }

  cachedCountries = POPULAR_COUNTRIES;
  return POPULAR_COUNTRIES;
}

export async function fetchStatesForCountry(countryName) {
  if (!countryName) return [];
  if (stateCache.has(countryName)) {
    return stateCache.get(countryName);
  }

  try {
    const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: countryName }),
    });
    if (res.ok) {
      const json = await res.json();
      const states = (json?.data?.states || []).map((s) => s.name).filter(Boolean);
      states.sort((a, b) => a.localeCompare(b));
      stateCache.set(countryName, states);
      return states;
    }
  } catch (err) {
    console.warn(`Could not fetch states for ${countryName}:`, err.message);
  }

  stateCache.set(countryName, []);
  return [];
}

export async function fetchCitiesForState(countryName, stateName) {
  if (!countryName || !stateName) return [];
  const key = `${countryName}:::${stateName}`;
  if (cityCache.has(key)) {
    return cityCache.get(key);
  }

  try {
    const res = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: countryName, state: stateName }),
    });
    if (res.ok) {
      const json = await res.json();
      const cities = (json?.data || []).filter(Boolean);
      cities.sort((a, b) => a.localeCompare(b));
      cityCache.set(key, cities);
      return cities;
    }
  } catch (err) {
    console.warn(`Could not fetch cities for ${countryName}, ${stateName}:`, err.message);
  }

  cityCache.set(key, []);
  return [];
}
