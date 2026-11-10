# Hakee metsäaukion lähdeassetit Poly Havenista (CC0) kansioon
# assets-src/_downloads/. Kansio ei ole Gitissä: aja tämä uudella koneella,
# jos Blender-lähdetiedostoa pitää rakentaa uudelleen.
#
#   powershell -File tools/fetch-polyhaven.ps1

$ErrorActionPreference = "Stop"
$ua = "forest-asset-fetch/1.0"
$root = Join-Path $PSScriptRoot "..\assets-src\_downloads"
New-Item -ItemType Directory -Force $root | Out-Null

function Get-File($url, $dest) {
  if (Test-Path $dest) { return }
  New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
  Invoke-WebRequest -Uri $url -OutFile $dest -UserAgent $ua
}

# Mallit glTF-muodossa (1k-tekstuurit) sekä mahdolliset alpha-kartat.
$models = 'moss_01', 'grass_medium_01', 'fern_02', 'rock_moss_set_01', 'rock_moss_set_02',
  'dry_branches_medium_01', 'dead_tree_trunk', 'boulder_01', 'pine_sapling_small', 'fir_sapling'
foreach ($id in $models) {
  $f = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$id" -UserAgent $ua
  $dir = Join-Path $root $id
  $g = $f.gltf.'1k'.gltf
  Get-File $g.url (Join-Path $dir "$id.gltf")
  foreach ($p in $g.include.PSObject.Properties) { Get-File $p.Value.url (Join-Path $dir $p.Name) }
  foreach ($k in $f.PSObject.Properties.Name) {
    if ($k -match 'alpha|mask') { Get-File $f.$k.'1k'.png.url (Join-Path $dir "textures\${id}_${k}_1k.png") }
  }
  "malli $id"
}

# Pelkät tekstuurit: id, tarkkuus ja haettavat kartat.
$textures = @(
  @{ id = 'forrest_ground_03'; res = '2k'; maps = 'Diffuse', 'nor_gl', 'arm' },
  @{ id = 'forest_leaves_02'; res = '2k'; maps = 'Diffuse', 'nor_gl', 'arm' },
  @{ id = 'forest_ground_04'; res = '2k'; maps = 'Diffuse', 'nor_gl', 'arm' },
  @{ id = 'pine_bark'; res = '1k'; maps = 'Diffuse', 'nor_gl', 'arm' },
  @{ id = 'mossy_rock'; res = '1k'; maps = 'Diffuse', 'nor_gl', 'arm' },
  # Isojen puiden tekstuurit ilman 0,5 Gt:n geometriaa.
  @{ id = 'pine_tree_01'; res = '2k'; maps = 'twig_diff', 'twig_nor_gl', 'twig_arm', 'twig_alpha', 'bark_diff', 'bark_nor_gl', 'bark_arm', 'trunk_a_diff', 'trunk_a_nor_gl', 'trunk_a_arm' },
  @{ id = 'fir_tree_01'; res = '2k'; maps = 'twig_diff', 'twig_nor_gl', 'twig_arm', 'twig_alpha', 'bark_diff', 'bark_nor_gl', 'bark_arm' }
)
foreach ($t in $textures) {
  $f = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$($t.id)" -UserAgent $ua
  $dir = Join-Path $root "tex_$($t.id)"
  foreach ($m in $t.maps) {
    $fmt = if ($m -match 'alpha') { 'png' } else { 'jpg' }
    $e = $f.$m.($t.res).$fmt
    Get-File $e.url (Join-Path $dir "$($t.id)_${m}_$($t.res).$fmt")
  }
  "tekstuuri $($t.id)"
}
"{0:N1} Mt ladattu kansioon {1}" -f ((Get-ChildItem $root -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), $root
