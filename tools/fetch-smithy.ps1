# Hakee sepän pihapiirin (assets/smithy.glb) lähdetekstuurit Poly Havenista (CC0)
# kansioon assets-src/_downloads/. Kansio ei ole Gitissä. Blender-skriptit lukevat
# pääkansion (C:\Data\3D Kalevala) latauksia, joten työpuusta ajettaessa anna -Root.
#
#   powershell -File tools/fetch-smithy.ps1 [-Root "C:\Data\3D Kalevala"]

param([string]$Root = (Join-Path $PSScriptRoot ".."))

$ErrorActionPreference = "Stop"
$ua = "asset-fetch/1.0"
$dl = Join-Path $Root "assets-src\_downloads"

function Get-File($url, $dest) {
  if (Test-Path $dest) { return }
  New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
  Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent $ua
}

# Palanut maa (pajan lattia), ladottu luonnonkivi (ahjo ja kiviseinä).
foreach ($id in 'burned_ground_01', 'stacked_stone_wall') {
  $f = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$id" -UserAgent $ua
  $dir = Join-Path $dl "tex_$id"
  foreach ($m in 'Diffuse', 'nor_gl') {
    $e = $f.$m.'1k'.jpg
    Get-File $e.url (Join-Path $dir "${id}_${m}_1k.jpg")
  }
  "tekstuuri $id"
}
