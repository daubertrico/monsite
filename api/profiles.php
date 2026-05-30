<?php
// Profiles storage API (file-based)
// POST: store/update a profile into data/profiles.jsonl
// GET ?action=download (admin): returns array of profiles

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';
$ADMIN_PASS = 'chefdechoeur';

$dataDir = __DIR__ . '/../data';
$filePath = $dataDir . '/profiles.jsonl';

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

if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  $payload = json_decode($raw, true);
  if (!is_array($payload)) { http_response_code(400); echo json_encode(['error'=>'bad_json']); exit; }
  $prenom = $payload['prenom'] ?? '';
  $nom = $payload['nom'] ?? '';
  $pupitre = $payload['pupitre'] ?? '';
  if (!$prenom || !$nom) { http_response_code(400); echo json_encode(['error'=>'missing_name']); exit; }
  $record = [
    'prenom' => $prenom,
    'nom' => $nom,
    'pupitre' => $pupitre,
    'prenom_norm' => norm($prenom),
    'nom_norm' => norm($nom),
    'ts' => $payload['ts'] ?? date('c'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? ''
  ];
  if (!write_json_line($filePath, $record)) { http_response_code(500); echo json_encode(['error'=>'write_failed']); exit; }
  echo json_encode(['ok'=>true]);
  exit;
}

if ($method === 'GET' && $action === 'download') {
  if (!is_admin($ADMIN_PASS)) { http_response_code(403); echo json_encode(['error'=>'forbidden']); exit; }
  $rows = read_json_lines($filePath);
  header('Content-Type: application/json; charset=utf-8');
  header('Content-Disposition: attachment; filename="profiles.json"');
  echo json_encode($rows, JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(404);
echo json_encode(['error'=>'not_found']);
