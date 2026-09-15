<?php
// ============================================================
// summarize.php — 生ログを日次・カード別に集計する。
//   cron で1日1回動かす前提（毎回全行を読み直すため、生ログは月ごとに分割済み）。
//
//   出力: logs/daily_summary.json  日付 => {top_view, pwa_installed, card_view, news_view, link_open}
//         logs/card_summary.json   カード番号 => 累計閲覧回数（多い順）
//         logs/card_daily.json     日付 => {カード番号 => その日の回数}（全期間）
//         logs/news_summary.json   ニュースID => 累計閲覧回数（多い順）
//         logs/link_summary.json   リンクID  => 累計クリック回数（多い順）
//
//   どちらも logs/ の中に置くので外部からは読めない。
//   作業台へはSSH経由で取得する（公開せずに手元へ落とす）。
// ============================================================
date_default_timezone_set('Asia/Tokyo');

$dir   = __DIR__ . '/logs';
$files = glob($dir . '/access-*.csv');
if ($files === false) {
    $files = [];
}

$daily = [];       // 日付 => 種別ごとの件数
$cards = [];       // カード番号 => 累計回数
$cardDaily = [];   // 日付 => { カード番号 => その日の回数 }
$news  = [];       // ニュースID => 累計回数
$links = [];       // リンクID   => 累計回数

foreach ($files as $f) {
    $fh = @fopen($f, 'r');
    if (!$fh) {
        continue;
    }
    // 1行ずつ読む。ファイル全体をメモリに載せないため。
    while (($line = fgets($fh)) !== false) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        $parts = array_pad(explode(',', $line), 3, '');
        $date = $parts[0];
        $type = $parts[1];
        $code = $parts[2];
        if ($date === '' || $type === '') {
            continue;
        }
        if (!isset($daily[$date])) {
            $daily[$date] = ['top_view' => 0, 'pwa_installed' => 0, 'card_view' => 0,
                             'news_view' => 0, 'link_open' => 0];
        }
        // 想定外の種別は数えない（不正な書き込みで列が増えるのを防ぐ）
        if (isset($daily[$date][$type])) {
            $daily[$date][$type]++;
        }
        if ($type === 'news_view' && $code !== '') {
            $news[$code] = (isset($news[$code]) ? $news[$code] : 0) + 1;
        }
        if ($type === 'link_open' && $code !== '') {
            $links[$code] = (isset($links[$code]) ? $links[$code] : 0) + 1;
        }
        if ($type === 'card_view' && $code !== '') {
            $cards[$code] = (isset($cards[$code]) ? $cards[$code] : 0) + 1;
            // 日付×カードの内訳（0は持たない疎な形で全期間ぶん残す）
            if (!isset($cardDaily[$date])) { $cardDaily[$date] = []; }
            $cardDaily[$date][$code] = (isset($cardDaily[$date][$code]) ? $cardDaily[$date][$code] : 0) + 1;
        }
    }
    fclose($fh);
}

ksort($daily);      // 日付順
arsort($cards);     // よく読まれた順
arsort($news);      // よく読まれた記事順
arsort($links);     // よく押されたリンク順
ksort($cardDaily);  // 日付順

$flags = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
file_put_contents($dir . '/daily_summary.json', json_encode($daily, $flags));
file_put_contents($dir . '/card_summary.json',  json_encode($cards, $flags));
// card_daily.json … { "YYYY-MM-DD": { "CODE": 回数, ... }, ... } 全期間ぶん
file_put_contents($dir . '/card_daily.json',    json_encode($cardDaily, $flags));
file_put_contents($dir . '/news_summary.json', json_encode($news,  $flags | JSON_FORCE_OBJECT));
// この2本はオブジェクトを強制する。空のときPHPは [] を書き、リンクIDは
// 数字なので整数キーになって配列に化けうる。読む側を常に同じ形で扱えるように。
file_put_contents($dir . '/link_summary.json', json_encode($links, $flags | JSON_FORCE_OBJECT));

echo 'done ' . date('Y-m-d H:i')
   . '  日数=' . count($daily)
   . '  カード=' . count($cards)
   . '  日別=' . count($cardDaily)
   . '  ニュース=' . count($news)
   . '  リンク=' . count($links)
   . '  ログ=' . count($files) . "本\n";
