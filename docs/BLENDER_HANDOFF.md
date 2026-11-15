# Blender handoff — 3D Kalevala

Kanoninen Blender-mallien ja asset-putkien nykytila. Pidä tämä alle noin
250 rivin / 20 kt:n. Pelikoodin ja integraation tila on
`docs/AGENT_HANDOFF.md`:ssä.

## Nykytila

Päivitetty: 2026-11-15 (Claude, Windows)

- **Mainissa** (pohja `c48b27e`) ovat `assets/forest.glb`,
  `characters.glb`, `bog.glb`, `homestead.glb`, `household.glb`,
  `villagers.glb` ja `villagers_f.glb`. Se, mitä peli niistä lataa ja mitä
  integraatiosta puuttuu, on `docs/AGENT_HANDOFF.md`:ssä.
- **Pihapiiri** tehdään skriptillä `assets-src/blender/homestead.py` →
  `build_homestead()`: `talo`, `kuoppatalo`, `aitta`, `katos`, `aita`,
  `portinpieli`, `pino`, `polkky`, `haasia` ja `ruukku`. Kuoppatalon
  kulkukuilun mitat on pidettävä samoina Blender-skriptissä ja
  `src/world.ts`:ssä. Hirsisalvosta ja savupiippua ei käytetä, koska ne
  ovat myöhempiä.
- **Talousesineet** (`assets/household.glb`, noin 1,4 Mt / 19 000
  kolmiota; `assets-src/blender/household.py`): `pukkipoyta`, `penkki`,
  `tuohikontti`, `pata`, `rieska`, `nauriit`, `kuivakalat`, `lyhde`,
  `kulho`, `kuppi`, `kauha`, `lautanen`, `kori` ja `poyta_kattaus`.
  Katetun pöydän esineillä on pöydän kanssa yhteinen origo; pöytälevyn
  pinta on 0,76 m. Skriptin `HH` muuntaa sRGB-värit lineaarisiksi.
  Viljalyhde `lyhde` on tarkoitettu myös emännän käteen.
- **Tietäjä** (`assets/villagers.glb`, noin 2,2 Mt;
  `char_folk.py` → `run_folk()`): `char_tietaja` (noin 29 700 kolmiota,
  sama `RIG` ja luiden nimet kuin taistelijoilla) sekä `sauva` (ote
  origossa, linnunpää -Y, nokka +Z). Viitta ja kanteleen kotelo on
  painotettu vartaloon. Vasen käsi pidetään viitan alla sivulla ja oikea
  on vapaa sauvalle.
- **Naishahmot** (`assets/villagers_f.glb`, noin 3,2 Mt):
  `char_jousineito` (noin 27 900 kolmiota), `jousi` (ote origossa, lavat
  Z-suunnassa, jänne +Y) ja `char_emanta` (noin 26 600 kolmiota).
  Naisvartalo (skaalattu miehen pituiseksi ×1,026, muotoilu
  `shape_body_f`) käyttää omaa Blender-luurankoa `RIG_F`, joka viedään
  tiedostoon nimellä `RIG`; samat 17 luun nimet kuin miehillä, mutta
  lepoasento eri. Siksi naiset ovat omassa tiedostossaan.
  Emännän pitkä helma seuraa reisiä ja sääriä, mutta kävelyä ei ole
  kokeiltu. Jousineidon olkaviitta ei kestä käsien nostoa jousen
  jännitysasentoon ilman läpimenoa.
- **Tarkistuksen taso:** mallit on katsottu vain Blenderin kuvista
  (hahmot lepoasennossa ja kädet alhaalla), ei pelin valossa eikä
  liikkeessä.
- **Blender-putket** (`assets-src/blender/`): metsä `build_all.py`,
  taistelijat `char_all.py` → `run_chars()`, kyläläiset `char_folk.py` →
  `run_folk()`, suo `bog.py` → `build_bog()`, pihapiiri `homestead.py` ja
  esineet `household.py`.
  - Hahmot rakennetaan **avoimessa `characters.blend`-tiedostossa** Blender
    MCP:n kautta (kokoelmat GAME, SRC, WORK, FOLK, FOLK_F). Uusi
    kyläläinen: oma `build_…`-funktio ja rivi `run_folk`iin.
    `run_folk(only='f')` vie vain naisten tiedoston, `only='m'` vain miesten.
  - Pihapiiri ja esineet ajetaan **taustalla tyhjässä tiedostossa**
    (`blender --background --factory-startup --python`). `household.py`
    lukee ensin `homestead.py`:n, ja `homestead.py` tarvitsee metsäputken
    `assets-src/textures/birch_bark_diff.png`n.
  - Blender MCP:n oma taustatyökalu ei toimi, koska `BLENDER_PATH` puuttuu.
    MCP-kutsut eivät säilytä Python-tilaa: jokainen kutsu lukee skriptin
    uudelleen.
  - Lähteet hakevat `tools/fetch-*.ps1`; PowerShell-skriptien ajo on ollut
    kotikoneella estetty, joten tiedostoja on haettu samoista osoitteista
    käsin kansioon `assets-src/_downloads/` (ei Gitissä). `.blend`-tiedostot
    eivät ole Gitissä, eikä lähdemallien tuontia SRC-kokoelmaan ole
    skriptattu.
  - Assetti- tai dokumenttimuutos ei nosta pelin versionumeroa.

## Tunnetut rajoitteet ja riskit

- Hahmojen kasvot ovat ilman tekstuuria, hiukset sileitä ja peukalo ei
  kierry kahvan ympärille. Helmat voivat venyä haara-asennossa.
  Rengaspanssari on varjossa lähes musta. Kypärän kupu on sileä ja
  tekstuuri sama metallilevy kuin muissa osissa.
- Tietäjän vasen käsi tulee levällään olevassa lepoasennossa viitan läpi;
  suunniteltu lepoasento pitää käden viitan alla.
- Emännän pitkä helma ja jousineidon viitta pitää testata pelin animaatioilla.
- Talousesineiden tulikivet ja tuhka ovat tasaisen harmaita ilman tekstuuria.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`).

## Seuraava Blender-tehtävä

Eläimet rauhalliseen pihaan. Omistaja on ladannut Sketchfabista
(CC-BY) kansioon `assets-src/_downloads/animals/`: koira (Shiba Inu,
quander), kana (Halva the Chicken, Pia Heugel), kukko ja kana (Enkarra)
sekä possu (grs). Tarkista lisenssi ladatuista tiedostoista, kevennä
selaimelle (koira ja possu noin 8 000 kolmioon), sävytä aikakauteen, vie
omaksi `.glb`-tiedostokseen ja kirjaa tekijät `assets/CREDITS.md`:hen.

## Ei vielä aloiteta

- Louhen ja isännän mallit.
- Dialogianimaatiot ennen rauhallisen pihan selainintegraatiota.
