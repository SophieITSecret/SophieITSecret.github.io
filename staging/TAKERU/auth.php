<?php
// ============================================================
// auth.php — Googleサインインの検証＋メール登録／登録解除
//   クライアントから Google の IDトークン(credential) を受け取り、
//   Google に照会して本物か検証 → メールアドレスだけ保存する。
//   （名前・写真は受け取っても保存しない方針）
//   保存先 logs/members.csv は logs/.htaccess で外部非公開。
//
//   登録できたら「本人の印」(token) を返す。端末に置いてもらい、
//   登録解除のときに見せてもらう。印か Google の本人確認のどちらかが無いと
//   解除しない（以前はメールアドレスだけで誰でも他人の登録を消せた）。
//   印は メールアドレス を サーバーだけが持つ鍵 で HMAC したもの。
//   鍵は logs/auth_secret.txt（初回に自動で作る。外部非公開・gitに入らない）。
// ============================================================
date_default_timezone_set('Asia/Tokyo');
header('Content-Type: application/json; charset=utf-8');

const CLIENT_ID = '1006540175144-6mp05gm3hci79jvdkj10hlbvqnrvisuf.apps.googleusercontent.com';

$dir = __DIR__ . '/logs';
if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
$file = $dir . '/members.csv';

function fail($code, $error) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $error]);
    exit;
}

// サーバーだけが持つ鍵。無ければ作る。
function secret_key() {
    $f = __DIR__ . '/logs/auth_secret.txt';
    $k = is_file($f) ? trim((string)@file_get_contents($f)) : '';
    if (strlen($k) < 32) {
        $k = bin2hex(random_bytes(32));
        @file_put_contents($f, $k, LOCK_EX);
        @chmod($f, 0600);
    }
    return $k;
}
// 本人の印
function member_token($email) {
    return hash_hmac('sha256', 'member:' . strtolower(trim($email)), secret_key());
}

// Google の IDトークンを検証し、確認済みのメールアドレスを返す（だめなら null）
function verify_google($token) {
    if ($token === '') return null;
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
    if ($body === false || $httpCode !== 200) return null;
    $claims = json_decode($body, true);
    if (!is_array($claims)) return null;

    // 宛先(aud)が自分のアプリか／発行者／メール確認済みか
    $iss = $claims['iss'] ?? '';
    $aud = $claims['aud'] ?? '';
    $email = trim((string)($claims['email'] ?? ''));
    $ev = $claims['email_verified'] ?? '';
    $emailVerified = ($ev === true || $ev === 'true' || $ev === 1 || $ev === '1');
    $issOk = in_array($iss, ['accounts.google.com', 'https://accounts.google.com'], true);
    if ($aud !== CLIENT_ID || !$issOk || $email === '' || !$emailVerified) return null;
    return $email;
}

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) $data = [];
$action = isset($data['action']) ? (string)$data['action'] : '';

// --- 登録解除（本人が自分で配信停止できるように）---
if ($action === 'unregister') {
    $email = strtolower(trim((string)($data['email'] ?? '')));
    $token = (string)($data['token'] ?? '');
    $cred  = (string)($data['credential'] ?? '');

    // 本人確認：印が合うか、Google で確かめたメールが一致するか
    $ok = false;
    if ($email !== '' && $token !== '' && hash_equals(member_token($email), $token)) {
        $ok = true;
    } elseif ($cred !== '') {
        $g = verify_google($cred);
        if ($g !== null) { $email = strtolower($g); $ok = true; }
    }
    if (!$ok) fail(403, 'need_verify');

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

// --- 登録 ---
$token = isset($data['credential']) ? (string)$data['credential'] : '';
if ($token === '') fail(400, 'no_token');
$email = verify_google($token);
if ($email === null) fail(401, 'invalid_token');

// メールだけ保存（重複しない）。名前・写真は保存しない
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

echo json_encode(['ok' => true, 'email' => $email, 'registered' => !$exists, 'token' => member_token($emailLc)]);
