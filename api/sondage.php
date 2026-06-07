<?php
// Sondage réinscription 2026-2027
// POST: enregistre une réponse
// GET ?action=results&adminPass=chefdechoeur: retourne toutes les réponses (admin)

// Empêche toute notice/warning PHP de corrompre la réponse JSON
@ini_set('display_errors', '0');
error_reporting(0);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$ADMIN_PASS = 'chefdechoeur';
$dataDir  = __DIR__ . '/../data';
$filePath = $dataDir . '/sondage.jsonl';

if (!is_dir($dataDir)) @mkdir($dataDir, 0775, true);
if (!file_exists($filePath)) @touch($filePath);

function sondage_read_lines($path) {
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

function sondage_write_line($path, $obj) {
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

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

// POST : enregistrement d'une réponse
if ($method === 'POST') {
  $raw     = file_get_contents('php://input');
  $payload = json_decode($raw, true);
  if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'bad_json']);
    exit;
  }
  $prenom       = trim($payload['prenom'] ?? '');
  $nom          = trim($payload['nom'] ?? '');
  $reinscription = isset($payload['reinscription']) ? (bool)$payload['reinscription'] : null;

  if ($prenom === '' || $nom === '' || $reinscription === null) {
    http_response_code(400);
    echo json_encode(['error' => 'missing_fields']);
    exit;
  }

  $record = [
    'prenom'       => $prenom,
    'nom'          => $nom,
    'reinscription' => $reinscription,
    'ts'           => date('c'),
    'ip'           => $_SERVER['REMOTE_ADDR'] ?? '',
  ];

  if ($reinscription) {
    // sous-questions horaires (null = non répondu)
    $record['lundi_20h_abe']    = isset($payload['lundi_20h_abe'])    ? (bool)$payload['lundi_20h_abe']    : null;
    $record['jeudi_19h30_abe']  = isset($payload['jeudi_19h30_abe'])  ? (bool)$payload['jeudi_19h30_abe']  : null;
    $record['seul_lundi_19h30'] = isset($payload['seul_lundi_19h30']) ? (bool)$payload['seul_lundi_19h30'] : null;
  }

  if (!sondage_write_line($filePath, $record)) {
    http_response_code(500);
    echo json_encode([
      'error' => 'write_failed',
      'path'  => $filePath,
      'dir_exists' => is_dir($dataDir),
      'dir_writable' => is_writable($dataDir),
    ]);
    exit;
  }
  echo json_encode(['ok' => true]);
  exit;
}

// GET ?action=results : résultats (admin uniquement)
if ($method === 'GET' && $action === 'results') {
  $hdrs     = function_exists('getallheaders') ? getallheaders() : [];
  $adminKey = $hdrs['X-Admin-Key'] ?? ($_GET['adminPass'] ?? '');
  if ($adminKey !== $ADMIN_PASS) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
  }
  $rows = sondage_read_lines($filePath);
  echo json_encode($rows, JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(404);
echo json_encode(['error' => 'not_found']);
