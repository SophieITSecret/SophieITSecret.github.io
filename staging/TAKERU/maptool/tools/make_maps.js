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

function ringToPath(ring, W, H, bounds) {
  if (ring.length < 3) return '';
  const pts = ring.map(([lon, lat]) => lonLatToXY(lon, lat, W, H, bounds));
  return 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') + ' Z';
}

function geometryToPath(geometry, W, H, bounds) {
  if (!geometry) return '';
  const rings = [];
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => rings.push(ringToPath(ring, W, H, bounds)));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(poly => poly.forEach(ring => rings.push(ringToPath(ring, W, H, bounds))));
  }
  return rings.filter(Boolean).join(' ');
}

// ===== GeoJSON → SVG paths =====
function convertToSvg(geojson, W, H, bounds) {
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

    const d = geometryToPath(f.geometry, W, H, bounds);
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
const MAPS = [
  {
    id: 'world',
    name: '世界（国別）',
    outFile: 'world.js',
    W: 2000, H: 1000,
    bounds: { minLon: -180, maxLon: 180, minLat: -90, maxLat: 90 }
  },
  {
    id: 'asia_pacific',
    name: 'アジア太平洋',
    outFile: 'asia_pacific.js',
    W: 1200, H: 900,
    bounds: { minLon: 60, maxLon: 180, minLat: -15, maxLat: 75 }
  },
  {
    id: 'europe',
    name: 'ヨーロッパ',
    outFile: 'europe.js',
    W: 1000, H: 800,
    bounds: { minLon: -25, maxLon: 50, minLat: 33, maxLat: 72 }
  },
  {
    id: 'north_america',
    name: '北アメリカ',
    outFile: 'north_america.js',
    W: 1200, H: 900,
    bounds: { minLon: -170, maxLon: -50, minLat: 10, maxLat: 85 }
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
    // 世界地図は110m、地域地図はバウンズ内のみ50m（=110mのフィルタリング版）
    const geo = (mapDef.id === 'world') ? geo110 : {
      type: 'FeatureCollection',
      features: geo110.features.filter(f => featureInBounds(f, mapDef.bounds))
    };
    const svgPaths = convertToSvg(geo, mapDef.W, mapDef.H, mapDef.bounds);
    const viewBox = `0 0 ${mapDef.W} ${mapDef.H}`;
    writeMapJs(mapDef.id, mapDef.name, viewBox, svgPaths, path.join(OUT_DIR, mapDef.outFile));
  }

  console.log('\n完了！ index.html を更新して地図が表示されます。');
}

main().catch(e => { console.error('エラー:', e); process.exit(1); });
