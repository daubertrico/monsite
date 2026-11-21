<?php
// Diagnostic basique pour vérifier PHP et l'écriture dans /data
header('Content-Type: text/html; charset=utf-8');
$dataDir = __DIR__ . '/../data';
$filePath = $dataDir . '/attendance.jsonl';
$profilesPath = $dataDir . '/profiles.jsonl';

function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

$results = [];
$results[] = ['label' => 'PHP version', 'value' => PHP_VERSION];
$results[] = ['label' => 'SAPI', 'value' => php_sapi_name()];
$results[] = ['label' => 'Data dir', 'value' => $dataDir, 'ok' => is_dir($dataDir)];
if (!is_dir($dataDir)) { @mkdir($dataDir, 0775, true); }
$results[] = ['label' => 'Data dir writable', 'value' => is_writable($dataDir) ? 'writable' : 'NOT WRITABLE', 'ok' => is_writable($dataDir)];
if (!file_exists($filePath)) { @touch($filePath); }
$results[] = ['label' => 'attendance.jsonl exists', 'value' => file_exists($filePath) ? 'yes' : 'no', 'ok' => file_exists($filePath)];
$results[] = ['label' => 'attendance.jsonl writable', 'value' => is_writable($filePath) ? 'writable' : 'NOT WRITABLE', 'ok' => is_writable($filePath)];
if (!file_exists($profilesPath)) { @touch($profilesPath); }
$results[] = ['label' => 'profiles.jsonl exists', 'value' => file_exists($profilesPath) ? 'yes' : 'no', 'ok' => file_exists($profilesPath)];
$results[] = ['label' => 'profiles.jsonl writable', 'value' => is_writable($profilesPath) ? 'writable' : 'NOT WRITABLE', 'ok' => is_writable($profilesPath)];

$writeOk = false; $writeErr = '';
if (is_writable($filePath)) {
  $fh = @fopen($filePath, 'a');
  if ($fh) {
    if (@flock($fh, LOCK_EX)) {
      $test = ['_diag' => true, 'ts' => date('c')];
      @fwrite($fh, json_encode($test, JSON_UNESCAPED_UNICODE) . PHP_EOL);
      @flock($fh, LOCK_UN);
      $writeOk = true;
    } else {
      $writeErr = 'flock failed';
    }
    @fclose($fh);
  } else {
    $writeErr = 'fopen failed';
  }
}
$results[] = ['label' => 'Append test line (attendance)', 'value' => $writeOk ? 'OK' : ('FAILED ' . $writeErr), 'ok' => $writeOk];

$writeOk2 = false; $writeErr2 = '';
if (is_writable($profilesPath)) {
  $fh = @fopen($profilesPath, 'a');
  if ($fh) {
    if (@flock($fh, LOCK_EX)) {
      $test = ['_diag_profile' => true, 'ts' => date('c')];
      @fwrite($fh, json_encode($test, JSON_UNESCAPED_UNICODE) . PHP_EOL);
      @flock($fh, LOCK_UN);
      $writeOk2 = true;
    } else {
      $writeErr2 = 'flock failed';
    }
    @fclose($fh);
  } else {
    $writeErr2 = 'fopen failed';
  }
}
$results[] = ['label' => 'Append test line (profiles)', 'value' => $writeOk2 ? 'OK' : ('FAILED ' . $writeErr2), 'ok' => $writeOk2];

?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Diagnostic backend</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f5f7fb; padding:20px; }
    .card { max-width: 680px; margin: 0 auto; background: #fff; border: 1px solid #dfe7f7; border-radius: 12px; padding: 16px 18px; box-shadow: 0 4px 18px #9ec5ff22; }
    h1 { font-size: 1.4em; margin: 6px 0 12px 0; }
    .row { display:flex; justify-content: space-between; gap:10px; padding:8px 0; border-bottom:1px solid #eef3ff; }
    .row:last-child { border-bottom:none; }
    .ok { color:#236d2e; font-weight:700; }
    .fail { color:#8b1a1a; font-weight:700; }
    .help { margin-top:12px; color:#345; font-size:0.95em; }
    a { color:#1967d2; }
  </style>
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  <div class="card">
    <h1>Diagnostic backend</h1>
    <?php foreach ($results as $r): ?>
      <div class="row">
        <div><?=h($r['label'])?></div>
        <div class="<?=isset($r['ok']) ? ($r['ok'] ? 'ok' : 'fail') : ''?>"><?=h($r['value'])?></div>
      </div>
    <?php endforeach; ?>

    <div class="help">
      • Tester l’API stats: <a href="attendance.php?action=stats&amp;calendar=test&amp;eventId=test" target="_blank" rel="noopener">attendance.php?action=stats&calendar=test&eventId=test</a><br>
      • Si “NOT WRITABLE”, corriger les droits sur le dossier <code><?=h($dataDir)?></code> et sur les fichiers.<br>
      • Si cette page s’affiche en texte brut ou se télécharge: PHP n’est pas activé sur l’hébergement.
    </div>
  </div>
</body>
</html>
