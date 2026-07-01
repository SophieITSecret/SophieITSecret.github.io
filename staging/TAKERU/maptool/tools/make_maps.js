'use strict';
// Natural Earth GeoJSON → TAKERU maptool SVG 変換スクリプト
// 使い方: node make_maps.js
// 出力: ../maps/world.js, ../maps/asia_pacific.js, ../maps/europe.js
//
// データ出典: Natural Earth (https://www.naturalearthdata.com/) Public Domain

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../maps');

// ===== ダウンロード =====
function download(url) {
  return new Promise((resolve, reject) => {
    process.stdout.write('  ダウンロード中: ' + url.split('/').pop() + ' ... ');
    let chunks = [];
    const req = https.get(url, { timeout: 30000 }, res => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.on('data', c => chunks.push(c));
      res.on('end', () => { console.log('OK (' + (Buffer.byteLength(Buffer.concat(chunks)) / 1024).toFixed(0) + ' KB)'); resolve(Buffer.concat(chunks).toString('utf8')); });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('タイムアウト')); });
  });
}

// ===== 投影 (正距円筒) =====
function lonLatToXY(lon, lat, W, H, bounds) {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const x = (lon - minLon) / (maxLon - minLon) * W;
  const y = (maxLat - lat) / (maxLat - minLat) * H;
  return [x, y];
}

// ===== 投影 (メルカトル) =====
function mercY(latDeg) {
  const r = latDeg * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}
function lonLatToXYMercator(lon, lat, W, H, bounds) {
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const x = (lon - minLon) / (maxLon - minLon) * W;
  const yTop = mercY(maxLat), yBot = mercY(minLat);
  const y = (yTop - mercY(lat)) / (yTop - yBot) * H;
  return [x, y];
}

function ringToPath(ring, W, H, bounds, proj) {
  if (ring.length < 3) return '';
  const fn = proj === 'mercator' ? lonLatToXYMercator : lonLatToXY;
  const pts = ring.map(([lon, lat]) => fn(lon, lat, W, H, bounds));
  return 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') + ' Z';
}

function geometryToPath(geometry, W, H, bounds, proj) {
  if (!geometry) return '';
  const rings = [];
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => rings.push(ringToPath(ring, W, H, bounds, proj)));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(poly => poly.forEach(ring => rings.push(ringToPath(ring, W, H, bounds, proj))));
  }
  return rings.filter(Boolean).join(' ');
}

// ===== GeoJSON → SVG paths =====
function convertToSvg(geojson, W, H, bounds, proj) {
  const features = geojson.features || [];
  const paths = [];
  let skipped = 0;

  features.forEach(f => {
    if (!f.geometry) { skipped++; return; }
    const props = f.properties || {};
    // ISO_A2 がない国（南極等）はスキップ。-99 のとき ISO_A2_EH にフォールバック（France, Norway 等）
    let id = (props.ISO_A2 || '').trim();
    if (!id || id === '-99') id = (props.ISO_A2_EH || '').trim();
    if (!id || id === '-99') { skipped++; return; }
    const name = (props.ADMIN || props.NAME || '').replace(/"/g, '&quot;');
    const nameJa = (props.NAME_JA || '').replace(/"/g, '&quot;');

    const d = geometryToPath(f.geometry, W, H, bounds, proj);
    if (!d) { skipped++; return; }

    const nameAttr = nameJa ? ` data-name-ja="${nameJa}"` : '';
    paths.push(`<path id="${id}" class="region" data-name="${name}"${nameAttr} d="${d}"/>`);
  });

  if (skipped) process.stdout.write(`  (${skipped}件スキップ) `);
  return paths.join('\n');
}

// ===== JS ファイル出力 =====
function writeMapJs(mapId, name, viewBox, svgContent, outFile) {
  const js = `window.MAPS = window.MAPS || {};\nwindow.MAPS['${mapId}'] = {\n  name: '${name}',\n  viewBox: '${viewBox}',\n  regions: 'region',\n  svg: \`<g class="regions" fill-rule="evenodd">\n${svgContent}\n</g>\`\n};\n`;
  fs.writeFileSync(outFile, js, 'utf8');
  const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`  → ${path.basename(outFile)} (${kb} KB)`);
}

// ===== バウンズ内に座標があるか判定 =====
function featureInBounds(feature, bounds) {
  if (!feature.geometry) return false;
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const coords = [];
  const collect = (c) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') { coords.push(c); return; }
    c.forEach(collect);
  };
  collect(feature.geometry.coordinates);
  return coords.some(([lon, lat]) =>
    lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat);
}

// ===== 地図設定 =====
// src: '110m' = 概観用（軽量）、'50m' = 拡大用（詳細）
const MAPS = [
  // ── 110m 概観版 ──
  {
    id: 'world',
    name: '世界（国別）',
    outFile: 'world.js',
    W: 2000, H: 1000,
    bounds: { minLon: -180, maxLon: 180, minLat: -90, maxLat: 90 },
    src: '110m'
  },
  {
    id: 'asia_pacific',
    name: 'アジア太平洋',
    outFile: 'asia_pacific.js',
    W: 1200, H: 900,
    bounds: { minLon: 60, maxLon: 180, minLat: -15, maxLat: 75 },
    src: '110m'
  },
  {
    id: 'europe',
    name: 'ヨーロッパ・中東・北アフリカ',
    outFile: 'europe.js',
    W: 1000, H: 1000,
    bounds: { minLon: -25, maxLon: 55, minLat: 22, maxLat: 72 },
    src: '110m'
  },
  {
    id: 'north_america',
    name: '北アメリカ',
    outFile: 'north_america.js',
    W: 1200, H: 900,
    bounds: { minLon: -170, maxLon: -50, minLat: 10, maxLat: 85 },
    src: '110m'
  },
  // ── 50m 詳細版（拡大向け） ──
  {
    id: 'world_hd',
    name: '世界（詳細）',
    outFile: 'world_hd.js',
    W: 4000, H: 2000,
    bounds: { minLon: -180, maxLon: 180, minLat: -90, maxLat: 90 },
    src: '50m'
  },
  {
    id: 'asia_pacific_hd',
    name: 'アジア太平洋（詳細）',
    outFile: 'asia_pacific_hd.js',
    W: 2400, H: 1800,
    bounds: { minLon: 60, maxLon: 180, minLat: -15, maxLat: 75 },
    src: '50m'
  },
  {
    id: 'europe_hd',
    name: 'ヨーロッパ・中東・北アフリカ（詳細）',
    outFile: 'europe_hd.js',
    W: 2000, H: 2000,
    bounds: { minLon: -25, maxLon: 55, minLat: 22, maxLat: 72 },
    src: '50m'
  },
  {
    id: 'north_america_hd',
    name: '北アメリカ（詳細）',
    outFile: 'north_america_hd.js',
    W: 2400, H: 1800,
    bounds: { minLon: -170, maxLon: -50, minLat: 10, maxLat: 85 },
    src: '50m'
  },
];

// ===== メイン =====
async function main() {
  console.log('=== TAKERU 地図データ作成ツール ===\n');

  // GeoJSON をダウンロード
  const url110 = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
  const url50  = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

  let geo110, geo50;
  try {
    geo110 = JSON.parse(await download(url110));
  } catch (e) { console.error('ダウンロード失敗:', e.message); process.exit(1); }

  try {
    geo50 = JSON.parse(await download(url50));
  } catch (e) { console.warn('50m データのダウンロードに失敗しました。110m データを代用します。'); geo50 = geo110; }

  console.log('');

  // 各地図を生成
  for (const mapDef of MAPS) {
    console.log(`[${mapDef.name}] 変換中...`);
    const base = (mapDef.src === '50m') ? geo50 : geo110;
    const isWorld = mapDef.bounds.minLon === -180 && mapDef.bounds.maxLon === 180;
    const geo = isWorld ? base : {
      type: 'FeatureCollection',
      features: base.features.filter(f => featureInBounds(f, mapDef.bounds))
    };
    const svgPaths = convertToSvg(geo, mapDef.W, mapDef.H, mapDef.bounds, mapDef.proj);
    const viewBox = `0 0 ${mapDef.W} ${mapDef.H}`;
    writeMapJs(mapDef.id, mapDef.name, viewBox, svgPaths, path.join(OUT_DIR, mapDef.outFile));
  }

  // ===== Japan HD（都道府県 GeoJSON from Geolonia） =====
  console.log('[日本（都道府県・詳細）] 変換中...');
  const urlJapan = 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson';
  const JAPAN_BOUNDS = { minLon: 120, maxLon: 156, minLat: 23, maxLat: 47 };
  // W:H = (lon範囲/lat範囲) × cos(中心緯度35°) = (36/24)×0.819 ≈ 1.23
  const JW = 2000, JH = 1630;
  try {
    const geoJapan = JSON.parse(await download(urlJapan));
    const paths = [];
    (geoJapan.features || []).forEach(f => {
      if (!f.geometry) return;
      const props = f.properties || {};
      const code = (props.id || '').toString().padStart(2, '0');
      const name = (props.nam_ja || props.nam || '').replace(/"/g, '&quot;');
      if (!code || code === '00') return;
      const d = geometryToPath(f.geometry, JW, JH, JAPAN_BOUNDS);
      if (!d) return;
      paths.push(`<g class="prefecture" data-code="${code}" data-name="${name}">${
        d.split(' M').map((seg, i) => `<path d="${i === 0 ? seg : 'M' + seg}"/>`).join('')
      }</g>`);
    });
    const svgContent = `<g class="prefectures">\n${paths.join('\n')}\n</g>`;
    const js = `window.MAPS = window.MAPS || {};\nwindow.MAPS['japan_hd'] = {\n  name: '日本（都道府県・詳細）',\n  viewBox: '0 0 ${JW} ${JH}',\n  regions: 'prefecture',\n  svg: \`${svgContent}\`\n};\n`;
    const outFile = path.join(OUT_DIR, 'japan_hd.js');
    fs.writeFileSync(outFile, js, 'utf8');
    const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
    console.log(`  → japan_hd.js (${kb} KB)`);
  } catch (e) {
    console.warn('  Japan HD 生成失敗:', e.message);
  }

  console.log('\n完了！ index.html を更新して地図が表示されます。');
}

main().catch(e => { console.error('エラー:', e); process.exit(1); });
