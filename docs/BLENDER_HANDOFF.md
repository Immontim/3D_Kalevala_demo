# Blender handoff — 3D Kalevala

Kanoninen Blender-mallien ja asset-putkien nykytila. Pidä tämä alle noin
250 rivin / 20 kt:n. Pelikoodin ja integraation tila on
`docs/AGENT_HANDOFF.md`:ssä.

## Nykytila

Päivitetty: 2026-11-15 (Codex, Windows; koottu mainin handoff-merkinnöistä)

- **Mainin asset-tila perustuu commitiin `c48b27e`.** Main sisältää
  `assets/homestead.glb`, `household.glb`,
  `villagers.glb` sekä `villagers_f.glb`. Talousesineitä ja kyläläisiä ei
  vielä ladata peliin. Pöydän ja penkin törmäysmuodot ovat jo pelikoodin
  `PROP_COLLIDERS`-taulukossa.
- **Pihapiiri** tehdään skriptillä `assets-src/blender/homestead.py` →
  `build_homestead()`: `talo`, `kuoppatalo`, `aitta`, `katos`, `aita`,
  `portinpieli`, `pino`, `polkky`, `haasia` ja `ruukku`. Kuoppatalon
  kulkukuilun mitat on pidettävä samoina Blender-skriptissä ja
  `src/world.ts`:ssä. Materiaalit viritetään pelin valoon
  `prepareMaterials`issa.
- **Talousesineet** (`assets/household.glb`, noin 1,4 Mt / 19 000
  kolmiota; `assets-src/blender/household.py`): `pukkipoyta`, `penkki`,
  `tuohikontti`, `pata`, `rieska`, `nauriit`, `kuivakalat`, `lyhde`,
  `kulho`, `kuppi`, `kauha`, `lautanen`, `kori` ja `poyta_kattaus`.
  Katetun pöydän esineillä on pöydän kanssa yhteinen origo; pöytälevyn
  pinta on 0,76 m. Skriptin `HH` muuntaa sRGB-värit lineaarisiksi.
- **Tietäjä** (`assets/villagers.glb`, noin 2,2 Mt;
  `char_folk.py` → `run_folk()`): `char_tietaja` (noin 29 700 kolmiota,
  sama `RIG` ja luiden nimet kuin taistelijoilla) sekä `sauva` (ote
  origossa, linnunpää -Y, nokka +Z). Viitta ja kanteleen kotelo on
  painotettu vartaloon. Vasen käsi pidetään viitan alla sivulla ja oikea
  on vapaa sauvalle.
- **Naishahmot** (`assets/villagers_f.glb`, noin 3,2 Mt):
  `char_jousineito` (noin 27 900 kolmiota), `jousi` ja `char_emanta`
  (noin 26 600 kolmiota). Naisvartalo käyttää omaa Blender-luurankoa
  `RIG_F`, joka viedään tiedostoon nimellä `RIG`; luiden nimet ovat samat
  kuin miehillä, mutta lepoasento eri. Pelissä naishahmon alustava skaala
  on noin 0,95. Miehen kädestä mitattu `GRIP_CHANNEL` ei käy naiselle.
  Emännän pitkä helma seuraa reisiä ja sääriä, mutta kävelyä ei ole
  kokeiltu. Jousineidon olkaviitta ei kestä käsien nostoa jousen
  jännitysasentoon ilman läpimenoa.
- **Materiaalit:** talousesineiden `M_HH_*` ja naishahmojen `F_Weave`
  pitää ottaa mukaan pelin `prepareMaterials`-käsittelyyn. Assetit on
  tarkistettu Blenderin kuvista ja hahmot kädet alhaalla, ei vielä pelin
  valossa tai liikkeessä.
- **Rauhallinen pihakohtaus:** valmiina talousesineet, tietäjä,
  jousineito ja emäntä. Jäljellä ovat eläimet (sika, koira, kanat;
  CC-BY-mallit omistajalta) sekä pelikoodin rauhallinen piha: uusi paikka,
  esineiden ja pysyvien hahmojen sijoittelu, materiaalit sekä
  tekijäluettelo. Hahmot seisovat aluksi paikallaan. Dialogijärjestelmä
  tehdään myöhemmin.
- **Blender-putket:** metsä `build_all.py`, taistelijat `char_all.py` →
  `run_chars()`, kyläläiset `char_folk.py` → `run_folk()`, suo `bog.py`,
  pihapiiri `homestead.py` ja esineet `household.py`. `homestead.py`
  tarvitsee metsäputken `assets-src/textures/birch_bark_diff.png`n.
  Lähteet hakevat `tools/fetch-*.ps1`; PowerShell-skriptien ajo on ollut
  kotikoneella estetty, joten tiedostoja on haettu samoista osoitteista
  käsin. `.blend`-tiedostot eivät ole Gitissä eikä lähdemallien tuontia
  SRC-kokoelmaan ole skriptattu.
- **Tarkistus/deploy:** Blender-assetit ovat mainissa, mutta niiden
  selainintegraatiota ei ole tehty eikä savutestattu. Pelin versionumeroa
  ei nosteta pelkästä assetti- tai dokumenttimuutoksesta.

## Tunnetut rajoitteet ja riskit

- Hahmojen kasvot ovat ilman tekstuuria, hiukset sileitä ja peukalo ei
  kierry kahvan ympärille. Helmat voivat venyä haara-asennossa.
- Tietäjän vasen käsi tulee levällään olevassa lepoasennossa viitan läpi;
  suunniteltu lepoasento pitää käden viitan alla.
- Naishahmojen eri lepoasento vaatii integraatiossa tarkistuksen, vaikka
  luiden nimet vastaavat miehiä.
- Emännän pitkä helma ja jousineidon viitta pitää testata pelin animaatioilla.
- Talousesineiden tulikivet ja tuhka ovat tasaisen harmaita ilman tekstuuria.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`).
- Suorituskyky on mitattu vain tehokoneella; LOD-malleja ei vielä ole.

## Seuraava Blender-tehtävä

Kun omistajan eläinmallit ovat saatavilla, tarkista lähde ja CC-BY-lisenssi,
kevennä tarvittaessa selaimelle ja lisää ne yhtenäiseen asset-putkeen.

## Ei vielä aloiteta

- Louhen ja isännän mallit.
- Dialogianimaatiot ennen rauhallisen pihan selainintegraatiota.
- Git LFS ennen omistajan erillistä päätöstä.
