/**
 * shop.js — ソフィーの隠れ売店（Amazon店） v2.0
 * ★ お酒以外のセール情報への直送ボタンを追加
 * ★ 拡張性を高めたリスト構造
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
        <div class="scr-container" style="padding-bottom: 80px;">
            <div class="scr-group" style="border-color:#6a5200; background:#0a0a00; padding: 15px;">
                <p style="font-size:0.9rem; color:#ccc; line-height:1.6; margin-bottom:20px; text-align:center;">
                    いらっしゃいませ。ここは内緒の入口です。<br>
                    Amazonの「今、お買い得なもの」を探してきました。
                </p>

                <button class="act-btn shop-gate" data-kw="タイムセール" data-url="https://www.amazon.co.jp/gp/goldbox" 
                        style="background:linear-gradient(135deg, #d35400, #e67e22); margin-bottom:20px; height: 70px; font-size: 1.2rem; border: 2px solid #f0c040;">
                    🔥 本日の全タイムセール会場
                </button>
                
                <div style="font-size:0.8rem; color:#f0c040; margin-bottom:10px; border-left:3px solid #f0c040; padding-left:8px;">
                    カテゴリー別（お酒）
                </div>

                <button class="act-btn shop-gate" data-kw="ビール+セール" style="background:#222; border:1px solid #444; margin-bottom:10px; height: 50px;">
                    🍺 ビールのセール会場
                </button>
                
                <button class="act-btn shop-gate" data-kw="ウイスキー+洋酒+セール" style="background:#222; border:1px solid #444; margin-bottom:10px; height: 50px;">
                    🥃 洋酒・ウイスキーのセール
                </button>
                
                <button class="act-btn shop-gate" data-kw="ワイン+セール" style="background:#222; border:1px solid #444; margin-bottom:10px; height: 50px;">
                    🍷 ワインのセール会場
                </button>

                <button class="act-btn shop-gate" data-kw="炭酸水+セール" style="background:#222; border:1px solid #444; margin-bottom:10px; height: 50px;">
                    🫧 割り材・炭酸水のセール
                </button>
                
                <div style="margin-top:30px; font-size:0.75rem; color:#777; text-align:center; line-height:1.6; background:#111; padding:10px; border-radius:8px;">
                    ※外部サイト(Amazon)へ移動します。<br>
                    ※戻る時は、下の「▲」または<br>
                    <span style="color:#aaa;">右下のソフィーアイコン</span>を押してください。
                </div>
            </div>
        </div>
    `;
    
    setListView(h, true);

    // 各ボタンにイベントを付与
    document.querySelectorAll('.shop-gate').forEach(btn => {
        btn.addEventListener('click', () => {
            const kw = btn.getAttribute('data-kw');
            const directUrl = btn.getAttribute('data-url');
            
            // 直接URL指定（タイムセール会場）があればそれを、なければキーワード検索
            const url = directUrl 
                ? `${directUrl}?tag=${AMZ_TAG}`
                : `https://www.amazon.co.jp/s?k=${kw}&tag=${AMZ_TAG}`;
                
            window.open(url, '_blank');
        });
    });
}