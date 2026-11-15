# Blender handoff — 3D Kalevala

Kanoninen Blender-mallien ja asset-putkien nykytila. Pidä tämä alle noin
250 rivin / 20 kt:n. Pelikoodin ja integraation tila on
`docs/AGENT_HANDOFF.md`:ssä.

## Nykytila

Päivitetty: 2026-11-15 (Claude, Windows)

- **Mainissa** (pohja `c48b27e`) ovat `assets/forest.glb`,
  `characters.glb`, `bog.glb`, `homestead.glb`, `household.glb`,
  `villagers.glb`, `villagers_f.glb` ja `assets/animals/`; branchissa
  `claude/peaceful-yard` lisäksi `yard.glb` (tarkista merge-tila
  `git merge-base --is-ancestor`). Se, mitä peli niistä lataa ja mitä
  integraatiosta puuttuu, on `docs/AGENT_HANDOFF.md`:ssä.
- **Pihapiiri** tehdään skriptillä `assets-src/blender/homestead.py` →
  `build_homestead()`: `talo`, `kuoppatalo`, `aitta`, `katos`, `aita`,
  `portinpieli`, `pino`, `polkky`, `haasia` ja `ruukku`. Kuoppatalon
  kulkukuilun mitat on pidettävä samoina Blender-skriptissä ja
  `src/world.ts`:ssä. Hirsisalvosta ja savupiippua ei käytetä, koska ne
  ovat myöhempiä.
- **Rauhallisen pihan rakennelmat** (`assets/yard.glb`, noin 1,1 Mt;
  `assets-src/blender/yard.py`, ajetaan taustalla ja lukee ensin
  `homestead.py`:n): `sikolatti` (940 kolmiota; olkikatos takana,
  riukuaitaus edessä sisämitoiltaan noin 2,9 × 2,4 m, kaukalo etulaidalla)
  ja `kanakoppi` (718 kolmiota; paaluilla seisova lautakoppi, kulkulauta
  ja orsi kyljessä 0,6 m korkeudella). Etusivu -Y, origo pohjan keskellä,
  samat materiaalit kuin pihapiirissä.
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
- **Eläimet** (`assets/animals/`, yhteensä 3,1 Mt; skripti `animals.py`,
  ajetaan taustalla; lähteet Sketchfabista CC-BY 4.0, omistaja lataa
  glTF-muodossa kansioon `assets-src/_downloads/animals/<nimi>/`):
  `koira.glb` (8 000 kolmiota, 191 luuta, korkeus 0,56 m; leikkeet
  `seisoo`, `istuu`, `tassu`), `kana.glb` (5 000, 56 luuta, 0,37 m; `olo`
  = nokkii maata), `possu.glb` (7 000, 54 luuta, 0,50 m; `kavely`
  paikallaan, ei lepoleikettä) ja `kukko_kana.glb` (liikkumattomat `kukko`
  2 400 ja `kana_b` 2 000 kolmiota). Juurisolmu on eläimen nimi, origo
  jalkojen välissä maassa, nokka -Y, koko valmiiksi metreinä (juuressa on
  skaala). Eläimet ovat omissa tiedostoissaan, koska lähdemallien luiden
  nimet menevät päällekkäin. Materiaali `M_AN_*`, vain värikartta.
  Skripti kirjoittaa leikkeisiin luiden avaimettomat kanavat
  (`key_static_channels`): ilman sitä koiran viikset ja varpaat siirtyvät
  viennissä. Uusi eläin on rivi `ANIMALS`-taulukkoon.
- **Tarkistuksen taso:** mallit on katsottu vain Blenderin kuvista
  (hahmot lepoasennossa ja kädet alhaalla). Kyläläiset, eläimet,
  talousesineet, sikolätti ja kanakoppi on lisäksi nähty pelissä
  rauhallisella pihalla kuvakaappauksista, mutta ei liikkeessä. Eläinten viedyt tiedostot on tuotu takaisin Blenderiin ja
  jokainen leike kuvattu yhdestä ruudusta.
- **Blender-putket** (`assets-src/blender/`): metsä `build_all.py`,
  taistelijat `char_all.py` → `run_chars()`, kyläläiset `char_folk.py` →
  `run_folk()`, suo `bog.py` → `build_bog()`, pihapiiri `homestead.py` ja
  esineet `household.py`, rauhallisen pihan rakennelmat `yard.py` ja
  eläimet `animals.py`.
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
- Eläinten tyyli ei ole yhtenäinen: kukko ja kanat ovat käsinmaalattuja,
  koira sileä ja ihmishahmoja lelumaisempi. Possu on porsaan mittasuhteissa.
  Koiran 191 luuta on yhdelle koiralle hyväksyttävä, ei laumalle.
- Talousesineiden tulikivet ja tuhka ovat tasaisen harmaita ilman tekstuuria.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`).

## Seuraava Blender-tehtävä

Ei avointa Blender-tehtävää. Odotetaan omistajan palautetta rauhallisesta
pihasta (`docs/AGENT_HANDOFF.md`); sen perusteella korjataan mallien viat,
jotka näkyvät vasta pelin valossa.

## Ei vielä aloiteta

- Louhen ja isännän mallit.
- Dialogianimaatiot ennen omistajan palautetta rauhallisesta pihasta.
