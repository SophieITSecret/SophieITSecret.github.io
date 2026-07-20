<?php
// ============================================================
// summarize.php — 生ログを日次・カード別に集計する。
//   cron で1日1回動かす前提（毎回全行を読み直すため、生ログは月ごとに分割済み）。
//
//   出力: logs/daily_summary.json  日付 => {top_view, pwa_installed, card_view}
//         logs/card_summary.json   カード番号 => 累計閲覧回数（多い順）
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

$daily = [];   // 日付 => 種別ごとの件数
$cards = [];   // カード番号 => 累計回数

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
            $daily[$date] = ['top_view' => 0, 'pwa_installed' => 0, 'card_view' => 0];
        }
        // 想定外の種別は数えない（不正な書き込みで列が増えるのを防ぐ）
        if (isset($daily[$date][$type])) {
            $daily[$date][$type]++;
        }
        if ($type === 'card_view' && $code !== '') {
            $cards[$code] = (isset($cards[$code]) ? $cards[$code] : 0) + 1;
        }
    }
    fclose($fh);
}

ksort($daily);    // 日付順
arsort($cards);   // よく読まれた順

$flags = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
file_put_contents($dir . '/daily_summary.json', json_encode($daily, $flags));
file_put_contents($dir . '/card_summary.json',  json_encode($cards, $flags));

echo 'done ' . date('Y-m-d H:i')
   . '  日数=' . count($daily)
   . '  カード=' . count($cards)
   . '  ログ=' . count($files) . "本\n";
