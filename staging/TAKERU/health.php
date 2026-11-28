<?php
// ============================================================
// health.php — 見張り番（Google の GAS）が読む「様子の窓」2026-11-19
//   読むだけ。返すのは日付と版だけ。個人情報・秘密は返さない（logs/members.csv・auth_secret.txt などは読まない）。
//   見張り番の中身は editor/watch/Code.gs。ここで返す項目を変えたら、そちらも直す。
// ============================================================
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
date_default_timezone_set('Asia/Tokyo');

$d = __DIR__;
$mtime = function ($rel) use ($d) {
    $p = $d . '/' . $rel;
    return is_file($p) ? date('Y-m-d H:i', filemtime($p)) : '';
};

// アプリの版（sw.js の SW_VERSION）
$version = '';
$sw = @file_get_contents($d . '/sw.js');
if ($sw !== false && preg_match("/SW_VERSION\\s*=\\s*'([^']+)'/", $sw, $m)) {
    $version = $m[1];
}

// 閲覧の集計（summarize.php が1日1回書く）の、いちばん新しい日付
$summaryLast = '';
$s = @file_get_contents($d . '/logs/daily_summary.json');
if ($s !== false) {
    $j = json_decode($s, true);
    if (is_array($j) && $j) {
        $keys = array_keys($j);
        sort($keys);
        $summaryLast = (string) end($keys);
    }
}

echo json_encode([
    'ok'                 => true,
    'now'                => date('Y-m-d H:i'),
    'version'            => $version,
    'cards_csv'          => $mtime('TAKERUcard.csv'),
    'news_csv'           => $mtime('news.csv'),
    'summary_last_date'  => $summaryLast,
    'summary_updated'    => $mtime('logs/daily_summary.json'),
    'access_log_updated' => $mtime('logs/access-' . date('Y-m') . '.csv'),
], JSON_UNESCAPED_UNICODE);
