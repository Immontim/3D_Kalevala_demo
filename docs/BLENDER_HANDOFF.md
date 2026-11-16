# Blender handoff — 3D Kalevala

Kanoninen Blender-mallien ja asset-putkien nykytila. Pidä tämä alle noin
250 rivin / 20 kt:n. Pelikoodin ja integraation tila on
`docs/AGENT_HANDOFF.md`:ssä.

## Nykytila

Päivitetty: 2026-11-16 (Claude, Windows; pohja main eed0b8c)

- **Mainissa** (pohja `3191123`) ovat `assets/forest.glb`,
  `characters.glb`, `bog.glb`, `homestead.glb`, `household.glb`,
  `yard.glb`, `villagers.glb`, `villagers_f.glb` ja `assets/animals/`.
  `characters.glb` sisältää sankarin rauhan varustuksen (ks. alla). Se,
  mitä peli niistä lataa, on `docs/AGENT_HANDOFF.md`:ssä.
- **Järvenrannan kohtaus** (`assets/lakeside.glb`, noin 0,9 Mt / 9 300
  kolmiota; `assets-src/blender/lakeside.py`, ajetaan taustalla ja lukee
  ensin `homestead.py`:n ja `household.py`:n; Blender on
  `C:\Program Files (x86)\Blender 5.4.0\blender.exe`). Koordinaatit,
  mitat ja törmäysehdotukset ovat skriptin alun kommentissa. Mallit:
  `mokki` (pieni hirsimökki, 4 100 kolmiota, turve- ja tuohikatto, ovi
  raollaan -Y, ikkuna +X-päädyssä, savuluukku katolla; sisus pimeä laatikko),
  `keittopaikka` (kivikehä, hiillos, kalikat, kolmijalka, ketju ja savipata;
  tyhjät pisteet `mount_tuli` ja `mount_pata` liekin, valon ja höyryn
  paikaksi), `istuinhirsi`, `laituri` (kansi +0,30 m, paalut 1 m alas),
  `vene` (tukkivene) ja `mela`, `ruoko_a`, `ruoko_b` ja `kaisla` (tupaat).
  Tietäjä (`villagers.glb`), koira (`animals/koira.glb`), kuuset, kivet ja
  kelo (`forest.glb`) käytetään sellaisenaan. Ei vettä, rantaviivaa eikä
  liekkiä: ne ovat pelikoodin asia. Peli käyttää tiedostoa
  paikassa `lakeside` (AGENT_HANDOFF); mallit on katsottu myös pelissä
  (mökki, tuli, pata, tietäjä, laituri, vene ja ruoko toimivat). Koiralle
  puuttuu kävelyleike, jotta se voisi käyskennellä.
- **Sankarin rauhan varustus** (`characters.glb`, `char_build.py`; peli
  käyttää sitä rauhallisella pihalla, ks. AGENT_HANDOFF):
  - Huotra vyöllä (sankari ja Pohjan soturi) on nyt 0,80 m (oli 0,58 m,
    miekan terä 0,74 m) ja painotettu vain lantioon (`SHEATH_TOP`,
    `SHEATH_D`, `SHEATH_LEN`).
  - Kiinnityspisteet ovat tyhjiä solmuja luiden lapsina (`build_mounts`):
    `mount_huotra` lantioluun (`hips`) alla ja `mount_kilpi_selka`
    rintaluun (`chest`) alla. Kun miekka tai kilpi siirretään pisteen
    lapseksi nollasijaintiin ja -kiertoon, miekka on huotrassa (väistin
    suuaukon helalla, lape kuvetta vasten) ja kilpi selässä etupinta
    taaksepäin.
  - `char_hero_hihna` (72 kolmiota) on kilven kantohihna oikean olan yli,
    samassa luurangossa kuin hahmo. Nimi alkaa `char_`, joten nykyinen
    `Fighter.build` poistaa sen; rauhan varustuksessa se jätetään näkyviin.
  - Kypärä on jo oma kappaleensa, joten rauhassa sen voi jättää pois.
- **Otekanavat pysyville hahmoille** (lepoasento, Blenderin koordinaatit;
  peliin x, z, -y): tietäjällä on miesvartalon koverrettu nyrkki, joten
  `GRIP_P`/`GRIP_D` (`char_build.py`, pelissä `GRIP_CHANNEL`) käy
  sellaisenaan ja sauva (ote origossa) kulkee sen läpi. Jousineidon nyrkkiä
  ei ole koverrettu (`carve=False`). Vasemman käden kanava on arvio, joka
  on siirretty miehen kädestä luun mukana ja hienosäädetty: piste
  (0,385; -0,058; 0,769), suunta (-0,283; -0,795; -0,537); oikea käsi on
  peilikuva x:n suhteen. Jousen kahva uppoaa suljettuun nyrkkiin, mikä
  näyttää otteelta, mutta kuvista tätä ei ole tarkistettu.
- **Hihat ja ranteet.** Pitkän hihan (`torso_parts`, hihan loppu 0,97) leikkasi
  aiemmin vartalon korkeusraja z < 0,95, ja riippuvan käden ranne on tämän
  alapuolella: hiha päättyi rosoisesti kyynärvarren puolivälissä ja ranneke ja
  käsi leijuivat irrallaan ("katkennut ranne"). Käsivarren verteksejä rajaa nyt
  vain `arm_t`; z-alaraja koskee vain vartaloa. Korjaus näkyy tietäjällä,
  jousineidolla (myös naissankari), emännällä, nuorella urholla ja Pohjan
  sotureilla. Sankarin hiha (loppu 0,78) ei muuttunut.
- **Sormiluut** (`char_rig.py`: `finger_setup`, `add_fingers`, `FINGER_*`):
  `finger1..3_L/R` (rystys, keskinivel, kärkinivel; peukalolla ei luuta)
  kummallakin luurangolla (`RIG`, `RIG_F`), vanhempana `hand_*`. Lepoasento on
  edelleen nyrkki (verkko ei muuttunut), luut ovat koukistetun sormen
  nivelissä ja luun paikallinen Z on koukistusakseli: sormet aukeavat
  kiertämällä luita Z:n ympäri +1,25/+1,5/+0,9 rad (täysin suorat sormet).
  Painot: sormiverteksit jaetaan `hand_*`n painosta samoilla nivelkohdilla
  kuin koukistus (`finger_ks`); peukalo jää `hand_*`lle. `ARM`-ryhmä ja
  `grip_carve` laskevat sormiluut käden osaksi. `build_base`/`build_base_f`
  kutsuvat `add_fingers`ia (uusi vartalo), nykyisen `characters.blend`in
  BODY ja BODY_F päivitettiin paikallaan. Sormen ulkonäkö on `h_open`-kuvissa
  hyvä; sormet ovat yhtenä levynä (neljä sormea liikkuu yhdessä) ja peukalo
  pysyy kämmenellä kiinni.
- **Naissankarin varusteet** (`char_folk.py`: `build_hero_f_gear`, osa
  `run_folk(only='f')`ia, jousineidon vartalolla): `char_jousineito_huotra`
  (416 kolmiota; soikea nahkarunko, messinkisuu ja -kärki, vyösilmukka;
  painotettu lantioon, `SHEATH_TOP_F` (0,19; −0,03; 1,03), sama suunta ja pituus
  kuin miehellä), `char_jousineito_hihna` (72 kolmiota, kantohihna viitan
  päältä, `strap_parts(off=0,07)`) sekä tyhjät `mount_huotra_f` (lantioluu) ja
  `mount_kilpi_selka_f` (rintaluu). Kaikki ovat `villagers_f.glb`:ssä; NPC-koodi
  poistaa ne, `Fighter.build` käyttää naissankarilla. Huotra menee kävellessä
  reiden läpi kuten miehen. Kilpi selässä menee jousineidon viinen päälle.
- **Hävitetty ranta** (`assets/lakeruin.glb`, noin 1,9 Mt; `assets-src/blender/lakeruin.py`,
  ajetaan taustalla ja lukee ensin `lakeside.py`:n): `mokki_palanut` (5 500 kolmiota; sama
  pohja kuin `mokki`, hiiltyneet hirsiseinät eri korkeuksille, ovi- ja ikkunaaukko tallessa,
  sortuneet parrut, turvelaatat ja tuohi sisällä, ympärillä noen tummentama maa),
  `keittopaikka_sammunut` (3 100; kivikehä, kylmä tuhka, sortunut kolmijalka, ketju maassa,
  kaatunut pata suu +X-suuntaan ja valunut keitto), `haasia_kaatunut` (900; heinät roikkuvat
  maailman alas-suuntaan), `verilammikko` (1 300; noin 1,7 x 1,3 m läikkä ja roiskeet, makaava
  hahmo asetetaan keskelle) ja `verilammikko_pieni`. Veren väri tulee verteksiväreistä
  (materiaali `M_Blood` valkoinen, kiiltävä); peli nostaa sen syvyydessä. Mallien mitat ja
  tarkistus Blenderin kuvista (a-e); pelissä katsottu vain ylhäältä ja läheltä.
- **Kalmisto** (`assets/cairnfield.glb`, noin 5,0 Mt; `assets-src/blender/cairnfield.py`,
  ajetaan taustalla ja lukee ensin `homestead.py`:n ja `household.py`:n, `trees.py`
  luetaan omaan nimiavaruuteensa karsikkoa varten; esikatselukuvat `KALEVALA_PREVIEW`):
  `kuppikivi` (26 000 kolmiota; litteä lakipinta 2,2 x 1,75 m, korkeus 0,8 m, 11 kuppia
  ja juoksutusura laskettu korkeuskenttään 2,2 cm:n ruudukolla, helma 0,3 m maan alle,
  graniitin väri verteksiväreistä + `mossy_rock`-rakenne), `roykkio_a` (pyöreä),
  `roykkio_b` (soikea), `roykkio_c` (kehäröykkiö, keskellä kuoppa) ja `roykkio_d`
  (pieni): sammalpeitteinen kumpu (`M_CairnMoss`) ja 40–60 satunnaiskiertoista kiveä
  (8 600–14 600 kolmiota/malli), sekä `karsikko` (2 600 kolmiota; 14 m mänty, jonka
  oksat on karsittu tyngiksi 11 m:iin asti, latvassa pieni oksatupsu `trees.py`:n
  korteilla). Mitat ja törmäysehdotukset ovat skriptin alun kommentissa. Katsottu
  Blenderin kuvista ja pelissä (kuppikivi lähellä ja ylhäältä, röykkiöt, Louhi ja
  karsikon alaosa; karsikon latvaa ei pelissä). Kupit ovat mallissa melko pieniä:
  jos haluat näkyvämmät, nosta `cup_depth`in syvyyttä ja `CUPS`in säteitä.
  Röykkiöiden kivet ovat matalapolygonisia ja hieman kulmikkaita; samaa mallia
  käytetään kahdesti eri kierrolla ja mittakaavalla.
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
- **Louhi** (`assets/louhi.glb`, noin 1,7 Mt; `char_louhi.py` →
  `run_louhi()`, lukee ensin `char_folk.py`:n; ajetaan avoimessa
  `characters.blend`issa kuten kyläläiset, kokoelma LOUHI): `char_louhi`
  (noin 27 500 kolmiota, sama `RIG`, naisvartalo ja lepoasento kuin
  emännällä, 17 luuta). Musta pitkä mekko, sininen esiliina
  kirjontanauhalla, kultaiset olkasoljet ja ketjut, helmikaulakoru,
  rengasvyö ja puukko, mustat silmämaalit sekä peuran kallo, sarvet ja
  mustat sulat päässä. Päähine on samaa verkkoa kuin hahmo ja painotettu
  pään luuhun (ei irrotettava). Viittaa ei ole tarkoituksella. Jalat
  ovat mekon alla paljain jaloin. Kuvalähde oli omistajan antama
  Sketchfab-referenssi (ei käytetty mallina eikä kopioitu); kaikki
  geometria on tehty itse. Katsottu vain Blenderin kuvista lepoasennossa
  ja kädet alhaalla. Pelissä (kalmisto) hän seisoo paikallaan emännän käsiasennolla;
  ulkonäkö on katsottu läheltä, kävelyä ei kokeiltu.
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
  rauhallisella pihalla kuvakaappauksista, mutta ei liikkeessä. Rauhan
  varustus on katsottu Blenderin kuvasta neljästä suunnasta (miekka ja
  kilpi kiinnityspisteissä, lepoasento), ja uusi `characters.glb` on
  ajettu pelissä: taistelijat näkyvät ennallaan, hihna on piilossa eikä
  konsolissa ole virheitä. Eläinten viedyt tiedostot on tuotu takaisin Blenderiin ja
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
  - `run_chars()` (tai `make_char_materials()` yksin) luo materiaalit
    uudelleen, jolloin kyläläisten (FOLK, FOLK_F) ja aiemmin rakennettujen
    kappaleiden materiaalipaikat tyhjenevät. Aja sen jälkeen aina
    `run_folk()`; `out_dir` vain, jos kyläläistiedostot halutaan viedä.
  - Toisesta työpuusta: aja työpuun skriptit itse (`exec` tiedosto
    kerrallaan, kyläläisille `FOLK_DIR`) ja vie
    `export_characters(out)` tai `KALEVALA_ASSETS_OUT`; `char_all.py`:n
    `_B` osoittaa pääkansioon.
  - Vienti lisää `characters.glb`:hen tyhjän juurisolmun `RIG_F` (ja
    `villagers_f.glb`:hen `RIG__tmp`). Ne ovat viejän sivutuote toisesta
    luurangosta ja harmittomia.
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
- Miehen huotra on litteä laatikko ja seuraa vain lantiota, joten se menee
  kävellessä reiden ja helman läpi. Selässä kilven kädensija painuu hieman
  panssariin ja sankarin pitkät hiukset menevät kilven läpi. Kantohihna
  kulkee selässä kilven alla, ei kiinnity kilpeen.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`).

## Seuraava Blender-tehtävä

Ei avointa Blender-tehtävää. Ehdotus omistajalle: sormien viimeistely
(neljä sormea erilleen ja peukalolle oma luu, jos vilkutus näyttää
jäykältä), koiran kävelyleike (`animals.py`, 191 luuta) ranta- ja
pihakoiran käyskentelyyn sekä istuva tietäjä (uusi istumaleike). Jos omistaja
pitää jousineidon otetta huonona, koverretaan hänen nyrkkinsä
(`skin_parts(carve=…)` omalla kanavalla). Muuten odotetaan palautetta pelissä
näkyvistä virheistä.

## Ei vielä aloiteta

- Isännän malli.
- Dialogianimaatiot ennen omistajan palautetta rauhallisesta pihasta.
