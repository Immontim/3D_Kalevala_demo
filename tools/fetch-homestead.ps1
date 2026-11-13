# Hakee pihapiirin (assets/homestead.glb) lähdetekstuurit Poly Havenista (CC0)
# kansioon assets-src/_downloads/. Kansio ei ole Gitissä.
#
#   powershell -File tools/fetch-homestead.ps1

$ErrorActionPreference = "Stop"
$ua = "homestead-asset-fetch/1.0"
$root = Join-Path $PSScriptRoot "..\assets-src\_downloads"

function Get-File($url, $dest) {
  if (Test-Path $dest) { return }
  New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
  Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent $ua
}

# Olki- ja ruokokate, savirappaus (punosseinän savitiiviste).
foreach ($id in 'thatch_roof_angled', 'reed_roof_03', 'clay_plaster') {
  $f = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$id" -UserAgent $ua
  $dir = Join-Path $root "tex_$id"
  foreach ($m in 'Diffuse', 'nor_gl') {
    $e = $f.$m.'1k'.jpg
    Get-File $e.url (Join-Path $dir "${id}_${m}_1k.jpg")
  }
  "tekstuuri $id"
}
