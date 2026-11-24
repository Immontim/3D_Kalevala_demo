# Blender handoff — 3D Kalevala

Kanoninen Blender-mallien ja asset-putkien nykytila. Pidä tämä alle noin
250 rivin / 20 kt:n. Pelikoodin ja integraation tila on
`docs/AGENT_HANDOFF.md`:ssä.

## Nykytila

Päivitetty: 2026-11-24 (Claude, Windows; pohja main fc36128; Pohjan soturit ja kirveet branchissa
`claude/pohja-warriors`, tarkista merge-tila `git merge-base --is-ancestor`)

- **Pohjan uudet soturit ja kirveet** (ei vielä pelissä; toteutusohje, osien näyttösäännöt, kiinnityspisteet,
  otekanavat ja mittaukset: `docs/POHJA_WARRIORS.md`). `char_pohja.py` lukee char_smith_child.py:n; ajo taustalla
  characters.blendin kopiolla, ei rinnakkain (`img_from_px` jakaa välitiedoston).
  - `pohja_tanakka.glb` (1,58 m, parrakas) ja `pohja_hoikka.glb` (1,86 m, parraton), kumpikin oma `RIG`.
    Asu kootaan vakiomiehen mittoihin ja muunnetaan `BUILDS`-taulukon luukohtaisilla kertoimilla (`reshape`,
    kuten `childify`). Osat: `_base`, `_nuttu_vaalea`, `_nuttu_tumma`, `_mail`, `_huotra`, `helmet_<h>`,
    tyhjät `mount_huotra` ja `mount_kirves`. Vyö `BELT_Z0` 1,012 (7 mm sankaria ylempänä).
  - `kirveet.glb`: `kirves_parta` ja `kirves_karjala` miekan kehyksessä (ote origossa, pää −Y, terä +X).
  - Arvioija kävi kirveet ja hahmot läpi; korjattu mm. kaula, korvakkeet, upotus, ihonvärinen nuttu,
    rengaspaidan rosoinen kaula-aukko ja kirveen asento vyöllä. Riski: ääri-kävelyssä reisi puskee
    helman ja rengaspaidan läpi (sankarilla sama); kirveen terän puoli sivalluksessa tarkistamatta.

- **Sepän pihapiiri B1–B5** (ei vielä pelissä; pelikoodi on Codexin). Sijoitus, törmäysohje (pajasta ei kiinteää
  laatikkoa), hahmojen paikat, kauppa, latausohjeet ja tyhjien pisteiden käyttö: `docs/SMITHY_INTEGRATION.md`.
  - `assets/smithy.glb` (1,78 Mt / 15 450 kolmiota; `smithy.py` lukee cairnfield.py → homestead.py,
    household.py; tekstuurit `tools/fetch-smithy.ps1`): solmuilla sama origo (pajan lattian keskikohta), poikkeus
    `poyta_aihiot`. Mitat ja törmäykset skriptin alussa. Pihan sommittelu `smithy_yard.py` (ei GLB:tä).
  - `assets/smithfolk.glb` (3,25 Mt; `char_smith.py`): `char_seppa`, `char_salli`, `sepan_vasara` samalla
    `RIG`illä kuin tietäjä. Esiliinan painot tunikasta (`transfer_weights`); väli kankaaseen
    (`apron_clearance`, `SMITH_POSES`) lepo ja työasennot ≥ 10 mm, ääri-kävely −7/−22 mm kuten helmat.
  - `assets/smithfolk_child.glb` (1,58 Mt / 26 700 kolmiota; `char_smith_child.py` lukee char_smith.py:n):
    `char_lapsi` 1,29 m. Asu kootaan aikuisen mittoihin, sitten `child_face` + `childify` (luukohtainen
    pituus/poikittaisskaalaus `CHILD_SCALE`, luiden kierrot ennallaan) → oma luuranko. Väli mitataan
    lapseksi muunnetusta BODY-kopiosta (`child_body`): ≥ 12 mm, ääri-kävely −16 mm.
  - Kaikki ajetaan taustalla characters.blendin **kopiolla** (`save=False`); lähdetiedostoa ei muutettu.
    Arvioija tarkisti jokaisen vaiheen. Riskit: GLB:t monistavat tekstuureja, ellei peli jaa niitä nimellä;
    kaukalo näyttää hieman laatikolta; vesi on läpinäkymätön tumma pinta.

- **Metsän LOD- ja reuna-assetit** (`assets/forest_lod.glb`, 1,6 Mt; `assets-src/blender/forest_lod.py`;
  mainissa). Peli lataa tiedoston kaikissa 3D-kohtauksissa v06.00.00:sta alkaen (AGENT_HANDOFF). Skripti lukee
  valmiin `forest.glb`:n, joten `forest_clearing.blend`iä ei tarvita; ajo taustalla noin 2 min
  (`blender --background --factory-startup --python ...`, `KALEVALA_PREVIEW=1` kirjoittaa vertailukuvat
  `assets-src/cards/lod_preview/`, joka ei ole Gitissä). Solmut, mitat ja suunnat ovat skriptin alussa:
  - `<puu>_lod1` kahdeksalle puulle, 59–92 kolmiota (täydet 1 000–2 800): kevennetty päärunko
    (`M_BarkLOD`, kaarnan keskiväri verteksiväreinä) + kolme ristikkäistä kuvakorttia 60°:n välein.
    Kortit ovat valaisemattomia ortokuvia puusta ilman päärunkoa (kalteva runko ei tuplaannu).
    Atlas 2048², 256 × 512 px korttia kohti (`M_FoliageLOD`, glTF MASK, sama mittakaava ja origo kuin
    täydellä puulla).
  - `metsaseina`: 80 × 20 m:n horisonttisuikale samassa atlaksessa (rivi 4), laatoittuu vaakasuunnassa.
  - `juurakko`: kaatuneen puun juurilevy (2 230 kolmiota, `M_Soil` = maaston dirt-tekstuuri,
    juuret `M_Log`) ja +Y:hen laskeva runkotynkä kelon (`log`) tyveksi.
  - **Pelissä (v06.00.00):** valaisematon atlas tekee kaukopuista vaaleampia; peli korjaa sen (`world.ts`
    `LOD_TINT`, `M_BarkLOD` × 0,62). Erämaa piirtää raskaan juurakon vain alle 60 m:n päähän.
- **Järvenrannan kohtaus** (`assets/lakeside.glb`, 0,9 Mt / 9 300 kolmiota; `lakeside.py`, taustalla, lukee
  `homestead.py`:n ja `household.py`:n; Blender `C:\Program Files (x86)\Blender 5.4.0\blender.exe`): `mokki`
  (ovi −Y), `keittopaikka` (tyhjät `mount_tuli`, `mount_pata`), `istuinhirsi`, `laituri`, `vene`, `mela`,
  `ruoko_a/b`, `kaisla`. Mitat ja törmäykset skriptin alussa. Vesi, rantaviiva ja liekki ovat pelikoodin
  asia. Pelissä paikassa `lakeside`; koiralta puuttuu kävelyleike.
- **Sankarin rauhan varustus** (`characters.glb`, `char_build.py`): huotra 0,80 m, painotettu vain lantioon
  (`SHEATH_*`). Tyhjät `mount_huotra` (`hips`-luun lapsi) ja `mount_kilpi_selka` (`chest`): ase tai kilpi pisteen
  lapseksi nollasijaintiin ja -kiertoon. `char_hero_hihna` (72 kolmiota) on kilven kantohihna; `char_`-alkuisena
  `Fighter.build` poistaa sen, rauhassa se jätetään näkyviin. Kypärä on oma kappaleensa.
- **Otekanavat pysyville hahmoille** (lepoasento, Blenderin koordinaatit;
  peliin x, z, -y): tietäjällä on miesvartalon koverrettu nyrkki, joten
  `GRIP_P`/`GRIP_D` (`char_build.py`, pelissä `GRIP_CHANNEL`) käy
  sellaisenaan ja sauva (ote origossa) kulkee sen läpi. Jousineidon nyrkkiä
  ei ole koverrettu (`carve=False`). Vasemman käden kanava on arvio, joka
  on siirretty miehen kädestä luun mukana ja hienosäädetty: piste
  (0,385; -0,058; 0,769), suunta (-0,283; -0,795; -0,537); oikea käsi on
  peilikuva x:n suhteen. Jousen kahva uppoaa suljettuun nyrkkiin, mikä
  näyttää otteelta, mutta kuvista tätä ei ole tarkistettu.
- **Sormiluut** (`char_rig.py`: `finger_setup`, `add_fingers`, `FINGER_*`): `finger1..3_L/R` kummallakin luurangolla
  (`RIG`, `RIG_F`), vanhempana `hand_*`. Lepoasento on edelleen nyrkki (verkko ei muuttunut); luun paikallinen Z on
  koukistusakseli ja sormet aukeavat kiertämällä luita +1,25/+1,5/+0,9 rad. Sormiverteksit jaetaan `hand_*`n painosta
  koukistuksen nivelkohdilla (`finger_ks`), peukalo jää `hand_*`lle. Neljä sormea liikkuu yhtenä levynä.
- **Naissankarin varusteet** (`char_folk.py`: `build_hero_f_gear`): `char_jousineito_huotra` (416 kolmiota, painotettu
  lantioon, `SHEATH_TOP_F` (0,19; −0,03; 1,03), sama suunta ja pituus kuin miehellä), `char_jousineito_hihna` (72,
  `strap_parts(off=0,07)`) ja tyhjät `mount_huotra_f` (lantioluu) ja `mount_kilpi_selka_f` (rintaluu) `villagers_f.glb`:ssä;
  NPC-koodi poistaa ne. Huotra menee kävellessä reiden läpi kuten miehen; kilpi selässä menee viinen päälle.
- **Hävitetty ranta** (`assets/lakeruin.glb`, 1,9 Mt; `lakeruin.py`, taustalla, lukee ensin `lakeside.py`:n):
  `mokki_palanut` (5 500 kolmiota; sama pohja kuin `mokki`, hiiltyneet seinät eri korkeuksille, sortuneet parrut),
  `keittopaikka_sammunut` (3 100; sortunut kolmijalka, kaatunut pata suu +X), `haasia_kaatunut` (900),
  `verilammikko` (1 300) ja `verilammikko_pieni`. Veren väri tulee verteksiväreistä (`M_Blood` valkoinen, kiiltävä);
  peli nostaa sen syvyydessä.
- **Kalmisto** (`assets/cairnfield.glb`, 5,0 Mt; `cairnfield.py`, taustalla, lukee ensin `homestead.py`:n ja
  `household.py`:n; `trees.py` omaan nimiavaruuteensa; esikatselu `KALEVALA_PREVIEW`): `kuppikivi` (26 000 kolmiota;
  lakipinta 2,2 x 1,75 m, 11 kuppia ja ura korkeuskentässä, helma 0,3 m maan alla), `roykkio_a`–`d` (sammalkumpu
  `M_CairnMoss` ja 40–60 kiveä, 8 600–14 600 kolmiota/malli) ja `karsikko` (2 600; 14 m mänty, oksat tyngiksi 11 m:iin).
  Mitat ja törmäysehdotukset skriptin alun kommentissa. Kupit ovat pieniä (`cup_depth`, `CUPS`); röykkiöiden kivet
  matalapolygonisia, samaa mallia käytetään kahdesti eri kierrolla.
- **Modulaariset sankariosat** (`char_build.py`: `build_hero_modular`, `legs_trousers_wraps`, `legs_shoes`,
  `legs_greaves`, `foot_skin_parts`, `belt_flange`; naiselle `char_folk.py`: `build_jousineito_modular`,
  `_jousineito_core`): nykyisten täysien `char_hero`n ja `char_jousineito`n **rinnalle** (ne ovat verteksi
  verteksiltä ennallaan) samalla luurangolla (23 luuta, yksi skin). Solmut `char_hero_base` / `_mail` / `_greaves` /
  `_shoes` (`characters.glb`) ja `char_jousineito_*` samoin (`villagers_f.glb`); `Fighter.build` valitsee osat
  kampanjavarusteiden mukaan. Kolmiot: base noin 28 000, mail 2 800–3 200, greaves 260, shoes 4 700; base kopioi
  kokonaisen hahmon, joten `characters.glb` on 7,1 Mt ja `villagers_f.glb` 5,0 Mt. Base = asu ilman rengaspaitaa ja
  kenkiä (paljas jalkaterä `foot_skin_parts`, vyön `flange` estää leijumisen); naisen rengashelma on jokaisella
  säteellä ≥ 1,2 cm tunikan helman ulkopuolella. Tarkistus `char_modular_check.py` (`check_set("hero"|"fem")`, viisi
  asentoa). Ääriasennossa (jalka eteen yli 0,35 rad) tunika pistää rengashelman läpi kuten legacyssa; naisen
  säärisuojat jäävät housujen alle polvessa. Varusteiden vaihto pelissä odottaa omistajan käsisavutestiä.
- **Taivaanrautamiekka** (`sword_sky_iron`, `characters.glb`, 600 kolmiota): sama origo, suunta, terän pituus (0,74 m)
  ja kahvan geometria (y -0,05..0,055, säde 1,4 -> 1,3 cm) kuin `sword`illa, joten käsikiinnitystä ei tarvitse
  muuttaa. Lehtimäinen terä (leveimmillään 6 cm), kuusikulmainen poikkileikkaus, tumma siniharmaa meteoriittirauta
  verteksiväreinä (kerroslinjat, kiillotetut terät, satunnaisia kuoppia), kaareva pronssiristikahva, kuusikulmainen
  nuppi ja kierretty nahkakahva. Ei hohtoa. `Fighter.build` valitsee mallin, kun `look.skyIron` on tosi;
  vanhoille asseteille jää värjätty perusmiekka varapoluksi.
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
- **Talousesineet** (`assets/household.glb`, 1,42 Mt / 20 100 kolmiota; `assets-src/blender/household.py`):
  `pukkipoyta`, `penkki`, `vuode`, `tuohikontti`, `pata`, `rieska`, `nauriit`, `kuivakalat`, `lyhde`
  (myös emännän käteen), `kulho`, `kuppi`, `kauha`, `lautanen`, `kori` ja `poyta_kattaus` (sama origo kuin
  pöydällä; levyn pinta 0,76 m). `HH` muuntaa sRGB-värit lineaarisiksi. **`vuode`** (2026-11-22, 974 kolmiota,
  2,12 × 0,94 m): kuorelliset sivuhirret haarajaloilla, halkolaudat, olkipatja, tumma talja (olkitekstuuri
  sävytettynä karvaksi) ja olkipielus päädyssä +X; makaavan hahmon pinta `BED_TOP` 0,50 m.
- **Tietäjä** (`assets/villagers.glb`, noin 2,2 Mt;
  `char_folk.py` → `run_folk()`): `char_tietaja` (noin 29 700 kolmiota,
  sama `RIG` ja luiden nimet kuin taistelijoilla) sekä `sauva` (ote
  origossa, linnunpää -Y, nokka +Z). Viitta ja kanteleen kotelo on
  painotettu vartaloon. Vasen käsi pidetään viitan alla sivulla ja oikea
  on vapaa sauvalle.
- **Louhi** (`assets/louhi.glb`, 1,7 Mt; `char_louhi.py` → `run_louhi()`, lukee ensin `char_folk.py`:n; ajetaan
  avoimessa `characters.blend`issa, kokoelma LOUHI): `char_louhi` (27 500 kolmiota, sama `RIG`, naisvartalo ja
  lepoasento kuin emännällä): musta mekko, sininen esiliina, kultaiset solet ja ketjut, helmikaulakoru, puukko,
  peuran kallo sarvineen päässä (osa hahmoa, ei irrotettava), ei viittaa, paljaat jalat. Kuvalähde omistajan
  Sketchfab-referenssi (ei kopioitu). Pelissä seisoo emännän käsiasennolla; kävelyä ei kokeiltu.
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
- **Eläimet** (`assets/animals/`, 3,1 Mt; `animals.py`, taustalla; lähteet Sketchfab CC-BY 4.0 kansiossa
  `assets-src/_downloads/animals/<nimi>/`): `koira.glb` (8 000 kolmiota, 191 luuta, 0,56 m; `seisoo`, `istuu`, `tassu`),
  `kana.glb` (5 000, 0,37 m; `olo`), `possu.glb` (7 000, 0,50 m; `kavely` paikallaan) ja `kukko_kana.glb` (liikkumattomat
  `kukko` ja `kana_b`). Juurisolmu on eläimen nimi, origo jalkojen välissä, nokka -Y, koko metreinä. Omissa tiedostoissa
  (luiden nimet menevät päällekkäin), materiaali `M_AN_*`. `key_static_channels` kirjoittaa leikkeisiin luiden
  avaimettomat kanavat (muuten viikset ja varpaat siirtyvät viennissä). Uusi eläin = rivi `ANIMALS`-taulukkoon.
- **Villisika** (`assets/animals/villisika.glb`, 0,53 Mt; `boar.py`, taustalla; itse mallinnettu): karju 3 430
  kolmiota, verteksivärit, 1,52 m, origo maassa, kärsä −Y. Juurisolmu `villisika` (28 luuta). Leikkeet 30 fps:
  `idle`, `walk`, `run`, `attack` (osuma 0,30–0,45 s), `hit`, `death`. Pelissä v08.04:stä (`engine/boars.ts`).
- **Tarkistuksen taso:** Blenderin kuvat; kyläläiset, eläimet, esineet ja rakennelmat myös pelin
  kuvakaappauksista, ei liikkeessä. Eläinten GLB:t on tuotu takaisin Blenderiin ja jokainen leike kuvattu.
- **Blender-putket** (`assets-src/blender/`): metsä `build_all.py`,
  taistelijat `char_all.py` → `run_chars()`, kyläläiset `char_folk.py` →
  `run_folk()`, suo `bog.py` → `build_bog()`, pihapiiri `homestead.py` ja
  esineet `household.py`, rauhallisen pihan rakennelmat `yard.py`,
  eläimet `animals.py`, villisika `boar.py` ja sepän paja `smithy.py` (sepän talo `homestead.py`).
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
  - Tyhjät juurisolmut `RIG_F` (`characters.glb`) ja `RIG__tmp` (`villagers_f.glb`) ovat harmittomia.
  - Blender MCP:n oma taustatyökalu ei toimi, koska `BLENDER_PATH` puuttuu.
    MCP-kutsut eivät säilytä Python-tilaa: jokainen kutsu lukee skriptin
    uudelleen.
  - Lähteet hakevat `tools/fetch-*.ps1` (kotikoneella estetty, haettu käsin kansioon
    `assets-src/_downloads/`, ei Gitissä). `.blend`-tiedostot eivät ole Gitissä.

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
- Villisian jalat ovat yhä hieman hoikat, kuolema on jäykkä käsin avaimitettu kaatuminen ja vatsan
  karvatupsut ovat lähellä sahalaitaisia. GLB on 0,5 Mt, koska jokainen luu on leivottu joka ruutuun.
- Talousesineiden tulikivet ja tuhka ovat tasaisen harmaita ilman tekstuuria.
- Miehen huotra on litteä laatikko ja seuraa vain lantiota, joten se menee
  kävellessä reiden ja helman läpi. Selässä kilven kädensija painuu hieman
  panssariin ja sankarin pitkät hiukset menevät kilven läpi. Kantohihna
  kulkee selässä kilven alla, ei kiinnity kilpeen.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`), paitsi `forest_lod.py`.
- Kaukopuiden kortit ovat valaisemattomia albedokuvia ilman itsevarjostusta; jos LOD-raja näkyy, tummenna
  `bake_material`issa. Kortin suuntaisesti katsottuna puu näyttää hieman leveämmältä.
- `forest_lod.glb` sisältää omat kopiot `M_Log`- ja dirt-tekstuureista (noin 0,8 Mt), koska tiedostot
  eivät jaa materiaaleja.

## Koodin väliaikaiset korvikkeet (odottavat malleja)

- **Metsästys (v06.04, `src/hunt/models.ts`)**: jousi (1,44 m, kahva origossa, lavat ±z, jänne −y käden
  kehyksessä; jänne on koodin Line, joka seuraa oikeaa kättä), nuoli (0,78 m, perä origossa, kärki +z) ja
  jänis (noin 0,55 m, origo maassa, kuono +z; yhdistetty vartalo + kaksi korvaa niveltyvinä solmuina,
  verteksivärit). Blender-versiot samoilla mitoilla, origoilla ja suunnilla; jänikselle loikka-, pako- ja
  kuolinasento tai luut (peli liikuttaa nyt vain vartaloa ja korvia). Miessankarilla ei ole nuoliviiniä.

- **Loukkaantunut jousineito**: `lying`-asento (kuin kuollut tietäjä), ei jousta. Tarvitaan istuva/kyljellään-asento.
- **Nuori urho kyläläisenä**: `char_urho` ilman aseita (`spawnVillager`); anna tarvittaessa oma rauhan asento.

## Seuraava Blender-tehtävä

**Metsäjänis**: korvaa `src/hunt/models.ts`:n jäniksen samoilla mitoilla, origolla ja suunnilla (ks. yllä);
loikka-, pako- ja kuolinasento tai luut. Sepän pihaan ei tehdä uutta ennen kuin Codex on integroinut sen.

Muut: rautakautinen jousi, nuoli ja miehen nuoliviini (korvikkeiden mitat yllä); kaukopuiden
valaistu atlas, jos vaihtoraja näkyy; legacy-hahmojen poisto käsisavutestin jälkeen (noin 1,7 Mt kummassakin);
sormet, koiran kävely, istuva tietäjä, loukkaantuneen jousineidon asento ja sepän pihdit (vasen käsi).

## Ei vielä aloiteta

- Isännän malli.
- Kuvakortti-impostorit (useita kulmia) tai uudet LOD-tasot ennen kuin omistaja on mitannut FPS:n peliläppärillä.
- Dialogianimaatiot ennen omistajan palautetta rauhallisesta pihasta.
