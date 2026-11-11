# Hakee hahmojen lähdeassetit kansioon assets-src/_downloads/ (ei Gitissä):
#  - Blender Studion Human Base Meshes -paketti (CC0)
#  - Poly Havenin kangas-, nahka-, puu- ja metallitekstuurit (CC0)
#
#   powershell -File tools/fetch-characters.ps1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$ua = "forest-asset-fetch/1.0"
$root = Join-Path $PSScriptRoot "..\assets-src\_downloads"
New-Item -ItemType Directory -Force $root | Out-Null

# Ihmisen pohjamalli
$hb = Join-Path $root "human_base_meshes"
if (-not (Get-ChildItem $hb -Recurse -Filter *.blend -ErrorAction SilentlyContinue)) {
  New-Item -ItemType Directory -Force $hb | Out-Null
  $zip = Join-Path $hb "bundle.zip"
  Invoke-WebRequest -Uri "https://mirror.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip" -OutFile $zip -UserAgent $ua
  Expand-Archive -Path $zip -DestinationPath $hb
  Remove-Item $zip
}
"pohjamalli: " + ((Get-ChildItem $hb -Recurse -File | ForEach-Object { $_.FullName.Substring($hb.Length + 1) }) -join "; ")

# Tekstuurit (1k: väri + normaali)
$textures = 'brown_leather', 'hessian_230', 'rough_linen', 'poly_wool_herringbone', 'cotton_jersey', 'medieval_wood', 'metal_plate_02'
foreach ($id in $textures) {
  $f = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$id" -UserAgent $ua
  $dir = Join-Path $root "tex_$id"
  New-Item -ItemType Directory -Force $dir | Out-Null
  $maps = @{ diff = @('Diffuse', 'diff'); nor = @('nor_gl') }
  foreach ($k in $maps.Keys) {
    $src = $null
    foreach ($name in $maps[$k]) { if ($f.$name) { $src = $f.$name.'1k'.jpg; break } }
    if (-not $src) { "  PUUTTUU: $id $k"; continue }
    $dest = Join-Path $dir "${id}_${k}_1k.jpg"
    if (-not (Test-Path $dest)) { Invoke-WebRequest -Uri $src.url -OutFile $dest -UserAgent $ua }
  }
  "tekstuuri $id"
}
