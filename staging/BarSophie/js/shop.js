/**
 * shop.js — ソフィーの隠れ売店（Amazon店）
 * ★ カテゴリ別のAmazonセール会場へ直送します。
 */

import * as nav from './navigation.js';
import { setListView, hideLSide } from './utils.js';

const AMZ_TAG = "itsophie-22";

/**
 * 売店ポータルを開く
 */
export function openShopPortal() {
    nav.updateNav("shop_root");
    
    // 売店は画面を広く使うため、モニター（左サイド）を隠す
    hideLSide(); 
    
    let h = `
        <div class="label" style="justify-content:center; background:#1a1500; border-bottom:1px solid #6a5200; color:#f0c040;">
            🛍️ ソフィーの隠れ売店（Amazon店）
        </div>
        <div class="scr-container">
            <div class="scr-group" style="border-color:#6a5200; background:#0a0a00; padding: 20px;">
                <p style="font-size:0.9rem; color:#ccc; line-height:1.6; margin-bottom:20px; text-align:center;">
                    いらっしゃいませ。ここは内緒の入口ですわ。<br>
                    Amazonから「今、お買い得なもの」を<br>カテゴリ別に探してまいりました。
                </p>
                
                <button class="act-btn shop-gate" data-kw="ビール+セール" style="background:#d35400; margin-bottom:15px; height: 60px; font-size: 1.1rem;">
                    🍺 ビールのセール会場へ直行
                </button>
                
                <button class="act-btn shop-gate" data-kw="ウイスキー+洋酒+セール" style="background:#8e44ad; margin-bottom:15px; height: 60px; font-size: 1.1rem;">
                    🥃 洋酒・ウイスキーのセール会場
                </button>
                
                <button class="act-btn shop-gate" data-kw="ワイン+セール" style="background:#c0392b; margin-bottom:15px; height: 60px; font-size: 1.1rem;">
                    🍷 ワインのセール会場へ直行
                </button>
                
                <div style="margin-top:20px; font-size:0.75rem; color:#666; text-align:center; line-height:1.5;">
                    ※外部サイト(Amazon)へ移動します。<br>
                    ※バーに戻るときは、下の「▲」ボタンを押してください。
                </div>
            </div>
        </div>
    `;
    
    // utils.js の setListView(html, fullScreen) を使用
    setListView(h, true);

    // 各ボタンにAmazonリンクのイベントを付与
    document.querySelectorAll('.shop-gate').forEach(btn => {
        btn.addEventListener('click', () => {
            const keyword = btn.getAttribute('data-kw');
            const url = `https://www.amazon.co.jp/s?k=${keyword}&tag=${AMZ_TAG}`;
            window.open(url, '_blank');
        });
    });
}