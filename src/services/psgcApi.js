// Helper service to interact with the Philippine Standard Geographic Code (PSGC) API
// API Source: https://psgc.gitlab.io/api/ (official PSA-based geographic data)

const BASE_URL = 'https://psgc.gitlab.io/api';
const cache = new Map();

async function fetchJson(endpoint) {
  if (cache.has(endpoint)) {
    return cache.get(endpoint);
  }
  const response = await fetch(`${BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Failed to load geographic data from ${endpoint}`);
  }
  const data = await response.json();
  cache.set(endpoint, data);
  return data;
}

export async function getRegions() {
  const regions = await fetchJson('/regions.json');
  return regions.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProvincesByRegion(regionCode) {
  if (!regionCode) return [];
  const provinces = await fetchJson(`/regions/${regionCode}/provinces.json`);
  return provinces.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCitiesByRegionOrProvince({ regionCode, provinceCode }) {
  if (provinceCode) {
    const list = await fetchJson(`/provinces/${provinceCode}/cities-municipalities.json`);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (regionCode) {
    const list = await fetchJson(`/regions/${regionCode}/cities-municipalities.json`);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [];
}

export async function getBarangaysByCity(cityCode) {
  if (!cityCode) return [];
  const list = await fetchJson(`/cities-municipalities/${cityCode}/barangays.json`);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllCitiesMunicipalities() {
  const list = await fetchJson('/cities-municipalities.json');
  return list.sort((a, b) => a.name.localeCompare(b.name));
}
