# BARソフィー 画面構成ツリー（2026-06-07）

## 凡例
- 🆓 ゲスト利用可
- 🔑 ログイン必須（無料会員以上）
- 👑 ご常連パスカード or チケット必須
- <span style="color:#26c6da">**文**</span>　画面上の表示テキスト
- <span style="color:#e8607a">**Ｔ**</span>　ソフィーのトーク（音声 or テロップ）／一言（ランダム a/b/c/r、新規ユーザー24h以内はnc）
- <span style="color:#4a9eff">**選**</span>　お客様の選択・タップ操作
- <span style="color:#27ae60">**■**</span>　音声ファイル名

---

## 起動フロー（C到達前）

エントリー画面
└─ ラウンジ（チャット）
        　　<span style="color:#26c6da">文　「いらっしゃいませ。」</span>
        　　<span style="color:#e8607a">Ｔ　即時　「いらっしゃいませ。お待ちしておりました。いつものお席へどうぞ。」</span>　<span style="color:#27ae60">greeting.mp3</span>

---

C　カウンター（ルートメニュー）
        　　ヒントボタン「お店の使い方」← ログイン済み常時表示 → P1

**ゲスト（初回来店）**　着席ダイアログ
        　　<span style="color:#e8607a">Ｔ　即時　「いらっしゃいませ。ようこそおいでくださいました。こちら、はじめてでしたか？」</span>　<span style="color:#27ae60">guest_first_01.mp3</span>
        　　├─ <span style="color:#4a9eff">はい（初めて）</span>　→　<span style="color:#e8607a">Ｔ　「では、お店のご案内をいたしましょうか？」</span>　<span style="color:#27ae60">guest_first_02a.mp3</span>
        　　│       ├─ <span style="color:#4a9eff">はい、お願いします</span>　→ P1 ご利用案内
        　　│       └─ <span style="color:#4a9eff">いいえ、大丈夫です</span>　→　<span style="color:#e8607a">Ｔ　「では、ごゆっくりお楽しみください。」</span>　<span style="color:#27ae60">guest_first_03a.mp3</span>　→ C
        　　└─ <span style="color:#4a9eff">いいえ（来たことある）</span>　→　<span style="color:#e8607a">Ｔ　「では、お店のご案内は大丈夫ですか？」</span>　<span style="color:#27ae60">guest_first_02b.mp3</span>
        　　        ├─ <span style="color:#4a9eff">はい、大丈夫です</span>　→　<span style="color:#e8607a">Ｔ　「では、ごゆっくりお楽しみください。」</span>　<span style="color:#27ae60">guest_first_03a.mp3</span>　→ C
        　　        └─ <span style="color:#4a9eff">いいえ、お願いします</span>　→ P1 ご利用案内

**ゲスト（再来店）**　着席ダイアログ
        　　<span style="color:#e8607a">Ｔ　即時　「いらっしゃいませ。ようこそおいでくださいました。確か、以前においでいただきましたね？お店の使い方は大丈夫ですか？」</span>　<span style="color:#27ae60">guest_return_01.mp3</span>
        　　├─ <span style="color:#4a9eff">大丈夫です</span>　→　<span style="color:#e8607a">Ｔ　「では、ごゆっくりお楽しみください。」</span>　<span style="color:#27ae60">guest_return_02.mp3</span>　→ C
        　　└─ <span style="color:#4a9eff">聞かせてください</span>　→ P1 ご利用案内

**会員・ログイン済み**
        　　<span style="color:#e8607a">Ｔ　即時</span>
        　　<span style="color:#e8607a">　　NC　「よくおいでいただきました。ぜひ今夜は楽しんでくださいね」</span>　<span style="color:#27ae60">sophie_counter_nc.mp3</span>
        　　<span style="color:#e8607a">　　70%　「いつも有難うございます。今夜はいかがなさいますか？」</span>　<span style="color:#27ae60">sophie_counter_a.mp3</span>
        　　<span style="color:#e8607a">　　30%　「いつも有難うございます。今夜は、どんな夜にしましょうか」</span>　<span style="color:#27ae60">sophie_counter_b.mp3</span>
        　　<span style="color:#e8607a">Ｔ　挨拶終了+3秒（または着席10秒後）「大丈夫ですか？使い方ボタン押していただければわたくしがご案内します。」</span>　<span style="color:#27ae60">member_caution_01.mp3</span>
│
├─ O　ソフィーと話す（openNotice）
│       　　<span style="color:#e8607a">Ｔ　即時</span>
│       　　<span style="color:#e8607a">　　50%　「はい、およびですか？」</span>　<span style="color:#27ae60">sophie_talk_a.mp3</span>
│       　　<span style="color:#e8607a">　　20%　「はい、何なりと」</span>　<span style="color:#27ae60">sophie_talk_b.mp3</span>
│       　　<span style="color:#e8607a">　　20%　「はい、わたくしと、お話ししてくださるんですか？」</span>　<span style="color:#27ae60">sophie_talk_c.mp3</span>
│       　　<span style="color:#e8607a">　　10%　「はい、何でもお気兼ねなくおっしゃってください」</span>　<span style="color:#27ae60">sophie_talk_r.mp3</span>
│       ├─ R1　いいお店を探す：入力フォーム　🔑
│       │       　　<span style="color:#e8607a">Ｔ　0.5秒後</span>
│       │       　　<span style="color:#e8607a">　　50%　「はい、一緒にいいお店、探しましょう」</span>　<span style="color:#27ae60">sophie_rest_a.mp3</span>
│       │       　　<span style="color:#e8607a">　　20%　「どんな気分の夜ですか？」</span>　<span style="color:#27ae60">sophie_rest_b.mp3</span>
│       │       　　<span style="color:#e8607a">　　20%　「美味しいお店なら、結構知ってます」</span>　<span style="color:#27ae60">sophie_rest_c.mp3</span>
│       │       　　<span style="color:#e8607a">　　10%　「いい店見つけたら、こんど連れてってくださいね」</span>　<span style="color:#27ae60">sophie_rest_r.mp3</span>
│       │       　　<span style="color:#4a9eff">ゲストタップ時</span>　→　<span style="color:#e8607a">Ｔ</span>　<span style="color:#27ae60">guest_login_01.mp3</span>
│       │       └─ R2　検索結果（第1・第2候補）
│       ├─ F1　ソフィーの天命診断 メニュー　🔑
│       │       　　<span style="color:#e8607a">Ｔ　1秒後</span>
│       │       　　<span style="color:#e8607a">　　50%　「さあ、一緒に天命を覗いてみましょうか」</span>　<span style="color:#27ae60">sophie_fortune_a.mp3</span>
│       │       　　<span style="color:#e8607a">　　20%　「はい、わたくしの占い、結構当たるんですよ」</span>　<span style="color:#27ae60">sophie_fortune_b.mp3</span>
│       │       　　<span style="color:#e8607a">　　20%　「運命の羅針盤、そっと開きますね」</span>　<span style="color:#27ae60">sophie_fortune_c.mp3</span>
│       │       　　<span style="color:#e8607a">　　10%　「占いは……わたくしも、少し緊張するんです。真剣ですから」</span>　<span style="color:#27ae60">sophie_fortune_r.mp3</span>
│       │       　　<span style="color:#4a9eff">ゲストタップ時</span>　→　<span style="color:#e8607a">Ｔ</span>　<span style="color:#27ae60">guest_login_01.mp3</span>
│       │       ├─ F2　人物帳
│       │       ├─ F3a　あなたのご相談：フォーム
│       │       │       └─ F4　鑑定結果（命式表付き）　👑
│       │       ├─ F3b　あの人どんな人：フォーム
│       │       │       └─ F4　鑑定結果　👑
│       │       └─ F3c　相性を見てもらう：フォーム
│       │               └─ F4　鑑定結果　👑
│       ├─ K1　この日どんな日　🔑
│       │       　　<span style="color:#4a9eff">ゲストタップ時</span>　→　<span style="color:#e8607a">Ｔ</span>　<span style="color:#27ae60">guest_login_01.mp3</span>
│       │       　　データ：this_day_history.json（366日・2348件）
│       │       　　起動時に当日（MM-DD）のエントリを自動表示
│       │       ├─ 日付ナビゲーション
│       │       │       　　◀ / ▶ ボタンで前日・翌日に切り替え
│       │       │       　　「今日に戻る」ボタン（当日以外に表示）
│       │       │       　　📅 タイトル部タップ → スマホ標準日付ピッカー
│       │       └─ 出来事カード（年降順、BC年は末尾）
│       │               　　年・タイトル表示
│       │               　　説明文あり → ▼ タップで展開 / ▲ で折りたたみ
│       │               　　説明文なし → タップ不可
│       ├─ J1　じゃんけん勝負　🆓
│       └─ <span style="color:#4a9eff">このお店のご案内</span>　→ P1（showGuideScreen）　🆓　← 常時ヒントボタンからも到達可
│
├─ S1　音楽リクエスト：歌手リスト　🆓
│       　　<span style="color:#e8607a">Ｔ　1秒後</span>
│       　　<span style="color:#e8607a">　　50%　「はい、音楽ですね」</span>　<span style="color:#27ae60">sophie_music_a.mp3</span>
│       　　<span style="color:#e8607a">　　20%　「いい曲選んでくださいね」</span>　<span style="color:#27ae60">sophie_music_b.mp3</span>
│       　　<span style="color:#e8607a">　　20%　「どんな音楽の気分ですか？」</span>　<span style="color:#27ae60">sophie_music_c.mp3</span>
│       　　<span style="color:#e8607a">　　10%　「私も何か聞きたいです。」</span>　<span style="color:#27ae60">sophie_music_r.mp3</span>
│       └─ S2　曲リスト（タップで再生）
│               　　<span style="color:#e8607a">Ｔ　1.5秒後</span>
│               　　<span style="color:#e8607a">　　50%　「どの曲にされますか？」</span>　<span style="color:#27ae60">sophie_song_a.mp3</span>
│               　　<span style="color:#e8607a">　　20%　「さあ、どうしましょう？」</span>　<span style="color:#27ae60">sophie_song_b.mp3</span>
│               　　<span style="color:#e8607a">　　20%　「いい曲ばかりで、迷いますね」</span>　<span style="color:#27ae60">sophie_song_c.mp3</span>
│               　　<span style="color:#e8607a">　　10%　「今日の気分はどれですか？」</span>　<span style="color:#27ae60">sophie_song_r.mp3</span>
│
├─ X　お酒を探す／お酒の話（統合ボタン → 選択サブメニュー）
│       ├─ L1　お酒を探す　🆓
│       │       　　<span style="color:#e8607a">Ｔ　1秒後</span>
│       │       　　<span style="color:#e8607a">　　50%　「ジャンルから、お好みから、お選びいただけます」</span>　<span style="color:#27ae60">sophie_find_a.mp3</span>
│       │       　　<span style="color:#e8607a">　　20%　「今夜の一杯、一緒に探しましょう」</span>　<span style="color:#27ae60">sophie_find_b.mp3</span>
│       │       　　<span style="color:#e8607a">　　20%　「もうすぐ私があなた様とお話しして選べるようになります」</span>　<span style="color:#27ae60">sophie_find_c.mp3</span>
│       │       　　<span style="color:#e8607a">　　10%　「あなた様の好みを覚えておきたいので、ぜひ教えてください」</span>　<span style="color:#27ae60">sophie_find_r.mp3</span>
│       │       ├─ L2a　大分類表
│       │       │       └─ L3a　中分類表
│       │       │               └─ L4a　銘柄リスト
│       │       │                       └─ LT　銘柄カード
│       │       ├─ L2b　スクリーニング表
│       │       │       └─ L3b　検索結果 ─→ LT
│       │       └─ L2c　ID直接入力 ─→ LT
│       └─ N1　お酒の話：ジャンルリスト　🆓
│               　　<span style="color:#e8607a">Ｔ　1秒後</span>
│               　　<span style="color:#e8607a">　　50%　「どのジャンルの話をいたしましょうか？」</span>　<span style="color:#27ae60">sophie_sake_a.mp3</span>
│               　　<span style="color:#e8607a">　　20%　「ご興味は？」</span>　<span style="color:#27ae60">sophie_sake_b.mp3</span>
│               　　<span style="color:#e8607a">　　20%　「お酒も色々ですからね」</span>　<span style="color:#27ae60">sophie_sake_c.mp3</span>
│               　　<span style="color:#e8607a">　　10%　「私の得意はカクテルです」</span>　<span style="color:#27ae60">sophie_sake_r.mp3</span>
│               └─ N2　サブジャンルリスト
│                       └─ N3　話タイトル（記事本文）
│
└─ W　NEWS・マーケット　🆓
        　　<span style="color:#e8607a">Ｔ　0.5秒後</span>
        　　<span style="color:#e8607a">　　50%　「最新の情報ですね」</span>　<span style="color:#27ae60">sophie_news_a.mp3</span>
        　　<span style="color:#e8607a">　　20%　「世の中の動き、まとめてます」</span>　<span style="color:#27ae60">sophie_news_b.mp3</span>
        　　<span style="color:#e8607a">　　20%　「今夜の世界の話題ですね」</span>　<span style="color:#27ae60">sophie_news_c.mp3</span>
        　　<span style="color:#e8607a">　　10%　「情報の海に漕ぎ出しますか？」</span>　<span style="color:#27ae60">sophie_news_r.mp3</span>
        ├─ W1　テレ朝NEWS24（YouTube）
        ├─ W2　ライブカメラ（国内4・海外6）
        ├─ W3　マーケット（TradingView / 株価検索）
        ├─ W4　ニュース記事リンク群
        └─ W5　便利情報リンク群

---

## コンソール（固定）

　　ソフィーおすすめSHOP（Amazonショップ）　🆓　← nav.state=none 時のみ表示
　　ソフィーノート ─→ M1

M1　お客様ノート：フォルダ選択　🔑
        　　<span style="color:#e8607a">Ｔ　0.5秒後</span>
        　　<span style="color:#e8607a">　　50%　「ノート、こうなってます」</span>　<span style="color:#27ae60">sophie_note_a.mp3</span>
        　　<span style="color:#e8607a">　　20%　「ノートを開きますね」</span>　<span style="color:#27ae60">sophie_note_b.mp3</span>
        　　<span style="color:#e8607a">　　20%　「あなた様の歴史ですね」</span>　<span style="color:#27ae60">sophie_note_c.mp3</span>
        　　<span style="color:#e8607a">　　10%　「ノートを見ると、あなた様のことが少しわかった気がします」</span>　<span style="color:#27ae60">sophie_note_r.mp3</span>
        ├─ M2a　お好きな歌（お気に入り曲・マイプレイリスト）
        ├─ M2b　お好きなお酒（お気に入り銘柄）
        ├─ M2c　気になるお店
        ├─ M2d　ソフィーとの記録（じゃんけん履歴）
        └─ M2e　バックアップ・復元

---

## ヘッダー（常時表示）

P1　ご利用案内（showGuideScreen / guide.js）
　　← O「このお店のご案内」から／カウンター常時ヒントボタンから／ゲスト来店ダイアログ「はい」から
        　　<span style="color:#e8607a">Ｔ　画面表示と同時に自動再生</span>
        　　<span style="color:#e8607a">　　ゲスト</span>　<span style="color:#27ae60">guide_guest.mp3</span>
        　　<span style="color:#e8607a">　　無料会員</span>　<span style="color:#27ae60">guide_member.mp3</span>
        　　<span style="color:#e8607a">　　プレミアム</span>　<span style="color:#27ae60">guide_premium.mp3</span>
P2　マイページ showMyPage()　　　　← ログイン済みユーザー名タップ
        └─ （free時のみ）Stripe決済 ─→ P2更新（activeへ）

---

## 備考
- **LT** は L2a/L2b/L2c どこからでも到達
- **F4** は F3a / F3b / F3c 共通の結果画面
- **P1** は O「このお店のご案内」・カウンター常時ヒントボタン・ゲスト来店ダイアログから到達
- **X（お酒を探す／お酒の話）** は C ルートの統合ボタンから L1・N1 を選択する中間メニュー
- **SHOP**（コンソール）は nav.state=none 時のみフッターに表示、それ以外はソフィーノートに差し替え
- **K1（この日どんな日）** データは `this_day_history.json`（`kono_hi_data.csv` から変換）。カテゴリ①〜⑨は数値変換、BC年対応、年降順ソート。
- **音声ファイル命名規則**：`sophie_${screen}_${code}.mp3`（a=50%、b=20%、c=20%、r=10% ／ counter・entry のみ a=70%・b=30% ／ nc=新規ユーザー24h以内）
