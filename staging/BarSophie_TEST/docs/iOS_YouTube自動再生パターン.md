# iOS YouTube 自動再生パターン（BARソフィー PWA）

## 背景

iOS Safari は YouTube IFrame API の `loadVideoById()` / `playVideo()` を
**ユーザーのタップと関係ないコンテキスト**（setTimeout、onended コールバック等）から
呼び出すと自動再生をブロックする。

さらに `yt-wrapper` が `display:none` の状態で `loadVideoById` を呼んでも
iOS は自動再生しない（`showRootMenu()` が `yt.style.display = 'none'` するため
C 画面に戻るたびに発生する問題）。

---

## 正しいパターン（DJSophie / _tdOshioki で採用）

```javascript
// ★ ユーザーのタップハンドラ（同期処理）内でここまで実行する

// 1. yt-wrapper を表示（display:none のまま loadVideoById しない）
const yt  = document.getElementById('yt-wrapper');
const img = document.getElementById('monitor-img');
if (yt) yt.style.display = 'block';

// 2. ミュートしてプリロード開始（iOS に「ジェスチャーで始めた」と認識させる）
try {
    window._ytPlayer?.mute();
    window._ytPlayer?.loadVideoById('動画ID');
} catch(e) {}

// ★ ここまでがジェスチャーコンテキスト。以降は非同期でOK。
// monitor-img は z-index:5 で yt-wrapper を覆うので顔画像はそのまま見える。

// 3. 音声（ナレーション）を再生
const audio = new Audio('./voices_mp3/narration.mp3');
audio.play().catch(() => {});

// 4. 音声終了後に映像を表示・再生
const showVideo = () => {
    if (img) img.style.display = 'none';   // 顔画像を隠す
    try {
        window._ytPlayer?.unMute();
        window._ytPlayer?.setVolume(80);
        window._ytPlayer?.playVideo();      // プリロード済みなので確実に動く
    } catch(e) {}
};
audio.onended = showVideo;
audio.onerror = showVideo;                  // ファイルが無くても動く
setTimeout(showVideo, 4000);                // フォールバック

// 5. 再生確認（3秒後）
setTimeout(() => {
    try {
        const s = window._ytPlayer?.getPlayerState?.();
        if (s !== 1 && s !== 3) showRootMenu(); // 未再生なら強制帰還
    } catch(e) {}
}, 4000 + 3000);
```

---

## レイアウト前提

```
.monitor
├── #yt-wrapper         display:block / none  ← YouTube IFrame Player の器
│   └── #yt-player      YT.Player が置き換えるdiv
├── #chart-wrapper      position:absolute; top:0  ← TradingView等
└── #monitor-img        position:absolute; inset:0; z-index:5  ← 顔画像（常に最前面）
```

`monitor-img` が `z-index:5` で最前面にあるため、`yt-wrapper` を `display:block`
にしても顔画像がそれを覆う。これを利用してプリロード中は顔を見せ続け、
再生タイミングで `img.style.display = 'none'` に切り替える。

---

## NG パターン

| NG | 理由 |
|---|---|
| `yt.style.display = 'none'` のまま `loadVideoById` | iOS がブロック |
| setTimeout / onended の中で `loadVideoById` だけ呼ぶ | ジェスチャー外のため iOS がブロック |
| `yt.innerHTML = ''` で yt-player div を破壊 | YT.Player オブジェクトが無効化され音楽モジュールも壊れる |
| iframe を直接 innerHTML で埋め込む | onStateChange コールバックが機能せず曲終了検知できない |

---

## 関連ファイル

- `js/app_m.js` — `_tdOshioki()` にこのパターンを実装
- `js/dj_sophie.js` — `_playEpisode()` の冒頭でも同じパターンを使用
- `js/music.js` — `setMon('v', url)` は `ytPlayer.loadVideoById()` を直接呼ぶ（nav.state が none の場合は yt-wrapper を非表示のまま BGM として流す）

---

## 初期化時プライミング（app_m.js:155）

```javascript
// btn-enter.onclick 内（ユーザーがバーに入る時）
if (ytPlayerReady && ytPlayer) {
    try {
        ytPlayer.mute();
        ytPlayer.loadVideoById('2vfCbdmKhMw'); // お仕置き動画でプライミング
        setTimeout(() => { ytPlayer.pauseVideo(); ytPlayer.unMute(); }, 1000);
    } catch (e) {}
}
```

入場ボタン押下（ジェスチャー）でYTプレイヤーを一度ミュート再生→停止させることで
iOS にプレイヤーを「認識」させる。これ以降の `loadVideoById` が効くようになる。
