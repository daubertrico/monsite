<?php
// Simple attendance storage API (file-based)
// POST: store a record into data/attendance.jsonl
// GET ?action=stats&calendar=...&eventId=...: returns { present: [...], absent: [...] }

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'GET' ? 'stats' : '');
$ADMIN_PASS = 'chefdechoeur';

$dataDir = __DIR__ . '/../data';
$filePath = $dataDir . '/attendance.jsonl';

if (!is_dir($dataDir)) {
  @mkdir($dataDir, 0775, true);
}
if (!file_exists($filePath)) {
  @touch($filePath);
}

function read_json_lines($path) {
  $fh = @fopen($path, 'r');
  if (!$fh) return [];
  $rows = [];
  while (!feof($fh)) {
    $line = fgets($fh);
    if ($line === false) break;
    $line = trim($line);
    if ($line === '') continue;
    $obj = json_decode($line, true);
    if (is_array($obj)) $rows[] = $obj;
  }
  fclose($fh);
  return $rows;
}

function write_json_line($path, $obj) {
  $json = json_encode($obj, JSON_UNESCAPED_UNICODE);
  $fh = fopen($path, 'a');
  if (!$fh) return false;
  if (!flock($fh, LOCK_EX)) { fclose($fh); return false; }
  fwrite($fh, $json . PHP_EOL);
  fflush($fh);
  flock($fh, LOCK_UN);
  fclose($fh);
  return true;
}

function is_admin($ADMIN_PASS) {
  $hdrs = function_exists('getallheaders') ? getallheaders() : [];
  $key = '';
  if (!empty($hdrs['X-Admin-Key'])) $key = $hdrs['X-Admin-Key'];
  if (!$key && isset($_POST['adminPass'])) $key = $_POST['adminPass'];
  if (!$key && isset($_GET['adminPass'])) $key = $_GET['adminPass'];
  return $key === $ADMIN_PASS;
}

function norm($s) {
  $s = is_string($s) ? $s : '';
  $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
  $s = strtolower(trim($s));
  return preg_replace('/\s+/', ' ', $s);
}

if ($method === 'POST' && $action !== 'purge') {
  $raw = file_get_contents('php://input');
  $payload = json_decode($raw, true);
  if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'bad_json']);
    exit;
  }
  // Validate minimal fields
  $calendar = $payload['calendar'] ?? '';
  $eventId = $payload['eventId'] ?? '';
  $status = $payload['status'] ?? '';
  $choriste = $payload['choriste'] ?? [];
  if (!in_array($status, ['present','absent'], true) || !$calendar || !$eventId) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_parameters']);
    exit;
  }
  $record = [
    'calendar' => $calendar,
    'eventId' => $eventId,
    'status' => $status,
    'choriste' => [
      'prenom' => $choriste['prenom'] ?? '',
      'nom' => $choriste['nom'] ?? '',
      'pupitre' => $choriste['pupitre'] ?? '',
      'prenom_norm' => $choriste['prenom_norm'] ?? norm($choriste['prenom'] ?? ''),
      'nom_norm' => $choriste['nom_norm'] ?? norm($choriste['nom'] ?? ''),
    ],
    'ts' => $payload['ts'] ?? date('c'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? ''
  ];
  if (!write_json_line($filePath, $record)) {
    http_response_code(500);
    echo json_encode(['error' => 'write_failed']);
    exit;
  }
  echo json_encode(['ok' => true]);
  exit;
}

// GET actions
if ($action === 'stats') {
  // Optional: restrict stats to admin only. Uncomment next line to require admin
  // if (!is_admin($ADMIN_PASS)) { http_response_code(403); echo json_encode(['error'=>'forbidden']); exit; }
  $calendar = $_GET['calendar'] ?? '';
  $eventId = $_GET['eventId'] ?? '';
  if (!$calendar || !$eventId) {
    http_response_code(400);
    echo json_encode(['error' => 'missing_parameters']);
    exit;
  }
  $rows = read_json_lines($filePath);
  // Keep only last status per person for this event
  $byPerson = [];
  foreach ($rows as $row) {
    if (($row['calendar'] ?? '') !== $calendar) continue;
    if (($row['eventId'] ?? '') !== $eventId) continue;
    $c = $row['choriste'] ?? [];
    $key = ($c['prenom_norm'] ?? '') . '|' . ($c['nom_norm'] ?? '');
    $time = strtotime($row['ts'] ?? 'now');
    if (!isset($byPerson[$key]) || $time >= ($byPerson[$key]['_time'] ?? 0)) {
      $byPerson[$key] = [
        'status' => $row['status'] ?? '',
        'prenom' => $c['prenom'] ?? '',
        'nom' => $c['nom'] ?? '',
        'pupitre' => $c['pupitre'] ?? '',
        '_time' => $time
      ];
    }
  }
  $present = [];
  $absent = [];
  foreach ($byPerson as $p) {
    $entry = [ 'prenom' => $p['prenom'], 'nom' => $p['nom'], 'pupitre' => $p['pupitre'] ];
    if ($p['status'] === 'present') $present[] = $entry; else if ($p['status'] === 'absent') $absent[] = $entry;
  }
  echo json_encode(['present' => $present, 'absent' => $absent], JSON_UNESCAPED_UNICODE);
  exit;
}

// Admin: download full data
if ($action === 'download') {
  if (!is_admin($ADMIN_PASS)) { http_response_code(403); echo json_encode(['error'=>'forbidden']); exit; }
  $rows = read_json_lines($filePath);
  header('Content-Type: application/json; charset=utf-8');
  header('Content-Disposition: attachment; filename="attendance.json"');
  echo json_encode($rows, JSON_UNESCAPED_UNICODE);
  exit;
}

// Admin: purge one event
if ($method === 'POST' && $action === 'purge') {
  if (!is_admin($ADMIN_PASS)) { http_response_code(403); echo json_encode(['error'=>'forbidden']); exit; }
  $raw = file_get_contents('php://input');
  $payload = json_decode($raw, true);
  $calendar = $payload['calendar'] ?? '';
  $eventId = $payload['eventId'] ?? '';
  if (!$calendar || !$eventId) { http_response_code(400); echo json_encode(['error'=>'missing_parameters']); exit; }
  $rows = read_json_lines($filePath);
  $kept = [];
  foreach ($rows as $row) {
    if (($row['calendar'] ?? '') === $calendar && ($row['eventId'] ?? '') === $eventId) {
      continue; // drop
    }
    $kept[] = $row;
  }
  // Rewrite file
  $tmp = $filePath . '.tmp';
  $fh = fopen($tmp, 'w');
  if (!$fh) { http_response_code(500); echo json_encode(['error'=>'open_tmp_failed']); exit; }
  foreach ($kept as $obj) {
    fwrite($fh, json_encode($obj, JSON_UNESCAPED_UNICODE) . PHP_EOL);
  }
  fclose($fh);
  if (!@rename($tmp, $filePath)) { @unlink($tmp); http_response_code(500); echo json_encode(['error'=>'replace_failed']); exit; }
  echo json_encode(['ok'=>true, 'removed'=> (count($rows) - count($kept))]);
  exit;
}

http_response_code(404);
echo json_encode(['error' => 'not_found']);
