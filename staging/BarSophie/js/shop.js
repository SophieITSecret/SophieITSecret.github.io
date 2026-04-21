/**
 * shop.js — ソフィーの隠れ売店（Amazon店）
 * ★ 既存の utils.js / navigation.js の仕組みを最大限に尊重した増築
 */

import * as nav from './navigation.js';
import { setListView, hideLSide } from './utils.js';

const AMZ_TAG = "itsophie-22";

export function openShopPortal() {
    // 状態を売店に更新（これで handleBack がメインメニューに戻るようになる）
    nav.updateNav("shop_root");
    
    // 売店は画面を広く使うため、左サイド（ソフィー）を隠す
    hideLSide(); 
    
    let h = `
        <div class="label" style="justify-content:center; background:#1a1500; border-bottom:1px solid #6a5200; color:#f0c040;">
            🛍️ ソフィーの隠れ売店（Amazon店）
        </div>
        <div class="scr-container" id="shop-container">
            <div class="scr-group" style="border-color:#6a5200; background:#0a0a00; padding: 20px;">
                <p style="font-size:0.92rem; color:#ccc; line-height:1.7; margin-bottom:20px; text-align:center;">
                    いらっしゃいませ。ここは内緒の入口ですわ。<br>
                    Amazonから「今、お買い得なもの」を<br>
                    カテゴリ別に探してまいりました。
                </p>
                
                <button class="act-btn shop-gate-btn" data-kw="ビール+セール">
                    🍺 ビールのセール会場へ直行
                </button>
                
                <button class="act-btn shop-gate-btn" data-kw="ウイスキー+洋酒+セール" style="background:#2a003a;">
                    🥃 洋酒・ウイスキーのセール会場
                </button>
                
                <button class="act-btn shop-gate-btn" data-kw="ワイン+セール" style="background:#3a0000;">
                    🍷 ワインのセール会場へ直行
                </button>
                
                <div class="shop-info-txt">
                    ※外部サイト(Amazon)へ移動します。<br>
                    ※バーに戻るときは、下の「▲」ボタンを押してください。
                </div>
            </div>
        </div>
    `;
    
    // setListView(html, fullScreen=true) により、メインメニューとクレジットが一時的に隠れる
    setListView(h, true);

    // イベント委譲により各ボタンのクリックを処理
    const container = document.getElementById('shop-container');
    if (container) {
        container.onclick = (e) => {
            const btn = e.target.closest('.shop-gate-btn');
            if (btn) {
                const keyword = btn.getAttribute('data-kw');
                const url = `https://www.amazon.co.jp/s?k=${keyword}&tag=${AMZ_TAG}`;
                window.open(url, '_blank');
            }
        };
    }
}