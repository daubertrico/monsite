<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON']);
    exit;
}

// expected format: object mapping keys -> {soul: bool, lv: bool}
$vis = $data;

$partitionsPath = __DIR__ . '/../data/partitions.json';
$backupPath = __DIR__ . '/../data/partitions-with-visibility.json';

if (!file_exists($partitionsPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'partitions.json not found']);
    exit;
}

$partsRaw = file_get_contents($partitionsPath);
$parts = json_decode($partsRaw, true);
if (!is_array($parts)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Invalid partitions.json']);
    exit;
}

// normalisation function similar to client simplifyKey
function simplifyKey($s) {
    if ($s === null) return '';
    $s = mb_strtolower(trim($s));
    // transliterate accents
    $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    // remove non-alphanumeric and collapse spaces
    $s = preg_replace('/[^a-z0-9 ]+/', '', $s);
    $s = preg_replace('/\s+/', ' ', $s);
    return $s;
}

$updated = 0;
foreach ($parts as $i => $p) {
    $title = isset($p['title']) ? $p['title'] : null;
    $k = simplifyKey($title);
    if (isset($vis[$k]) && is_array($vis[$k])) {
        $entry = $vis[$k];
        // accept either 'lv' or 'lavoixlibre' or 'lavoix' keys if present
        $soul = isset($entry['soul']) ? (bool)$entry['soul'] : (isset($entry['visible_soul']) ? (bool)$entry['visible_soul'] : null);
        $lv = isset($entry['lv']) ? (bool)$entry['lv'] : (isset($entry['visible_lavoixlibre']) ? (bool)$entry['visible_lavoixlibre'] : null);
        if ($soul !== null) $parts[$i]['visible_soul'] = $soul;
        if ($lv !== null) $parts[$i]['visible_lavoixlibre'] = $lv;
        $updated++;
    }
}

$out = json_encode($parts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
// attempt to write back to original file; if fails, write to backup
$wrote = @file_put_contents($partitionsPath, $out);
if ($wrote === false) {
    $wrote2 = @file_put_contents($backupPath, $out);
    if ($wrote2 === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to write partitions file']);
        exit;
    } else {
        echo json_encode(['ok' => true, 'message' => 'Saved to backup file', 'updated' => $updated, 'path' => basename($backupPath)]);
        exit;
    }
} else {
    echo json_encode(['ok' => true, 'message' => 'Saved', 'updated' => $updated, 'path' => basename($partitionsPath)]);
    exit;
}

?>
