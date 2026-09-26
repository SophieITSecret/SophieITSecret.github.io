<?php
// ============================================================
// log.php — アクセスを1行だけ追記する。
//
//   記録するのは「日付・種別・番号」の3つだけ。
//   番号はカード番号／ニュースID／リンクIDのいずれか（種別で区別する）。
//   IPアドレス・Cookie・識別子は一切記録しない（誰が見たかは辿れない）。
//   目的は回数を数えることに限る。
//
//   生ログは logs/ に置き、logs/.htaccess で外部から遮断する。
// ============================================================
date_default_timezone_set('Asia/Tokyo');
header('Content-Type: application/json');

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
$type = isset($data['type']) ? (string)$data['type'] : '';
$code = isset($data['code']) ? (string)$data['code'] : '';

$allowed = ['top_view', 'pwa_installed', 'card_view', 'news_view', 'link_open'];
if (!in_array($type, $allowed, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

// 番号は英数字のみ・20文字まで。カード(SENSHI01)・ニュース(N0043)・
// リンク(111)のいずれもこの形に収まる。
// 誰でも叩ける口なので、長さの上限を設けて1行が膨らむのを防ぐ。
if ($code !== '' && !preg_match('/^[A-Za-z0-9]{1,20}$/', $code)) {
    $code = '';
}

$dir = __DIR__ . '/logs';
if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
}

// 月ごとにファイルを分ける。1本に溜め続けると集計が重くなるため。
$file = $dir . '/access-' . date('Y-m') . '.csv';
$line = date('Y-m-d') . ',' . $type . ',' . $code . "\n";
@file_put_contents($file, $line, FILE_APPEND | LOCK_EX);

echo json_encode(['ok' => true]);
