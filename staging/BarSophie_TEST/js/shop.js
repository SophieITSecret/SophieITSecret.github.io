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

    let h = `<div class="label" id="lbl-back-shop" style="cursor:pointer;">◀ メインカウンターへ戻る</div>`;
    
    // 【看板エリア】Sophie's Selection
    h += `<div style="text-align:center; padding:20px 0 10px;">
            <div style="color:var(--accent); font-size:1.2rem; font-weight:bold; letter-spacing:1px; font-family:serif;">Sophie's Selection</div>
            <div style="color:#888; font-size:0.75rem; margin-top:4px;">- ソフィーの特選・お買い得情報 -</div>
          </div>`;

    h += `<div style="padding: 0 12px 12px;">`;

    // 🎁 総合タイムセール（立体感のあるプレミアムボタン）
    h += `<a href="https://www.amazon.co.jp/gp/goldbox?tag=itsophie-22" target="_blank" class="act-btn" style="background: linear-gradient(135deg, #3a2a00, #1a1500); color:#f1c40f!important; border:1px solid #c8a84b; font-size:1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.5); margin-bottom:15px;">🎁 Amazon 総合タイムセール会場</a>`;
    
    h += `<div style="font-size:0.8rem; color:#aaa; margin:0 0 8px; text-align:center;">▼ 本日の飲料タイムセール（Amazon） ▼</div>`;

    // タイムセール専用URL生成関数（元締めの隠しコマンド入り）
    const getSaleUrl = (kw) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}&rh=p_n_specials_match%3A21213692051&tag=itsophie-22`;

    // 🍺 お酒4ジャンル分割ボタン
    h += `<div style="display:flex; flex-wrap:wrap; gap:8px;">`;
    const cats = [
        { name: "🍺 ビール", kw: "ビール" },
        { name: "🥃 洋酒", kw: "ウイスキー スピリッツ" },
        { name: "🍷 ワイン", kw: "ワイン" },
        { name: "🍶 日本酒・焼酎", kw: "日本酒 焼酎" }
    ];
    cats.forEach(c => {
        h += `<a href="${getSaleUrl(c.kw)}" target="_blank" class="act-btn" style="flex:1; min-width:40%; background:#1a1a2e; border:1px solid #444; font-size:0.9rem; margin-bottom:0; height:44px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${c.name}</a>`;
    });
    h += `</div>`;

    // 💧 水・清涼飲料の小ボタン（破線で控えめに）
    h += `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">`;
    const softCats = [
        { name: "💧 ミネラルウォーター", kw: "水 ミネラルウォーター" },
        { name: "🥤 炭酸水・清涼飲料", kw: "炭酸水 清涼飲料" }
    ];
    softCats.forEach(c => {
        h += `<a href="${getSaleUrl(c.kw)}" target="_blank" class="act-btn" style="flex:1; min-width:40%; background:#111; border:1px dashed #555; color:#aaa!important; font-size:0.8rem; margin-bottom:0; height:36px; display:flex!important; align-items:center; justify-content:center; text-decoration:none;">${c.name}</a>`;
    });
    h += `</div></div>`;

    // 【下部】CSV特選リストエリア
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

    setListView(h, true);

    document.getElementById('lbl-back-shop').addEventListener('click', () => {
        const backBtn = document.getElementById('ctrl-back');
        if (backBtn) backBtn.click();
    });
}