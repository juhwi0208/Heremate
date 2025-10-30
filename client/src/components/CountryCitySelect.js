//client\src\components\CountryCitySelect.js

import React, { useMemo } from 'react';
import TravelRegions from '../data/TravelRegions';

// 라벨
const labelCountry = (c) => `${c.name.ko} (${c.name.en})`;
const labelCity    = (city) => `${city.ko} (${city.en})`;

// 이름→코드/인덱스 유틸
function findCountryByNameOrCode(countries, needle) {
  if (!needle) return null;
  return countries.find(c =>
    c.code === needle ||
    c.name.ko === needle ||
    c.name.en === needle
  ) || null;
}
function findCityIndexByName(country, cityName) {
  if (!country || !cityName) return -1;
  return country.cities.findIndex(ci => ci.ko === cityName || ci.en === cityName);
}

/**
 * 지원 모드
 * 1) 통합 모드(권장): value={{countryCode, cityKo, cityEn}} / onChange(v)
 * 2) 레거시 모드(PlanEditor): country, region, onChangeCountry(name), onChangeRegion(name)
 * 3) 이름 기반 모드(PlanFilters): value={{countryName, cityName}} / onChange(v)
 */
export default function CountryCitySelect(props) {
  const {
    // 통합 모드
    value,
    onChange,
    // 레거시 모드
    country,
    region,
    onChangeCountry,
    onChangeRegion,
    // 공통
    required = false,
    className = '',
    compact = false,
  } = props;

  const countries = TravelRegions;

  // 현재 선택 해석
  const selected = useMemo(() => {
    // 1) 통합 모드 (코드 기반)
    if (value?.countryCode) {
      const c = countries.find(v => v.code === value.countryCode) || null;
      const idx = c ? c.cities.findIndex(ci => ci.ko === value.cityKo || ci.en === value.cityEn) : -1;
      return { country: c, cityIndex: idx };
    }
    // 2) 이름 기반 모드(PlanFilters)
    if (value?.countryName) {
      const c = findCountryByNameOrCode(countries, value.countryName);
      const idx = findCityIndexByName(c, value.cityName);
      return { country: c, cityIndex: idx };
    }
    // 3) 레거시 모드(PlanEditor)
    if (country || region) {
      const c = findCountryByNameOrCode(countries, country);
      const idx = findCityIndexByName(c, region);
      return { country: c, cityIndex: idx };
    }
    return { country: null, cityIndex: -1 };
  }, [countries, value, country, region]);

  const base = compact ? 'h-9 text-[13px]' : 'h-11 text-[15px]';

  const handleCountry = (e) => {
    const code = e.target.value || '';
    const c = countries.find(v => v.code === code) || null;

    // 레거시 PlanEditor 모드
    if (onChangeCountry) {
      onChangeCountry(c ? c.name.ko : '');
      if (onChangeRegion) onChangeRegion('');
      return;
    }
    // 통합/이름 모드
    if (onChange) {
      if (!c) return onChange(null);
      onChange({
        countryCode: c.code,
        countryName: c.name.ko,
        countryNameEn: c.name.en,
        cityKo: '',
        cityEn: '',
        cityName: '',
      });
    }
  };

  const handleCity = (e) => {
    const idx = Number(e.target.value);
    const c = selected.country;
    if (!c || Number.isNaN(idx) || !c.cities[idx]) {
      // 변경 없음
      if (onChangeRegion) onChangeRegion(region || '');
      if (onChange) onChange(value || null);
      return;
    }
    const city = c.cities[idx];

    // 레거시 PlanEditor 모드
    if (onChangeRegion && onChangeCountry) {
      onChangeRegion(city.ko);
      return;
    }
    // 통합/이름 모드
    if (onChange) {
      onChange({
        countryCode: c.code,
        countryName: c.name.ko,
        countryNameEn: c.name.en,
        cityKo: city.ko,
        cityEn: city.en,
        cityName: city.ko,
      });
    }
  };

  const selectedCode = selected.country?.code || '';
  const selectedCityIndex = selected.country && selected.cityIndex >= 0 ? String(selected.cityIndex) : '';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 나라 */}
      <select
        value={selectedCode}
        onChange={handleCountry}
        required={required}
        className={`${base} px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-600 w-40`}
        aria-label="나라 선택"
      >
        <option value="">{compact ? '나라' : '나라를 선택'}</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>{labelCountry(c)}</option>
        ))}
      </select>

      {/* 지역(도시) */}
      <select
        value={selectedCityIndex}
        onChange={handleCity}
        required={required}
        disabled={!selected.country}
        className={`${base} px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-600 w-48 disabled:bg-slate-100`}
        aria-label="지역 선택"
      >
        <option value="">{!selected.country ? (compact ? '지역' : '먼저 나라 선택') : (compact ? '지역' : '지역을 선택')}</option>
        {selected.country?.cities.map((city, i) => (
          <option key={`${selected.country.code}-${i}`} value={i}>{labelCity(city)}</option>
        ))}
      </select>
    </div>
  );
}

// 문자열 합성 헬퍼(기존 그대로 유지)
export function countryCityToLocation(value) {
  if (!value?.countryCode || !(value.cityKo || value.cityName)) return '';
  const c = TravelRegions.find(v => v.code === value.countryCode);
  const cityKo = value.cityKo || value.cityName || '';
  const cityEn = value.cityEn || '';
  if (!c) return cityKo;
  return `${c.name.ko} ${cityKo} (${c.name.en} ${cityEn})`.trim();
}
