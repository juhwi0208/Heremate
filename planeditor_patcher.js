/**
 * planeditor_patcher.js (FIXED)
 * Safe, surgical patcher for HereMate PlanEditor.js
 * - Fixes previous RegExp bug on ensureMinHeightOnMapDiv
 * - Uses DOM-ish string scanning instead of fragile regex for the map <div>
 *
 * Usage:
 *   node planeditor_patcher.js path/to/PlanEditor.js
 */
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node planeditor_patcher.js <PlanEditor.js path>');
  process.exit(1);
}
const filePath = path.resolve(process.argv[2]);
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}
let src = fs.readFileSync(filePath, 'utf8');
const original = src;

function onceInsert(afterRegex, snippet, tag) {
  if (src.includes(snippet.trim())) {
    console.log(`[skip] ${tag} already present.`);
    return;
  }
  const m = src.match(afterRegex);
  if (!m) {
    console.warn(`[warn] Could not find anchor for ${tag}. Skipping insert.`);
    return;
  }
  const idx = m.index + m[0].length;
  src = src.slice(0, idx) + "\n" + snippet + "\n" + src.slice(idx);
  console.log(`[ok] Inserted ${tag}.`);
}

function ensureInMapOptions() {
  const mapCtorRegex = /new\\s+google\\.maps\\.Map\\s*\\(\\s*([\\s\\S]{0,200}?mapRef\\s*\\.\\s*current[\\s\\S]*?),\\s*\\{([\\s\\S]*?)\\}\\s*\\)/m;
  const m = src.match(mapCtorRegex);
  if (!m) {
    console.warn('[warn] Map constructor not found. Skipping map options enforcement.');
    return;
  }
  let options = m[2];
  const addOpt = (k, v) => {
    const r = new RegExp(`\\b${k}\\s*:`);
    if (!r.test(options)) {
      options = options.replace('{', `{\n  ${k}: ${v},`);
    }
  };
  addOpt('streetViewControl', 'false');
  addOpt('mapTypeControl', 'false');
  addOpt('fullscreenControl', 'true');
  src = src.replace(m[0], m[0].replace(m[2], options));
  console.log('[ok] Ensured map options (streetViewControl, mapTypeControl, fullscreenControl).');
}

function ensureMinHeightOnMapDiv() {
  // Find 'ref={mapRef}' and then modify the opening <div ...> tag that contains it
  const refIdx = src.indexOf('ref={mapRef}');
  if (refIdx === -1) {
    console.warn('[warn] <div ref={mapRef} .../> not found. Skipping minHeight enforcement.');
    return;
  }
  // Locate the start of the containing <div ...>
  const startDiv = src.lastIndexOf('<div', refIdx);
  if (startDiv === -1) {
    console.warn('[warn] Could not find <div start before ref={mapRef}.');
    return;
  }
  // Locate the end of the opening tag '>' after ref
  const endTag = src.indexOf('>', refIdx);
  if (endTag === -1) {
    console.warn('[warn] Could not find end of map <div> tag.');
    return;
  }
  const openingTag = src.slice(startDiv, endTag + 1); // includes '>'
  // If openingTag already has style with minHeight: 480, do nothing
  if (/style=\\{\\{[^}]*minHeight\\s*:\\s*480[^}]*\\}\\}/.test(openingTag)) {
    console.log('[skip] minHeight already present on map div.');
    return;
  }
  let newOpeningTag;
  const styleMatch = openingTag.match(/style=\\{\\{([\\s\\S]*?)\\}\\}/);
  if (styleMatch) {
    // Prepend minHeight into existing style object
    newOpeningTag = openingTag.replace(/style=\\{\\{/, 'style={{ minHeight: 480, ');
  } else {
    // Insert a new style attribute before the closing of the opening tag
    // Ensure we keep className and others intact
    newOpeningTag = openingTag.replace(/>$/, ' style={{ minHeight: 480 }}>'); 
  }
  // Replace in src
  src = src.slice(0, startDiv) + newOpeningTag + src.slice(endTag + 1);
  console.log('[ok] Ensured minHeight:480 on <div ref={mapRef} />.');
}

const helpersBlock = `
// === PATCH: helpers & constants (UI 영향 없음) ===
const DAY_MS = 24 * 60 * 60 * 1000;
const genId = () => (crypto?.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2));

const hhmmToNum = (s) => (s && s.length === 5 ? parseInt(s.slice(0,2)+s.slice(3,5), 10) : null);
const hhmm4ToDisp = (s) => (s && s.length === 4 ? \`\${s.slice(0,2)}:\${s.slice(2,4)}\` : s || '');

function isTimeWithinOpeningHours(opening_hours, dateISO, hhmm) {
  if (!opening_hours?.periods || !hhmm) return true; // 정보 없으면 경고 안띄움
  const weekday = new Date(dateISO).getDay(); // 0~6
  const t = hhmmToNum(hhmm);
  if (t == null) return true;
  return opening_hours.periods.some(p => {
    if (!p.open || !p.close) return false;
    const od = p.open.day, cd = p.close.day;
    const ot = parseInt(p.open.time, 10), ct = parseInt(p.close.time, 10);
    if (od === cd) return (od === weekday) && t >= ot && t < ct;
    if (od === weekday && t >= ot) return true;      // overnight case (open today → close tomorrow)
    if (cd === weekday && t <  ct) return true;      // overnight case (open yesterday → close today)
    return false;
  });
}

function hoursSummary(opening_hours, dateISO) {
  if (!opening_hours?.periods?.length) return '영업시간 정보 없음';
  const weekday = new Date(dateISO).getDay();
  const todays = opening_hours.periods.filter(p => {
    if (!p.open || !p.close) return false;
    return p.open.day === weekday || p.close.day === weekday;
  });
  if (!todays.length) return '오늘 휴무';
  const parts = todays.map(p => \`\${hhmm4ToDisp(p.open?.time)}–\${hhmm4ToDisp(p.close?.time)}\${p.open?.day!==p.close?.day?' (익일)':''}\`);
  return \`오늘 영업: \${parts.join(', ')}\`;
}
`.trim();

const hookBlock = `
// === PATCH: useMapSearch (독립 훅, UI 변화 없음) ===
function useMapSearch(mapObjRef) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [cands, setCands] = React.useState([]); // {placeId, name, address, photoUrl, geometry, opening_hours}
  const sessionTokenRef = React.useRef(null);
  const panelRef = React.useRef(null);
  const boxRef = React.useRef(null);

  const prefetchDetails = React.useCallback(async (placeIds) => {
    const g = window.google;
    if (!g?.maps) return [];
    const svc = new g.maps.places.PlacesService(mapObjRef.current);
    const fields = ['place_id','name','formatted_address','geometry','photos','opening_hours'];
    const runOne = (pid) => new Promise(res => {
      svc.getDetails({ placeId: pid, fields, language: 'ko', region: 'KR' }, (d, st) => {
        if (st === g.maps.places.PlacesServiceStatus.OK && d) {
          res({
            placeId: d.place_id,
            name: d.name,
            address: d.formatted_address,
            geometry: d.geometry?.location ? { lat: d.geometry.location.lat(), lng: d.geometry.location.lng() } : null,
            photoUrl: d.photos?.[0]?.getUrl?.({ maxWidth: 320, maxHeight: 180 }) ?? null,
            opening_hours: d.opening_hours ?? null,
          });
        } else res(null);
      });
    });
    const out = [];
    for (const id of placeIds) { const r = await runOne(id); if (r) out.push(r); }
    return out;
  }, [mapObjRef]);

  const runSearch = React.useCallback((input) => {
    const g = window.google;
    if (!g?.maps) return;
    if (!input.trim()) { setCands([]); setOpen(false); return; }
    setLoading(true);
    sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
    const ac = new g.maps.places.AutocompleteService();

    const fallbackText = () => {
      const ts = new g.maps.places.TextSearchService();
      ts.textSearch({ query: input, region: 'KR', language: 'ko' }, (list, st) => {
        if (st === g.maps.places.PlacesServiceStatus.OK && Array.isArray(list)) {
          const top = list.slice(0, 8);
          prefetchDetails(top.map(x => x.place_id)).then(dets => {
            setCands(dets); setOpen(true); setLoading(false);
          });
        } else { setCands([]); setOpen(false); setLoading(false); }
      });
    };

    ac.getPlacePredictions(
      { input, language: 'ko', region: 'KR', sessionToken: sessionTokenRef.current },
      (preds, st) => {
        if (st === g.maps.places.PlacesServiceStatus.OK && Array.isArray(preds) && preds.length) {
          const top8 = preds.slice(0, 8);
          prefetchDetails(top8.map(p => p.place_id)).then(dets => {
            setCands(dets); setOpen(true); setLoading(false);
          });
        } else {
          fallbackText();
        }
      }
    );
  }, [prefetchDetails]);

  const onChange = (v) => {
    setQ(v);
    if (!v.trim()) { setCands([]); setOpen(false); return; }
    setOpen(true);
    clearTimeout(onChange._t);
    onChange._t = setTimeout(() => runSearch(v), 200);
  };

  React.useEffect(() => {
    const onDoc = (e) => {
      const inBox = boxRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inBox && !inPanel) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return { q, onChange, onBlur: ()=>{}, open, loading, cands, setOpen, boxRef, panelRef, setQ };
}
`.trim();

const overlayBlock = `
// === PATCH: MapSearchOverlay (지도 아래에 바로 추가: 기존 UI 영향 없음) ===
function MapSearchOverlay({ mapObjRef, activeDayISO, onAdd }) {
  const { q, onChange, onBlur, open, loading, cands, setOpen, boxRef, panelRef, setQ } = useMapSearch(mapObjRef);
  return (
    <div className="absolute left-4 right-4 top-4 z-[5]">
      <div ref={boxRef} className="bg-white/95 backdrop-blur rounded-xl shadow flex items-center px-3 py-2">
        <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-70 mr-2">
          <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79L20 21.49 21.49 20zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (q.trim()) setOpen(true); }}
          onBlur={onBlur}
          placeholder="장소를 검색하세요 (예: 도고온천, 오코노미야키...)"
          className="flex-1 outline-none bg-transparent text-sm py-1"
        />
        {q && (
          <button
            className="text-xs text-gray-500 hover:text-gray-700"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setQ(''); setOpen(false); }}
          >
            지우기
          </button>
        )}
      </div>
      {open && (
        <div ref={panelRef} className="mt-2 max-h-80 overflow-auto rounded-xl shadow-xl border bg-white">
          {loading && <div className="p-3 text-sm text-gray-500">검색 중...</div>}
          {!loading && !cands.length && <div className="p-3 text-sm text-gray-500">검색 결과가 없습니다</div>}
          {!loading && cands.map(c => (
            <div key={c.placeId} className="px-3 py-3 border-b last:border-b-0 hover:bg-gray-50">
              <div className="flex gap-3">
                <div className="w-24 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs text-gray-400">사진 없음</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-sm text-gray-600 truncate">{c.address}</div>
                  <div className="text-xs text-gray-700 mt-1">
                    {hoursSummary(c.opening_hours, activeDayISO)}
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    className="px-3 py-1 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAdd(c)}
                  >
                    일정에 추가
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
`.trim();

// 1) Insert helpers after the last import block
onceInsert(/(import[\\s\\S]*?;\\s*)(?![\\s\\S]*import)/m, helpersBlock, 'helpers/constants');

// 2) Insert hook + overlay before export default or EOF
onceInsert(/(\\n)(?=export\\s+default\\s+function|export\\s+default\\s*\\(|module\\.exports|$)/m, hookBlock + "\\n\\n" + overlayBlock, 'useMapSearch + MapSearchOverlay');

// 3) Ensure map options
ensureInMapOptions();

// 4) Ensure minHeight on map div (fixed)
ensureMinHeightOnMapDiv();

// 5) Replace addEntry implementation (if present), else warn
(function replaceAddEntry(){
  const re = /const\\s+addEntry\\s*=\\s*React\\.useCallback\\s*\\(\\s*\\(([^)]*)\\)\\s*=>\\s*\\{[\\s\\S]*?\\}\\s*,\\s*\\[[^\\]]*\\]\\s*\\);/m;
  const newImpl = `const addEntry = React.useCallback((dayIdx, initial = {}) => {
  const newId = genId();
  setDays(arr => {
    const cp = [...arr];
    if (!cp[dayIdx]) return arr;
    const d = { ...cp[dayIdx] };
    d.entries = [...(d.entries || []), {
      id: newId,
      title: '',
      address: '',
      lat: null, lng: null,
      placeId: null,
      opening_hours: null,
      time: '',          // ← 시간은 비워둠
      ...initial,
    }];
    cp[dayIdx] = d;
    return cp;
  });
  return newId;
}, [setDays]);`;
  if (re.test(src)) {
    src = src.replace(re, newImpl);
    console.log('[ok] Replaced existing addEntry implementation.');
  } else if (!src.includes('const addEntry')) {
    console.warn('[warn] addEntry not found; please ensure function exists to patch.');
  }
})();

// 6) Insert onAddFromCandidate if missing
if (!/onAddFromCandidate\\s*=\\s*React\\.useCallback/.test(src) && src.includes('const addEntry')) {
  src = src.replace(/(const\\s+addEntry[\\s\\S]*?\\);)/m, `$1

const onAddFromCandidate = React.useCallback((cand) => {
  if (!days?.[activeIdx]) return;
  const id = addEntry(activeIdx, {
    title: cand.name || '',
    address: cand.address || '',
    lat: cand.geometry?.lat ?? null,
    lng: cand.geometry?.lng ?? null,
    placeId: cand.placeId ?? null,
    opening_hours: cand.opening_hours ?? null,
  });
  if (mapObjRef.current && cand.geometry) {
    mapObjRef.current.panTo(cand.geometry);
    mapObjRef.current.setZoom(Math.max(mapObjRef.current.getZoom(), 14));
  }
  return id;
}, [days, activeIdx, addEntry]);
`);
  console.log('[ok] Inserted onAddFromCandidate.');
}

// 7) Add red warning under time input
if (!/이\\s*시간은\\s*운영시간이\\s*아니에요/.test(src)) {
  src = src.replace(
    /(\\<input[^>]*type=\\\"time\\\"[\\s\\S]*?\\>)/m,
    `$1
{entry.time && entry.opening_hours && !isTimeWithinOpeningHours(entry.opening_hours, days[dayIdx ?? activeIdx].date, entry.time) && (
  <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
    <span className="font-semibold">❗</span> 이 시간은 운영시간이 아니에요!
  </div>
)}
`
  );
  console.log('[ok] Inserted red warning under time input.');
}

// 8) Comment out schedule-internal search inputs (common keywords)
src = src.replace(/(\\n\\s*)(\\<input[^>]+placeholder=\\\"[^\\\"]*(장소|검색)[^\\\"]*\\\"[^>]*\\>)/g, '$1{/* $2  (removed by patch: use map top search only) */}');

// 9) Add <MapSearchOverlay ... /> after the map div
if (!/MapSearchOverlay\\s*\\n/.test(src) && src.includes('ref={mapRef}')) {
  const refIdx = src.indexOf('ref={mapRef}');
  const startDiv = src.lastIndexOf('<div', refIdx);
  const endTag = src.indexOf('>', refIdx);
  if (startDiv !== -1 && endTag !== -1) {
    const insertPos = endTag + 1;
    const overlay = `
<MapSearchOverlay
  mapObjRef={mapObjRef}
  activeDayISO={days?.[activeIdx]?.date || new Date().toISOString().slice(0,10)}
  onAdd={onAddFromCandidate}
/>`;
    src = src.slice(0, insertPos) + overlay + src.slice(insertPos);
    console.log('[ok] Inserted <MapSearchOverlay /> after map div.');
  } else {
    console.warn('[warn] Could not find proper insertion point for MapSearchOverlay.');
  }
}

// Write files
const bakPath = filePath + '.bak';
const outPath = path.join(path.dirname(filePath), 'PlanEditor.patched.js');
if (src !== original) {
  fs.writeFileSync(bakPath, original, 'utf8');
  fs.writeFileSync(outPath, src, 'utf8');
  console.log('Done. Backup:', bakPath);
  console.log('Patched file:', outPath);
} else {
  console.log('No changes were applied (file may already be patched).');
}
