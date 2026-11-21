# Blender handoff — 3D Kalevala

Kanoninen Blender-mallien ja asset-putkien nykytila. Pidä tämä alle noin
250 rivin / 20 kt:n. Pelikoodin ja integraation tila on
`docs/AGENT_HANDOFF.md`:ssä.

## Nykytila

Päivitetty: 2026-11-21 (Claude, Windows; pohja main 8fc9397)

- **Metsän LOD- ja reuna-assetit** (`assets/forest_lod.glb`, 1,6 Mt; `assets-src/blender/forest_lod.py`,
  branch `claude/terrain-assets`, tarkista merge-tila). Peli ei vielä lataa tiedostoa. Skripti lukee
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
  - Katsottu Blenderin Cycles-kuvista 70 m:n päästä kahdesta kulmasta täyden puun rinnalla ja
    reunanäkymänä. Pelissä katsomatta: valaistus ja sävy suhteessa täysiin puihin, LOD-vaihdon näkyvyys.
- **Mainissa** ovat `assets/forest.glb`,
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
- **Hihat ja ranteet.** Pitkän hihan (`torso_parts`, loppu 0,97) leikkasi aiemmin vartalon z-alaraja 0,95 ("katkennut
  ranne"); käsivarren verteksejä rajaa nyt vain `arm_t`. Sankarin hiha (0,78) ei muuttunut.
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
  verteksiltä ennallaan, tarkistettu tiivisteellä) samalla luurangolla (23 luuta, yksi skin), painoilla ja
  lepoasennolla. Solmut: `char_hero_base` / `_mail` / `_greaves` / `_shoes` (`characters.glb`) ja
  `char_jousineito_base` / `_mail` / `_greaves` / `_shoes` (`villagers_f.glb`). `Fighter.build` valitsee nyt
  kampanjavarusteiden mukaiset osat kummallekin sankarille. Kolmiot: hero base 27 600,
  mail 2 800, greaves 260, shoes 4 700; jousineito base 28 500, mail 3 200, greaves 260, shoes 4 700. Tiedostot
  kasvoivat: `characters.glb` 5,3 -> 7,1 Mt ja `villagers_f.glb` 3,2 -> 5,0 Mt (base kopioi kokonaisen hahmon);
  koko asussa miehellä ~35 400 kolmiota (legacy 28 200). Sisältö:
  - mies base: iho, hiukset, **kokonainen** sininen pellavatunika hihoineen ja helma (0,98 -> 0,50), housut, säärikäärit,
    **paljas jalkaterä** (`foot_skin_parts`), vyö (`flange=0,014`: rengaslevyt tunikan pinnasta vyön ulkopintaan, jotta
    vyö ei leiju ilman rengaspaitaa) ja huotra; mail = rengaspaita 0,47:ään, rengashelma (`skirt` 1,0 -> 0,57) ja
    hihansuun nauha, samat mitat kuin legacyssa; kokonaisuus näyttää legacyn kaltaiselta;
  - nainen base: legacy-asu ilman kenkiä (paljas jalkaterä), viitta ja viini mukana; mail = rengaspaita (infl. 0,021)
    ja rengashelma, joka käyttää tunikan helman rivejä (`fitted_skirt` 1,05 -> 0,62) mutta jokainen säteen termi
    >= 1,2 cm suurempi (ei läpileikkausta missään kulmassa) sekä oma vyönauha rengaspaidan päällä; ei hihansuun nauhaa
    (polven ja kyynärpään akseli ei istu naisen käsivarteen); greaves/shoes samoilla funktioilla kuin miehellä;
  - `legs_parts` on jaettu apufunktioiksi (tuloksen järjestys sama), joten muiden hahmojen jalat eivät muuttuneet.
  Tarkistus: `char_modular_check.py` (`check_set("hero"|"fem")`) taivuttaa luurangon lepo-, kävely-, torjunta-,
  ylälyönti- ja sivuasentoon ja mittaa kerrosten välin; vyö-, huotra-, viini- ja kengän yläreunan päällekkäisyydet ovat
  tarkoituksellisia. Ääriasennoissa (jalka eteen yli 0,35 rad) sininen tunika pistää rengashelman läpi etureidestä
  **kuten legacyssakin**; naisen säärisuojat jäävät baggy-housujen alle polven kohdalla. Katsottu: edestä, sivulta,
  takaa ja yläviistosta lepoasennossa sekä kolmessa ääriasennossa molemmilla. Runtime-integraation jälkeinen
  varusteiden vaihtuminen odottaa omistajan käsisavutestiä.
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
- **Tarkistuksen taso:** mallit on katsottu Blenderin kuvista (lepoasento), kyläläiset, eläimet, esineet ja
  rakennelmat lisäksi pelissä kuvakaappauksista, ei liikkeessä. Eläinten GLB:t on tuotu takaisin Blenderiin ja
  jokainen leike kuvattu.
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
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`), paitsi `forest_lod.py`.
- Kaukopuiden kortit ovat valaisemattomia albedokuvia ilman itsevarjostusta: Cycles-kuvissa ne ovat
  hieman vaaleampia ja litteämpiä kuin täydet puut. Jos ero näkyy pelissä LOD-rajalla, tummenna kuvia
  skriptissä (`bake_material`) tai lisää kortteihin sävyliukuma. Kuvat on otettu kolmesta suunnasta,
  joten suoraan kortin suuntaisesti katsottuna kaksi muuta korttia näyttävät puun hieman leveämpänä.
- `forest_lod.glb` sisältää omat kopiot `M_Log`- ja dirt-tekstuureista (noin 0,8 Mt), koska tiedostot
  eivät jaa materiaaleja.

## Koodin väliaikaiset korvikkeet (odottavat malleja)

- **Loukkaantunut jousineito**: `lying`-asento (kuin kuollut tietäjä), ei jousta. Tarvitaan istuva/kyljellään-asento.
- **Nuori urho kyläläisenä**: `char_urho` ilman aseita (`spawnVillager`); anna tarvittaessa oma rauhan asento.

## Seuraava Blender-tehtävä

Ei avointa Blender-tehtävää ennen kuin metsän koodivaihe (tilkut ja LOD-renkaat, ks. AGENT_HANDOFF)
on katsonut `forest_lod.glb`:n pelissä; sen jälkeen mahdollinen kaukopuiden sävyn viritys. Muuta:
legacy-hahmojen poisto omistajan käsisavutestin jälkeen (säästää noin 1,7 Mt kummassakin), sormien
viimeistely, koiran kävelyleike, istuva tietäjä ja loukkaantuneen jousineidon asento.

## Ei vielä aloiteta

- Isännän malli.
- Kuvakortti-impostorit (useita kulmia) tai uudet LOD-tasot ennen kuin `forest_lod.glb` on mitattu pelissä.
- Metsästyksen assetit (jänis, jousi aseena, nuolet, nuoliviini) ennen perusta- ja metsävaihetta.
- Dialogianimaatiot ennen omistajan palautetta rauhallisesta pihasta.
