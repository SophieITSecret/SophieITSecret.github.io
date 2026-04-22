/**
 * shop.js — ソフィーの特選・売店モジュール
 * ★ 他の機能から完全に独立しています
 */

import * as nav from './navigation.js';
import { setListView, clean } from './utils.js';

let shopData = [];

// 初期化：CSVデータの読み込み
export async function initShop() {
    try {
        const res = await fetch('売店メニュー.csv');
        if (!res.ok) throw new Error("CSV not found");
        const csv = await res.text();
        
        // 簡易CSVパース (カテゴリー,商品名,検索キーワード,説明)
        shopData = csv.split('\n').slice(1).filter(l => l.trim().length > 0).map(l => {
            const c = l.split(',').map(s => s.trim());
            return { cat: c[0], name: c[1], keyword: c[2], desc: c[3] };
        });
        console.log("Shop Data Ready:", shopData.length);
    } catch (e) {
        console.warn("売店メニュー.csv の読み込みに失敗しました", e);
        shopData = [];
    }
}

// 売店画面を開く
export function openShop() {
    nav.updateNav("shop");

    // 【1】上部の固定ボタンエリア（ジャンル別特設会場）
    let h = `<div class="label" id="lbl-back-shop" style="cursor:pointer;">◀ メインカウンターへ戻る</div>`;
    
    h += `<div style="padding: 12px;">`;
    // 本日のお買い得（総合）
    h += `<a href="https://www.amazon.co.jp/b?node=2221087051&tag=itsophie-22" target="_blank" class="act-btn" style="background:#c8a84b; color:#000!important; border:1px solid #ffe699; font-size:1.05rem;">🎁 Amazon 本日のお買い得</a>`;
    
    // 4ジャンル分割ボタン
    h += `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">`;
    const cats = [
        { name: "🍺 ビール", kw: "ビール" },
        { name: "🥃 洋酒", kw: "ウイスキー スピリッツ" },
        { name: "🍷 ワイン", kw: "ワイン" },
        { name: "🍶 日本酒・焼酎", kw: "日本酒 焼酎" }
    ];
    cats.forEach(c => {
        const url = `https://www.amazon.co.jp/s?k=${encodeURIComponent(c.kw)}&tag=itsophie-22`;
        h += `<a href="${url}" target="_blank" class="act-btn" style="flex:1; min-width:40%; background:#1a1a2e; border:1px solid #333; font-size:0.9rem; margin-bottom:0; height:44px; display:flex!important; align-items:center; justify-content:center; text-decoration:none;">${c.name}</a>`;
    });
    h += `</div></div>`;

    // 【2】下部のCSV特選リストエリア
    if (shopData.length > 0) {
        const grouped = {};
        shopData.forEach(d => {
            if (!grouped[d.cat]) grouped[d.cat] = [];
            grouped[d.cat].push(d);
        });

        for (const cat in grouped) {
            h += `<div class="label" style="top:28px;">🛍️ ${clean(cat)}</div>`;
            grouped[cat].forEach(item => {
                const amzUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(clean(item.keyword))}&tag=itsophie-22`;
                
                // .item のスタイルを上書きして複数行対応にする
                h += `<div class="item" style="padding:12px 15px; cursor:default; white-space:normal; overflow:visible; height:auto;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="font-weight:bold; color:#eee; font-size:1rem; margin-bottom:6px; line-height:1.4;">${clean(item.name)}</div>
                            <a href="${amzUrl}" target="_blank" class="lq-btn-amz-small" style="margin-left:10px; flex-shrink:0;">Amazon↗</a>
                        </div>
                        <div style="font-size:0.85rem; color:#aaa; line-height:1.6;">${clean(item.desc)}</div>
                      </div>`;
            });
        }
    } else {
        h += `<div style="padding:20px; text-align:center; color:#888;">特選リストの準備中です...</div>`;
    }

    // utilsの共通関数で描画（fullScreen=true にすることで左の画像を消し、免責も自動で消える）
    setListView(h, true);

    // 戻るボタンのイベント（既存のコンソールの▲ボタンを押したのと同じ挙動にさせる）
    document.getElementById('lbl-back-shop').addEventListener('click', () => {
        const backBtn = document.getElementById('ctrl-back');
        if (backBtn) backBtn.click();
    });
}