# Assettien lähteet ja lisenssit

Ulkopuoliset assetit ovat [Poly Havenista](https://polyhaven.com) ja Blender
Studiolta, lisenssiltään **CC0** (vapaa käyttää, ei nimeämisvelvoitetta).
Poikkeus ovat eläimet (`animals/`), jotka ovat **CC-BY 4.0** -lisenssillä ja
vaativat tekijän nimeämisen myös pelissä. Lähdetiedostot ovat kansiossa
`assets-src/_downloads/` (ei Gitissä); Poly Havenin tiedostot haetaan
skripteillä `tools/fetch-*.ps1`.

## `forest.glb`

| Pelin malli | Lähde (Poly Haven -tunniste) | Käyttö |
| --- | --- | --- |
| Kuusten oksakortit | `fir_sapling` | Taimet renderöity läpinäkyviksi oksakuviksi atlakseen |
| Mäntyjen oksakortit | `pine_sapling_small` | Sama |
| Männyn kaarna | `pine_bark` | Väriä muokattu (lämmin sävy, harmaa tyvi verteksiväreillä) |
| Kuusen kaarna, kodan seipäät | `fir_tree_01` (vain kaarnatekstuuri) | Vaalennettu |
| Kodan kate | `pine_bark` | |
| Kivet `rock_1`–`rock_6`, nuotion kivet | `rock_moss_set_01`, `rock_moss_set_02` | Kevennetty (Decimate) |
| Kelo `log`, nuotion kalikat | `dead_tree_trunk` | Kevennetty |
| Risut `twig_a`–`twig_c` | `dry_branches_medium_01` | Kevennetty |
| Heinät `grass_a`–`grass_d` | `grass_medium_01` | |
| Saniaiset `fern_a`, `fern_b` | `fern_02` | |

Itse tehty Blenderissä (skriptit `assets-src/blender/`): puiden rungot ja
oksistojen geometria, koivun tuohi ja lehdet, mustikka-, puolukka- ja
kanervakortit, kota ja nuotion asettelu.

## `characters.glb`

| Osa | Lähde | Käyttö |
| --- | --- | --- |
| Vartalo, pää, kädet, silmät | [Blender Studio Human Base Meshes](https://www.blender.org/download/demo-files/) v1.4.1, `GEO-body_male_realistic` (CC0) | Sormet koukistettu nyrkkiin; vaatteet johdettu vartalon pinnasta |
| Nahka (vyö, kengät, tuppi, kilven reunus) | Poly Haven `brown_leather` | |
| Villatunika, myssy | Poly Haven `hessian_230` | |
| Sininen alustunika ja housut | Poly Haven `rough_linen` | |
| Tumma villatunika | Poly Haven `poly_wool_herringbone` | |
| Housut, säärikääreet | Poly Haven `cotton_jersey` | Sävytetty verteksiväreillä |
| Kilpien lankut, keihään varsi | Poly Haven `medieval_wood` | Kilpien maalaus tehty itse |

Itse tehty (skriptit `assets-src/blender/char_*.py`): luuranko ja painot,
rengaspanssarin ja koristenauhojen tekstuurit, kypärät, hiukset ja parrat,
säärisuojat, olkaviitta, miekka, keihäs ja kilvet. Hahmojen ulkoasu perustuu
omistajan referenssikuviin (kansio `Reference Pictures/`, ei Gitissä).

Haku: `tools/fetch-characters.ps1`. Ladattu mutta ei käytössä: `metal_plate_02`.

## `villagers.glb`

Sama pohja ja samat lähteet kuin tiedostossa `characters.glb`: Human Base
Meshes -vartalo (CC0) ja Poly Havenin kankaat ja nahka (CC0). Itse tehty
(skripti `assets-src/blender/char_folk.py`): tietäjän viitta, pitkä parta,
kudottu vyö, kanteleen tuohikotelo ja sauva. Tuohipunos on sama laskettu
tekstuuri kuin tiedostossa `household.glb`.

## `smithfolk.glb`

Sama pohja ja samat lähteet kuin tiedostoissa `characters.glb` ja `villagers.glb`:
Human Base Meshes -vartalo (CC0) ja Poly Havenin kankaat ja nahka (CC0). Itse tehty
(skripti `assets-src/blender/char_smith.py`): sepän ja sällin nahkaesiliinat, otsanauha,
käärityt hihat ja sepän vasara.

## `smithfolk_child.glb`

Sama pohja ja samat lähteet kuin tiedostossa `smithfolk.glb` (Human Base Meshes -vartalo CC0,
Poly Havenin kankaat ja nahka CC0). Itse tehty (skripti `assets-src/blender/char_smith_child.py`):
muunnos lapsen mittasuhteisiin, lapsen kasvot, polkkatukka ja luuranko.

## `villagers_f.glb`

Vartalo, pää, kädet ja silmät: Human Base Meshes v1.4.1,
`GEO-body_female_realistic` (CC0), skaalattu ja hieman muotoiltu. Kankaat ja
nahka kuten tiedostossa `characters.glb` (Poly Haven, CC0). Itse tehty
(`char_folk.py`): luuranko ja painot, jousineidon vaatteet, letti, olkaviitta,
nuoliviini ja jousi sekä emännän mekko, esiliina, kupurasoljet ketjuineen,
huivi, vyö, avain ja puukko.

## `louhi.glb`

Vartalo, pää, kädet ja silmät sekä kankaat ja nahka kuten `villagers_f.glb`
(Human Base Meshes `GEO-body_female_realistic`, Poly Haven, CC0). Itse tehty
Blenderissä (`char_louhi.py`): mekko, esiliina ja kirjontanauha, soljet,
ketjut, helmet, vyö, silmämaalit sekä kallo, sarvet ja sulat. Ulkoista
mallia ei ole käytetty; omistajan antama kuva oli vain väri- ja tyyliviite.

## `animals/` (CC-BY 4.0)

Lisenssi: [Creative Commons Attribution 4.0](http://creativecommons.org/licenses/by/4.0/).
Kaikkia malleja on muokattu (skripti `assets-src/blender/animals.py`).

| Tiedosto | Alkuperäinen teos | Tekijä | Muutokset |
| --- | --- | --- | --- |
| `koira.glb` | [Animated Dog, Shiba Inu](https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474) | [quander](https://sketchfab.com/quander) | Kevennetty 33 400 → 8 000 kolmioon, tekstuuri 1024 px ja hieman himmennetty, mukana kolme viidestä animaatiosta |
| `kana.glb` | [Halva the Chicken](https://sketchfab.com/3d-models/halva-the-chicken-ab37ae9021dc4aa29c4cee9778646470) | [Pia Heugel](https://sketchfab.com/piaheugel) | Vain värikartta, 1024 px, hieman himmennetty |
| `possu.glb` | [Piglet](https://sketchfab.com/3d-models/piglet-8343f141936f4c799ed980a3c7c3ae27) | [grs](https://sketchfab.com/sgrosjean) | Kevennetty 17 600 → 7 000 kolmioon, väri tummennettu ruskeaksi, vain värikartta 1024 px |
| `kukko_kana.glb` | [Handpainted rooster and hen](https://sketchfab.com/3d-models/handpainted-rooster-and-hen-34b79d3f8adb43c583d08babf3ef6dc0) | [Enkarra](https://sketchfab.com/Enkarra) | Jaettu kahdeksi malliksi (`kukko`, `kana_b`), värejä himmennetty, tekstuuri 1024 px |

Kaikki on lisäksi skaalattu luonnolliseen kokoon ja käännetty nokka suuntaan -Y.

## `animals/villisika.glb`

Itse tehty Blenderissä (skripti `assets-src/blender/boar.py`): geometria, verteksivärit, luuranko, painot
ja kaikki kuusi animaatiota. Valmista CC0-villisikaa ei löytynyt (haetut mallit olivat maksullisia
royalty free -lisenssillä). Omistajan antama kuvapankin siluetti oli vain mittasuhteiden ja tunnelman
viite; sitä ei ole jäljennetty eikä käytetty tekstuurina. Ei ulkopuolisia lähteitä, ei CC-BY-velvoitetta.

## `homestead.glb`

| Osa | Lähde (Poly Haven -tunniste) | Käyttö |
| --- | --- | --- |
| Olkikatot, heinät haasialla | `thatch_roof_angled` | Vaalennettu ja sävytetty oljen väriseksi |
| Savirappaus, ruukut, kuopan maalattia | `clay_plaster` | Vaalennettu |
| Turvekatto ja seinänvieruspenkka | `forest_leaves_02` | Tummennettu |
| Kuorelliset riu'ut ja halot | `pine_bark` | |

Itse tehty Blenderissä (skripti `assets-src/blender/homestead.py`): kaikki
geometria sekä oksapunoksen ja harmaantuneen puun tekstuurit (laskettu
koodilla). Tuohi on metsän koivun tuohitekstuuri (`trees.py`). Rakennusten
lähteet: J.-M. Vuorinen, *Rakennukset ja rakentajat Raision Ihalassa
rautakauden lopulla ja varhaisella keskiajalla* (Turun yliopisto 2009), luku 2
(metallikauden rakennusjäännökset Suomessa).

Haku: `tools/fetch-homestead.ps1`. Ladattu mutta ei käytössä: `reed_roof_03`.

## `yard.glb`

Sikolätti ja kanakoppi: geometria itse tehty Blenderissä (skripti
`assets-src/blender/yard.py`), samat materiaalit ja lähteet kuin
`homestead.glb`:ssä.

## `lakeside.glb`

Järvenrannan kohtaus: hirsimökki, keittopaikka (kolmijalka, pata, tuli),
istuinhirsi, laituri, tukkivene, mela, ruoko ja kaisla. Geometria itse tehty
Blenderissä (skripti `assets-src/blender/lakeside.py`); materiaalit ja
tekstuurilähteet samat kuin `homestead.glb`:ssä ja `household.glb`:ssä
(Poly Haven `pine_bark`, `forest_leaves_02`, `clay_plaster`, `thatch_roof_angled`,
CC0). Ei uusia ulkopuolisia lähteitä.

## `cairnfield.glb`

Kalmisto: kuppikivi, neljä röykkiömallia ja karsikkomänty. Geometria itse tehty
Blenderissä (skripti `assets-src/blender/cairnfield.py`). Kuppikiven ja röykkiöiden
kivipinta on Poly Havenin `mossy_rock`-tekstuurista (CC0), josta sammal on poistettu
(vain kiven rakenne, muu väri verteksiväreistä); sammalpeite on `forest_leaves_02` (CC0)
ja karsikon kaarna `pine_bark` (CC0) sekä oksakorttiatlas (`assets-src/cards`, oma).
Ei uusia ulkopuolisia lähteitä. `louhi.glb` on kuvattu aiemmin.

## `smithy.glb`

Sepän paja: avokatos, turvekatto, kiviseinä, ahjo, hiillos, palkeet, alasimet, karkaisuastiat,
työkalut, keihäänterän aihiot, keihästeline ja säärisuojat. Geometria ja hiilten hehkutekstuuri itse
tehty Blenderissä (skripti `assets-src/blender/smithy.py`).
Sepän asuintalo `talo_seppa` on `homestead.glb`:ssä samoilla lähteillä kuin muut talot.

| Osa | Lähde (Poly Haven -tunniste, CC0) | Käyttö |
| --- | --- | --- |
| Takaseinän ladottu kivi | `stacked_stone_wall` | Punertava liuske harmaannettu |
| Pajan nokinen lattia | `burned_ground_01` | |
| Ahjon kivet ja suojakivi | `mossy_rock` | Sammal poistettu kuten kalmistossa |
| Palkeiden nahka | `brown_leather` | |
| Ahjon savi, katon puu, tuohi ja turve | `clay_plaster`, `pine_bark`, `forest_leaves_02` | Samat kuin `homestead.glb`:ssä |
| Hiilikori | itse tehty punontatekstuuri | Sama kuin `homestead.glb`:n aidoissa |

Haku: `tools/fetch-smithy.ps1`.

## `map/cairn-site.png`

Kalmiston karttaikoni (48 × 48). Johdettu omistajan ImageGen-kuvasta
(kuppikivi ja Louhi), pienennetty ja värikvantisoitu kartan ikonipalettiin.
Ei ulkopuolisia lähteitä.

## `map/hunt-site.png`

Metsästysapajan karttaikoni (48 × 48): kalliomaalaustyylinen jousimies ja jänis.
Claude piirsi sen koodilla (Pillow) kalmistoikonin neljän värin paletilla.
Ei ulkopuolisia lähteitä.

## `household.glb`

| Pelin malli | Lähde (Poly Haven -tunniste, CC0) | Käyttö |
| --- | --- | --- |
| `kulho` | `wooden_bowl_01` | Kevennetty (Decimate), tekstuuri 512 px |
| `kuppi` | `wooden_bowl_02` | Kevennetty, tekstuuri 256 px |
| `kauha` | `wooden_spoon` | Sama |
| `lautanen` | `carved_wooden_plate` | Sama |
| `kori` | `wicker_basket_01` | Kevennetty, tekstuuri 512 px |
| Kuorelliset jalat ja kekäleet | `pine_bark` | |
| Pata ja rieskat | `clay_plaster` | Sävytetty verteksiväreillä |
| Viljalyhde | `thatch_roof_angled` | Sävytetty oljen väriseksi |

Itse tehty Blenderissä (skripti `assets-src/blender/household.py`): pukkipöytä,
penkki, tuohikontti ja sen punostekstuuri, keittopata tulikivineen, rieskat,
nauriit, kuivakalat, viljalyhde ja pöydän kattaus (`poyta_kattaus`).

Haku: `tools/fetch-household.ps1`. Ladattu mutta hylätty aikakauteen
sopimattomina: `wooden_bucket_01`, `wooden_bucket_02` (rautavanteet),
`wicker_basket_02`, `ceramic_pot` (lasitettu), `jug_01` (posliini).

## `bog.glb`

Itse tehty Blenderissä (skripti `assets-src/blender/bog.py`): mutapinta,
turvereunus ja kuplan malli. Tiedostossa ei ole tekstuureja: peli käyttää
kansion `ground/` sammal- ja maatekstuureja sekä `forest.glb`:n heinämalleja.

## `ground/`

| Tiedosto | Lähde |
| --- | --- |
| `needles_*.webp` | `forrest_ground_03` |
| `moss_*.webp` | `forest_leaves_02` |
| `dirt_*.webp` | `forest_ground_04` |

Ladattu mutta ei käytössä pelissä: `moss_01`, `boulder_01`,
`pine_tree_01` (vain tekstuurit).
