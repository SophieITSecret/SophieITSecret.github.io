# BARソフィー 画面構成ツリー（2026-05-22）

## 凡例
- 🆓 ゲスト利用可
- 🔑 ログイン必須（無料会員以上）
- 👑 ご常連パスカード or チケット必須
- <span style="color:#26c6da">**文**</span>　画面上の表示テキスト
- <span style="color:#ffb3c1">**Ｔ**</span>　ソフィーのトーク（音声 or テロップ）／一言（ランダム a/b/c/r、新規ユーザー24h以内はnc）

---

## 起動フロー（C到達前）

エントリー画面
└─ ラウンジ（チャット）
        　　<span style="color:#26c6da">文　「いらっしゃいませ。」</span>
        　　<span style="color:#ffb3c1">Ｔ　greeting.mp3（既存）　即時</span>

---

C　カウンター（ルートメニュー）
        　　<span style="color:#ffb3c1">Ｔ 即時</span>
        　　<span style="color:#ffb3c1">　　NC　「よくおいでいただきました。ぜひ今夜は楽しんでくださいね」</span>
        　　<span style="color:#ffb3c1">　　70%「いつも有難うございます。今夜はいかがなさいますか？」</span>
        　　<span style="color:#ffb3c1">　　30%「いつも有難うございます。今夜は、どんな夜にしましょうか」</span>
│
├─ S1　音楽リクエスト：歌手リスト　🆓
│       　　<span style="color:#ffb3c1">Ｔ 1秒後</span>
│       　　<span style="color:#ffb3c1">　　50%「はい、音楽ですね」</span>
│       　　<span style="color:#ffb3c1">　　20%「いい曲選んでくださいね」</span>
│       　　<span style="color:#ffb3c1">　　20%「どんな音楽の気分ですか？」</span>
│       　　<span style="color:#ffb3c1">　　10%「私も何か聞きたいです。」</span>
│       └─ S2　曲リスト（タップで再生）
│               　　<span style="color:#ffb3c1">Ｔ 1.5秒後</span>
│               　　<span style="color:#ffb3c1">　　50%「どの曲にされますか？」</span>
│               　　<span style="color:#ffb3c1">　　20%「さあ、どうしましょう？」</span>
│               　　<span style="color:#ffb3c1">　　20%「いい曲ばかりで、迷いますね」</span>
│               　　<span style="color:#ffb3c1">　　10%「今日の気分はどれですか？」</span>
│
├─ N1　お酒の話：ジャンルリスト　🆓
│       　　<span style="color:#ffb3c1">Ｔ 1秒後</span>
│       　　<span style="color:#ffb3c1">　　50%「どのジャンルの話をいたしましょうか？」</span>
│       　　<span style="color:#ffb3c1">　　20%「ご興味は？」</span>
│       　　<span style="color:#ffb3c1">　　20%「お酒も色々ですからね」</span>
│       　　<span style="color:#ffb3c1">　　10%「私の得意はカクテルです」</span>
│       └─ N2　サブジャンルリスト
│               └─ N3　話タイトル（記事本文）
│
├─ L1　お酒を探す　🆓
│       　　<span style="color:#ffb3c1">Ｔ 1秒後</span>
│       　　<span style="color:#ffb3c1">　　50%「ジャンルから、お好みから、お選びいただけます」</span>
│       　　<span style="color:#ffb3c1">　　20%「今夜の一杯、一緒に探しましょう」</span>
│       　　<span style="color:#ffb3c1">　　20%「もうすぐ私があなた様とお話しして選べるようになります」</span>
│       　　<span style="color:#ffb3c1">　　10%「あなた様の好みを覚えておきたいので、ぜひ教えてください」</span>
│       ├─ L2a　大分類表
│       │       └─ L3a　中分類表
│       │               └─ L4a　銘柄リスト
│       │                       └─ LT　銘柄カード
│       ├─ L2b　スクリーニング表
│       │       └─ L3b　検索結果 ─→ LT
│       └─ L2c　ID直接入力 ─→ LT
│
├─ O　ソフィーと話す
│       　　<span style="color:#ffb3c1">Ｔ 即時（iceの音の後）</span>
│       　　<span style="color:#ffb3c1">　　50%「はい、およびですか？」</span>
│       　　<span style="color:#ffb3c1">　　20%「はい、何なりと」</span>
│       　　<span style="color:#ffb3c1">　　20%「はい、わたくしと、お話ししてくださるんですか？」</span>
│       　　<span style="color:#ffb3c1">　　10%「はい、何でもお気兼ねなくおっしゃってください」</span>
│       ├─ O2　このお店の使い方（静的テキスト）　🆓
│       ├─ R1　いいお店を探す：入力フォーム　🔑
│       │       　　<span style="color:#ffb3c1">Ｔ 0.5秒後</span>
│       │       　　<span style="color:#ffb3c1">　　50%「はい、一緒にいいお店、探しましょう」</span>
│       │       　　<span style="color:#ffb3c1">　　20%「どんな気分の夜ですか？」</span>
│       │       　　<span style="color:#ffb3c1">　　20%「美味しいお店なら、結構知ってます」</span>
│       │       　　<span style="color:#ffb3c1">　　10%「いい店見つけたら、こんど連れてってくださいね」</span>
│       │       └─ R2　検索結果（第1・第2候補）
│       ├─ F1　ソフィーの天命診断 メニュー　🔑
│       │       　　<span style="color:#ffb3c1">Ｔ 1秒後</span>
│       │       　　<span style="color:#ffb3c1">　　50%「さあ、一緒に天命を覗いてみましょうか」</span>
│       │       　　<span style="color:#ffb3c1">　　20%「はい、わたくしの占い、結構当たるんですよ」</span>
│       │       　　<span style="color:#ffb3c1">　　20%「運命の羅針盤、そっと開きますね」</span>
│       │       　　<span style="color:#ffb3c1">　　10%「占いは……わたくしも、少し緊張するんです。真剣ですから」</span>
│       │       ├─ F2　人物帳
│       │       ├─ F3a　あなたのご相談：フォーム
│       │       │       └─ F4　鑑定結果（命式表付き）　👑
│       │       ├─ F3b　あの人どんな人：フォーム
│       │       │       └─ F4　鑑定結果　👑
│       │       └─ F3c　相性を見てもらう：フォーム
│       │               └─ F4　鑑定結果　👑
│       └─ J1　じゃんけん勝負　🆓
│
└─ W　NEWS・マーケット　🆓
        　　<span style="color:#ffb3c1">Ｔ 0.5秒後</span>
        　　<span style="color:#ffb3c1">　　50%「最新の情報ですね」</span>
        　　<span style="color:#ffb3c1">　　20%「世の中の動き、まとめてます」</span>
        　　<span style="color:#ffb3c1">　　20%「今夜の世界の話題ですね」</span>
        　　<span style="color:#ffb3c1">　　10%「情報の海に漕ぎ出しますか？」</span>
        ├─ W1　テレ朝NEWS24（YouTube）
        ├─ W2　ライブカメラ（国内4・海外6）
        ├─ W3　マーケット（TradingView / 株価検索）
        ├─ W4　ニュース記事リンク群
        └─ W5　便利情報リンク群

---

## コンソール（固定）

M1　お客様ノート：フォルダ選択　🔑
        　　<span style="color:#ffb3c1">Ｔ 0.5秒後</span>
        　　<span style="color:#ffb3c1">　　50%「ノート、こうなってます」</span>
        　　<span style="color:#ffb3c1">　　20%「ノートを開きますね」</span>
        　　<span style="color:#ffb3c1">　　20%「あなた様の歴史ですね」</span>
        　　<span style="color:#ffb3c1">　　10%「ノートを見ると、あなた様のことが少しわかった気がします」</span>
        ├─ M2a　お好きな歌（お気に入り曲・マイプレイリスト）
        ├─ M2b　お好きなお酒（お気に入り銘柄）
        ├─ M2c　気になるお店
        ├─ M2d　ソフィーとの記録（じゃんけん履歴）
        └─ M2e　バックアップ・復元

---

## ヘッダー（常時表示）

P1　ご利用案内 showWelcomePage()　← 未ログイン時 or O→ご利用案内
P2　マイページ showMyPage()　　　　← ログイン済みユーザー名タップ
        └─ （free時のみ）Stripe決済 ─→ P2更新（activeへ）

---

## 備考
- **LT** は L2a/L2b/L2c どこからでも到達
- **F4** は F3a / F3b / F3c 共通の結果画面
- **P1・P2** は O経由のほかヘッダーからも直接アクセス可
- **SHOP**（コンソール）は現在未実装
