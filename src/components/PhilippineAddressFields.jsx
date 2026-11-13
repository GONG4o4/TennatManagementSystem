import { useEffect, useState } from 'react';
import {
  getRegions,
  getProvincesByRegion,
  getCitiesByRegionOrProvince,
  getBarangaysByCity,
} from '../services/psgcApi';
import { fetchAllCountries, fetchStatesForCountry, fetchCitiesForState } from '../services/countriesApi';
import { PHILIPPINES_LOCATIONS } from '../data/philippineLocations';

// Helper to look up zip code from city name for PH
function guessZipCode(cityName) {
  if (!cityName) return '';
  for (const [key, val] of Object.entries(PHILIPPINES_LOCATIONS)) {
    if (cityName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(cityName.toLowerCase())) {
      return val.zip;
    }
  }
  return '';
}

export default function PhilippineAddressFields({
  values = {},
  onChange,
  required = false,
  idPrefix = 'addr',
}) {
  const currentCountry = values.country || 'Philippines';
  const isPhilippines = currentCountry === 'Philippines';

  // Countries
  const [countries, setCountries] = useState(['Philippines']);
  const [loadingCountries, setLoadingCountries] = useState(false);

  // Philippines PSGC states
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [selectedRegionCode, setSelectedRegionCode] = useState('');
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedCityCode, setSelectedCityCode] = useState('');

  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // International states/cities
  const [intlStates, setIntlStates] = useState([]);
  const [intlCities, setIntlCities] = useState([]);
  const [loadingIntlStates, setLoadingIntlStates] = useState(false);
  const [loadingIntlCities, setLoadingIntlCities] = useState(false);

  // 1. Fetch countries on mount from the Web API
  useEffect(() => {
    let active = true;
    setLoadingCountries(true);
    fetchAllCountries()
      .then((list) => {
        if (active) {
          // Keep Philippines at the top for convenience
          const filtered = list.filter((c) => c !== 'Philippines');
          setCountries(['Philippines', ...filtered]);
        }
      })
      .catch((err) => console.error('Failed to load countries from API:', err))
      .finally(() => {
        if (active) setLoadingCountries(false);
      });
    return () => { active = false; };
  }, []);

  // 2. Fetch PSGC regions when country is Philippines
  useEffect(() => {
    if (!isPhilippines) return;
    let active = true;
    setLoadingRegions(true);
    getRegions()
      .then((data) => {
        if (active) setRegions(data);
      })
      .catch((err) => console.error('Failed to load regions from PSGC API:', err))
      .finally(() => {
        if (active) setLoadingRegions(false);
      });
    return () => { active = false; };
  }, [isPhilippines]);

  // 3. Fetch states when international country is selected
  useEffect(() => {
    if (isPhilippines || !currentCountry) return;
    let active = true;
    setLoadingIntlStates(true);
    setIntlStates([]);
    setIntlCities([]);

    fetchStatesForCountry(currentCountry)
      .then((states) => {
        if (active) setIntlStates(states);
      })
      .catch((err) => console.error('Failed to load international states:', err))
      .finally(() => {
        if (active) setLoadingIntlStates(false);
      });
    return () => { active = false; };
  }, [currentCountry, isPhilippines]);

  // Handler for country change
  const handleCountryChange = (e) => {
    const newCountry = e.target.value;
    setSelectedRegionCode('');
    setSelectedProvinceCode('');
    setSelectedCityCode('');
    setProvinces([]);
    setCities([]);
    setBarangays([]);
    setIntlStates([]);
    setIntlCities([]);

    onChange({
      ...values,
      country: newCountry,
      regionCode: '',
      provinceCode: '',
      cityCode: '',
      city: '',
      barangay: '',
    });
  };

  // PH Region change
  const handleRegionChange = async (e) => {
    const regionCode = e.target.value;
    setSelectedRegionCode(regionCode);
    setSelectedProvinceCode('');
    setSelectedCityCode('');
    setProvinces([]);
    setCities([]);
    setBarangays([]);

    onChange({
      ...values,
      regionCode,
      provinceCode: '',
      cityCode: '',
      city: '',
      barangay: '',
    });

    if (!regionCode) return;

    setLoadingProvinces(true);
    setLoadingCities(true);
    try {
      const provs = await getProvincesByRegion(regionCode);
      setProvinces(provs);
      if (provs.length === 0) {
        // e.g. NCR
        const regionCities = await getCitiesByRegionOrProvince({ regionCode });
        setCities(regionCities);
      }
    } catch (err) {
      console.error('Error fetching provinces/cities for region:', err);
    } finally {
      setLoadingProvinces(false);
      setLoadingCities(false);
    }
  };

  // PH Province change
  const handleProvinceChange = async (e) => {
    const provinceCode = e.target.value;
    setSelectedProvinceCode(provinceCode);
    setSelectedCityCode('');
    setCities([]);
    setBarangays([]);

    onChange({
      ...values,
      provinceCode,
      cityCode: '',
      city: '',
      barangay: '',
    });

    if (!provinceCode) return;

    setLoadingCities(true);
    try {
      const provCities = await getCitiesByRegionOrProvince({ provinceCode });
      setCities(provCities);
    } catch (err) {
      console.error('Error loading cities for province:', err);
    } finally {
      setLoadingCities(false);
    }
  };

  // PH City change
  const handleCityChange = async (e) => {
    const cityCode = e.target.value;
    const cityObj = cities.find((c) => String(c.code) === String(cityCode));
    const cityName = cityObj?.name || '';
    setSelectedCityCode(cityCode);
    setBarangays([]);

    const guessedZip = guessZipCode(cityName) || values.zipCode || values.zip_code || '';

    onChange({
      ...values,
      cityCode,
      city: cityName,
      zipCode: guessedZip,
      zip_code: guessedZip,
      barangay: '',
    });

    if (!cityCode) return;

    setLoadingBarangays(true);
    try {
      const brgys = await getBarangaysByCity(cityCode);
      setBarangays(brgys);
    } catch (err) {
      console.error('Error loading barangays for city:', err);
    } finally {
      setLoadingBarangays(false);
    }
  };

  // International state change
  const handleIntlStateChange = async (e) => {
    const stateName = e.target.value;
    setIntlCities([]);

    onChange({
      ...values,
      barangay: stateName, // store province/state in barangay/state field
      city: '',
    });

    if (!stateName) return;

    setLoadingIntlCities(true);
    try {
      const fetchedCities = await fetchCitiesForState(currentCountry, stateName);
      setIntlCities(fetchedCities);
    } catch (err) {
      console.error('Error loading cities for state:', err);
    } finally {
      setLoadingIntlCities(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-street`} className="label">
            Street / House / Unit number {required && <span className="text-rose-600">*</span>}
          </label>
          <input
            id={`${idPrefix}-street`}
            name="street"
            required={required}
            value={values.street || ''}
            onChange={(e) => onChange({ ...values, street: e.target.value })}
            placeholder="e.g. 123 Rizal Ave, Apt 4B"
            className="field"
            autoComplete="address-line1"
          />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-country`} className="label">
            Country {required && <span className="text-rose-600">*</span>}
          </label>
          <select
            id={`${idPrefix}-country`}
            name="country"
            required={required}
            value={currentCountry}
            onChange={handleCountryChange}
            disabled={loadingCountries}
            className="field"
          >
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* If Philippines: PSGC Region -> Province -> City -> Barangay */}
        {isPhilippines ? (
          <>
            <div>
              <label htmlFor={`${idPrefix}-region`} className="label">
                Region {required && <span className="text-rose-600">*</span>}
              </label>
              <select
                id={`${idPrefix}-region`}
                name="regionCode"
                required={required}
                value={selectedRegionCode || values.regionCode || ''}
                onChange={handleRegionChange}
                className="field"
                disabled={loadingRegions}
              >
                <option value="">{loadingRegions ? 'Loading regions…' : 'Select region…'}</option>
                {regions.map((reg) => (
                  <option key={reg.code} value={reg.code}>
                    {reg.name} ({reg.regionName})
                  </option>
                ))}
              </select>
            </div>

            {provinces.length > 0 && (
              <div>
                <label htmlFor={`${idPrefix}-province`} className="label">
                  Province {required && <span className="text-rose-600">*</span>}
                </label>
                <select
                  id={`${idPrefix}-province`}
                  name="provinceCode"
                  required={required}
                  value={selectedProvinceCode || values.provinceCode || ''}
                  onChange={handleProvinceChange}
                  disabled={loadingProvinces}
                  className="field"
                >
                  <option value="">{loadingProvinces ? 'Loading provinces…' : 'Select province…'}</option>
                  {provinces.map((prov) => (
                    <option key={prov.code} value={prov.code}>
                      {prov.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor={`${idPrefix}-city`} className="label">
                City / Municipality {required && <span className="text-rose-600">*</span>}
              </label>
              <select
                id={`${idPrefix}-city`}
                name="cityCode"
                required={required}
                value={selectedCityCode || values.cityCode || ''}
                onChange={handleCityChange}
                disabled={(!selectedRegionCode && !selectedProvinceCode) || loadingCities}
                className="field disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingCities
                    ? 'Loading cities…'
                    : selectedRegionCode || selectedProvinceCode
                    ? 'Select city / municipality…'
                    : 'Select region/province first…'}
                </option>
                {cities.map((city) => (
                  <option key={city.code} value={city.code}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${idPrefix}-barangay`} className="label">
                Barangay {required && <span className="text-rose-600">*</span>}
              </label>
              <select
                id={`${idPrefix}-barangay`}
                name="barangay"
                required={required}
                value={values.barangay || ''}
                onChange={(e) => onChange({ ...values, barangay: e.target.value })}
                disabled={!selectedCityCode || loadingBarangays}
                className="field disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingBarangays
                    ? 'Loading barangays…'
                    : selectedCityCode
                    ? 'Select barangay…'
                    : 'Select city first…'}
                </option>
                {barangays.map((b) => (
                  <option key={b.code} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          /* International Country Selection: State / Province & City */
          <>
            <div>
              <label htmlFor={`${idPrefix}-state`} className="label">
                State / Province / Region {required && <span className="text-rose-600">*</span>}
              </label>
              {intlStates.length > 0 ? (
                <select
                  id={`${idPrefix}-state`}
                  name="barangay"
                  required={required}
                  value={values.barangay || ''}
                  onChange={handleIntlStateChange}
                  disabled={loadingIntlStates}
                  className="field"
                >
                  <option value="">{loadingIntlStates ? 'Loading states…' : 'Select state / province…'}</option>
                  {intlStates.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${idPrefix}-state`}
                  name="barangay"
                  required={required}
                  value={values.barangay || ''}
                  onChange={(e) => onChange({ ...values, barangay: e.target.value })}
                  placeholder="e.g. California, Ontario, etc."
                  className="field"
                />
              )}
            </div>

            <div>
              <label htmlFor={`${idPrefix}-city`} className="label">
                City / Municipality {required && <span className="text-rose-600">*</span>}
              </label>
              {intlCities.length > 0 ? (
                <select
                  id={`${idPrefix}-city`}
                  name="city"
                  required={required}
                  value={values.city || ''}
                  onChange={(e) => onChange({ ...values, city: e.target.value })}
                  disabled={loadingIntlCities}
                  className="field"
                >
                  <option value="">{loadingIntlCities ? 'Loading cities…' : 'Select city…'}</option>
                  {intlCities.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${idPrefix}-city`}
                  name="city"
                  required={required}
                  value={values.city || ''}
                  onChange={(e) => onChange({ ...values, city: e.target.value })}
                  placeholder="e.g. Los Angeles, Toronto, etc."
                  className="field"
                  autoComplete="address-level2"
                />
              )}
            </div>
          </>
        )}

        <div>
          <label htmlFor={`${idPrefix}-zip`} className="label">
            Postal / ZIP code {required && <span className="text-rose-600">*</span>}
          </label>
          <input
            id={`${idPrefix}-zip`}
            name="zipCode"
            required={required}
            value={values.zipCode || values.zip_code || ''}
            onChange={(e) => onChange({ ...values, zipCode: e.target.value, zip_code: e.target.value })}
            placeholder={isPhilippines ? 'e.g. 1200' : 'e.g. 90210'}
            className="field"
            autoComplete="postal-code"
          />
        </div>
      </div>
    </div>
  );
}
