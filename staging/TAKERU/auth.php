<?php
// ============================================================
// auth.php — Googleサインインの検証＋メール登録
//   クライアントから Google の IDトークン(credential) を受け取り、
//   Google に照会して本物か検証 → メールアドレスだけ保存する。
//   （名前・写真は受け取っても保存しない方針）
//   保存先 logs/members.csv は logs/.htaccess で外部非公開。
// ============================================================
date_default_timezone_set('Asia/Tokyo');
header('Content-Type: application/json; charset=utf-8');

const CLIENT_ID = '1006540175144-6mp05gm3hci79jvdkj10hlbvqnrvisuf.apps.googleusercontent.com';

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
$action = isset($data['action']) ? (string)$data['action'] : '';

// --- 登録解除（自分で配信停止できるように）---
//   ベータ用の軽実装。指定メールを一覧から削除する。
//   ※本番では、なりすまし削除を防ぐため Google 再認証を要求する形に締める予定。
if ($action === 'unregister') {
    $email = strtolower(trim((string)($data['email'] ?? '')));
    if ($email === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'no_email']);
        exit;
    }
    $file = __DIR__ . '/logs/members.csv';
    if (is_file($file)) {
        $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (is_array($lines)) {
            $kept = [];
            foreach ($lines as $line) {
                $c = explode(',', $line);
                if (!(isset($c[1]) && strtolower(trim($c[1])) === $email)) { $kept[] = $line; }
            }
            @file_put_contents($file, $kept ? implode("\n", $kept) . "\n" : '', LOCK_EX);
        }
    }
    echo json_encode(['ok' => true]);
    exit;
}

$token = isset($data['credential']) ? (string)$data['credential'] : '';
if ($token === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'no_token']);
    exit;
}

// --- Google の tokeninfo で検証（署名・有効期限はGoogle側で確認済みの内容が返る）---
$url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($token);
$body = false;
$httpCode = 0;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $body = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
} else {
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'ignore_errors' => true]]);
    $body = @file_get_contents($url, false, $ctx);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $httpCode = (int)$m[1];
    } elseif ($body !== false) {
        $httpCode = 200;
    }
}

if ($body === false || $httpCode !== 200) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'verify_failed']);
    exit;
}
$claims = json_decode($body, true);
if (!is_array($claims)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'bad_claims']);
    exit;
}

// --- 中身の確認：宛先(aud)が自分のアプリか／発行者／メール確認済みか ---
$iss = $claims['iss'] ?? '';
$aud = $claims['aud'] ?? '';
$email = trim((string)($claims['email'] ?? ''));
$ev = $claims['email_verified'] ?? '';
$emailVerified = ($ev === true || $ev === 'true' || $ev === 1 || $ev === '1');
$issOk = in_array($iss, ['accounts.google.com', 'https://accounts.google.com'], true);

if ($aud !== CLIENT_ID || !$issOk || $email === '' || !$emailVerified) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'invalid_token']);
    exit;
}

// --- メールだけ保存（重複しない）。名前・写真は保存しない ---
$dir = __DIR__ . '/logs';
if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
$file = $dir . '/members.csv';
$emailLc = strtolower($email);

$exists = false;
if (is_file($file)) {
    $fh = @fopen($file, 'r');
    if ($fh) {
        while (($line = fgets($fh)) !== false) {
            $cols = explode(',', trim($line));
            if (isset($cols[1]) && strtolower(trim($cols[1])) === $emailLc) { $exists = true; break; }
        }
        fclose($fh);
    }
}
if (!$exists) {
    @file_put_contents($file, date('Y-m-d H:i') . ',' . $emailLc . "\n", FILE_APPEND | LOCK_EX);
}

echo json_encode(['ok' => true, 'email' => $email, 'registered' => !$exists]);
