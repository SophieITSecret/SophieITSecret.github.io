/**
 * shop.js — 真・完全復元版
 * ★ 初代MrP2の全8ボタンを手書きで保持、商品名の改行のみ修正
 */

import * as nav from './navigation.js';
import { setListView, clean } from './utils.js';

let shopData = [];

export async function initShop() {
    try {
        const res = await fetch('売店メニュー.csv');
        if (!res.ok) throw new Error("CSV not found");
        const csv = await res.text();
        
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

export function openShop() {
    nav.updateNav("shop");

    let h = `<div class="label" id="lbl-back-shop" style="cursor:pointer; position:sticky; top:0; z-index:100;">◀ メインカウンターへ戻る</div>`;
    
    h += `<div style="position:sticky; top:28px; z-index:99; background:#08080a; text-align:center; padding:15px 0 10px; border-bottom:1px solid #222;">
            <div style="color:var(--accent); font-size:1.2rem; font-weight:bold; letter-spacing:1px; font-family:serif;">Sophie's Selection</div>
            <div style="color:#00d2ff; font-size:0.75rem; margin-top:4px;">- ソフィーの特選・お買い得情報 -</div>
          </div>`;

    h += `<div style="padding: 15px 12px 12px;">`;

    h += `<a href="https://www.amazon.co.jp/gp/goldbox?tag=itsophie-22" target="_blank" class="act-btn" style="background: linear-gradient(135deg, #3a2a00, #1a1500); color:#f1c40f!important; border:1px solid #c8a84b; font-size:1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.5); margin-bottom:15px; display:flex!important; align-items:center; justify-content:center; text-decoration:none;">🎁 Amazon 総合タイムセール会場</a>`;
    
    h += `<div style="font-size:0.8rem; color:#aaa; margin:0 0 8px; text-align:center;">▼ 本日の飲料タイムセール（Amazon） ▼</div>`;

    const getSaleUrl = (kw) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}&i=todays-deals&tag=itsophie-22`;

    // 🍺 お酒5ジャンルボタンをそのまま再現
    h += `<div style="display:flex; flex-wrap:wrap; gap:8px;">`;
    h += `<a href="${getSaleUrl('ビール')}" target="_blank" class="act-btn" style="flex:1; min-width:30%; background:#1a1a2e; border:1px solid #444; font-size:0.85rem; margin-bottom:0; height:44px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; box-shadow: 0 2px 4px rgba(0,0,0,0.3); padding:0 4px;">🍺 ビール</a>`;
    h += `<a href="${getSaleUrl('ウイスキー')}" target="_blank" class="act-btn" style="flex:1; min-width:30%; background:#1a1a2e; border:1px solid #444; font-size:0.85rem; margin-bottom:0; height:44px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; box-shadow: 0 2px 4px rgba(0,0,0,0.3); padding:0 4px;">🥃 ウイスキー</a>`;
    h += `<a href="${getSaleUrl('ワイン')}" target="_blank" class="act-btn" style="flex:1; min-width:30%; background:#1a1a2e; border:1px solid #444; font-size:0.85rem; margin-bottom:0; height:44px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; box-shadow: 0 2px 4px rgba(0,0,0,0.3); padding:0 4px;">🍷 ワイン</a>`;
    h += `<a href="${getSaleUrl('日本酒')}" target="_blank" class="act-btn" style="flex:1; min-width:48%; background:#1a1a2e; border:1px solid #444; font-size:0.85rem; margin-bottom:0; height:44px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; box-shadow: 0 2px 4px rgba(0,0,0,0.3); padding:0 4px;">🍶 日本酒</a>`;
    h += `<a href="${getSaleUrl('焼酎')}" target="_blank" class="act-btn" style="flex:1; min-width:48%; background:#1a1a2e; border:1px solid #444; font-size:0.85rem; margin-bottom:0; height:44px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; box-shadow: 0 2px 4px rgba(0,0,0,0.3); padding:0 4px;">🍶 焼酎</a>`;
    h += `</div>`;

    // 💧 水・清涼飲料ボタンを再現
    h += `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">`;
    h += `<a href="${getSaleUrl('水')}" target="_blank" class="act-btn" style="flex:1; min-width:28%; background:#111; border:1px dashed #555; color:#aaa!important; font-size:0.8rem; margin-bottom:0; height:36px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; padding:0 4px;">💧 水</a>`;
    h += `<a href="${getSaleUrl('炭酸水')}" target="_blank" class="act-btn" style="flex:1; min-width:28%; background:#111; border:1px dashed #555; color:#aaa!important; font-size:0.8rem; margin-bottom:0; height:36px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; padding:0 4px;">💧 炭酸水</a>`;
    h += `<a href="${getSaleUrl('ジュース')}" target="_blank" class="act-btn" style="flex:1; min-width:28%; background:#111; border:1px dashed #555; color:#aaa!important; font-size:0.8rem; margin-bottom:0; height:36px; display:flex!important; align-items:center; justify-content:center; text-decoration:none; padding:0 4px;">🥤 ジュース</a>`;
    h += `</div></div>`;

    if (shopData.length > 0) {
        const grouped = {};
        shopData.forEach(d => {
            if (!grouped[d.cat]) grouped[d.cat] = [];
            grouped[d.cat].push(d);
        });

        for (const cat in grouped) {
            h += `<div class="label" style="position:sticky; top:90px; z-index:98;">🛍️ ${clean(cat)}</div>`;
            grouped[cat].forEach(item => {
                const amzUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(clean(item.keyword))}&tag=itsophie-22`;
                // ★Claude指摘：white-space:normalを削除
                h += `<div class="item" style="padding:12px 15px; cursor:default; height:auto; overflow:visible;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div style="font-weight:bold; color:#eee; font-size:1.05rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; margin-right:10px;">${clean(item.name)}</div>
                            <a href="${amzUrl}" target="_blank" class="lq-btn-amz-small" style="flex-shrink:0;">Amazon↗</a>
                        </div>
                        <div style="font-size:0.85rem; color:#aaa; line-height:1.6;">${clean(item.desc)}</div>
                      </div>`;
            });
        }
    }

    setListView(h, true);
    document.getElementById('lbl-back-shop').onclick = () => {
        const backBtn = document.getElementById('ctrl-back-txt');
        if (backBtn) backBtn.click();
    };
}