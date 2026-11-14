# Hakee talousesineiden (assets/household.glb) lähdemallit Poly Havenista (CC0)
# kansioon assets-src/_downloads/<tunniste>/. Kansio ei ole Gitissä.
# Tekstuurit pine_bark, clay_plaster ja thatch_roof_angled tulevat skripteistä
# fetch-polyhaven.ps1 ja fetch-homestead.ps1.
#
#   powershell -File tools/fetch-household.ps1

$ErrorActionPreference = "Stop"
$ua = "household-asset-fetch/1.0"
$root = Join-Path $PSScriptRoot "..\assets-src\_downloads"

function Get-File($url, $dest) {
  if (Test-Path $dest) { return }
  New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
  Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent $ua
}

# Käytössä: kulho, kuppi, kauha, lautanen, kori.
foreach ($id in 'wooden_bowl_01', 'wooden_bowl_02', 'wooden_spoon', 'carved_wooden_plate', 'wicker_basket_01') {
  $f = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$id" -UserAgent $ua
  $g = $f.gltf.'1k'.gltf
  $dir = Join-Path $root $id
  Get-File $g.url (Join-Path $dir "$id.gltf")
  foreach ($p in $g.include.PSObject.Properties) {
    Get-File $p.Value.url (Join-Path $dir $p.Name)
  }
  "malli $id"
}
