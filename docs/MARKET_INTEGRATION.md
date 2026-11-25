# Markkinapaikka: assetit ja toteutusohje pelikoodille

Claude, 2026-11-25 (pohja main 270a599). Tämä muistio on sille, joka rakentaa markkinapaikan 3D-kohtauksen
(Codex tai Claude). **Peli ei vielä lataa mitään näistä.** Mallien sisältö, mitat, törmäysehdotukset ja
ajokomennot ovat kunkin skriptin alun docstringissä (`assets-src/blender/market*.py`, `char_market*.py`);
tässä on vain se, mitä pelikoodin tekijän pitää tietää. Putkien tila on `BLENDER_HANDOFF.md`:ssä.

## Tiedostot

| Tiedosto | Koko | Kolmiot | Sisältö |
| --- | --- | --- | --- |
| `assets/market_boat.glb` | 0,91 Mt | 10 300 | kauppalaiva, masto kahtena vaihtoehtona, lasti, telat, airo |
| `assets/market.glb` | 0,99 Mt | 9 600 | kolme katosta, myyntipöytä, turkisteline, aseteline |
| `assets/market_goods.glb` | 0,95 Mt | 6 500 | nassakat, tynnyrit, viljakorit, maavaate tavaroineen, kuivakalanippu |
| `assets/marketfolk.glb` | 4,6 Mt | 80 000 | `char_kauppias`, `char_seppa_markkina`, `char_salli_markkina` (luuranko `RIG`) |
| `assets/marketfolk_f.glb` | 3,3 Mt | 55 000 | `char_emanta_markkina`, `char_nainen_arki` (naisluuranko nimellä `RIG`) |

Kaikki: Z ylös Blenderissä (pelissä +Y), **etusivu/asiakaspuoli/keula −Y** (pelissä +Z), metrit. Jokainen malli
on oma juurisolmunsa; origo maan tasossa mallin keskellä, ellei toisin mainita. Materiaalit eivät ole jaettuja
tiedostojen kesken, joten samat puu- ja tuohitekstuurit tulevat useaan kertaan (noin 0,2–0,4 Mt tiedostoa kohti).

## Kauppalaiva (`market_boat.glb`)

Esikuva Saaremaan Salmen laivat (n. 700–750 jKr.): klinkkerirunko, köli, viisi tuhtoa, irrotettava masto ja
raakapurje käärittynä; keulassa pelkistetty hirvenpää (Kalevalan "hirvipää", karjalaiset kalliopiirrokset).
Pituus noin 11,6 m, leveys 2,5 m, laita 1,16 m.

- `laiva`, `laiva_masto` **tai** `laiva_masto_laskettu` (ei molempia), `laiva_lasti` ja `laiva_telat` jakavat
  saman origon (kölin keskikohta maan tasossa). Sijoita ne yhdellä muunnoksella. Maaston on oltava laivan alla
  tasainen; köli lepää telojen päällä (z 0,16).
- `airo`: oma origo kahvan päässä, lapa −Y. Monista tarpeen mukaan.
- Tyhjät pisteet: `mount_keula` (hirvenpää; valo/efekti) ja `mount_lautta` (maihinnousukohta perän vieressä).
- Törmäys docstringissä: runko laatikkona + kaksi ympyrää päissä, ohjausmela erikseen. Laivaan ei kävellä.
- Masto on 7,75 m korkea: jos kamera häivyttää esteitä, masto kannattaa jättää häivytyksen ulkopuolelle tai
  käyttää rannalla laskettua mastoa.

## Kojut ja telineet (`market.glb`)

- `katos_vaate`, `katos_tuohi`, `katos_nahka`: avokojuja. Paalut törmäävät ympyröinä; vaate- ja
  tuohikojun alle pääsee kävelemään (räystäs ≥ 2,05 m). Nahkasuojan takaluiska on tuulensuoja (laatikko).
- `myyntipoyta`: pinta `COUNTER_TOP` 0,80 m, tyhjä `mount_poyta` pinnan keskellä tavaroille.
- `turkisteline`: kolme ketunnahkaa, kaksi oravannippua, hirvennahka ja karhuntalja ovat osa mallia.
- `aseteline`: **aseita ei ole mallissa.** Kloonaa olemassa olevat mallit suoraan tyhjän pisteen
  maailmamuunnokseen (kuten sepän `mount_keihas_*`):
  - `mount_keihas_1..3` → `characters.glb`:n `spear`
  - `mount_kilpi_1..2` → `characters.glb`:n `shield_hero` / `shield_pohja` / `shield_urho`
  - `mount_kirves_1..2` → `kirveet.glb`:n `kirves_parta` ja `kirves_karjala`
  Esikatselussa kaikki istuvat paikoilleen ilman läpimenoja. Varkaus-/kauppalogiikka voi piilottaa
  yksittäisen kloonin.

## Kauppatavarat (`market_goods.glb`)

`nassakka`, `nassakka_kylki`, `tynnyri_suolakala` (avoin, kansi kyljessä), `tynnyri_kiinni`, `viljakori_a`
(ohra), `viljakori_b` (ruis + kauha), `maavaate` (kangas ja tavarat yhtenä solmuna: ruukut, tuohirasiat,
pronssikorut, meripihkahelmet, luukammat, hioinkivi, rautaharkot) ja `kuivakala_nippu` (origo
ripustuskohdassa; ripusta katoksen orteen tai telineeseen). Astioissa on vitsavanteet, ei rautaa.
Maavaate on 1,3 cm maan yläpuolella: maaston on oltava sen alla tasainen.

## Hahmot (`marketfolk.glb`, `marketfolk_f.glb`)

Samat luiden nimet, kierrot ja lepoasento kuin muilla kyläläisillä, joten `folk.ts`:n asennot käyvät sellaisinaan.
Miehet ovat vakiomiehen vartalolla (kuten `smithfolk.glb`), naiset naisvartalolla (kuten `villagers_f.glb`), siksi
kaksi tiedostoa. Origo maassa jalkojen välissä, kasvot −Y. Törmäys: ympyrä noin 0,28–0,30 m.

- `char_kauppias`: vierasmaalainen kauppamies. Syvänsininen tunika lautanauhoin, viininpunainen kiedottu nuttu,
  helavyö (pronssisolki ja helat, kukkaro, puukko), pronssinen torques ja nauhasidotut saapikkaat; tumma tukka ja
  lyhyt harmaantuva parta. 28 900 kolmiota.
- `char_seppa_markkina`, `char_salli_markkina`: samat kasvot kuin `char_seppa` ja `char_salli`, ilman esiliinoja.
  Sepällä puhdas tunika ja oliivinharmaa hartiaviitta rengassoljella, sällillä suippo huopalakki ja olkalaukku.
  Jos pajan väki halutaan markkinoille, käytä näitä; pajalla pysytään vanhoissa.
- `char_emanta_markkina`: sama emäntä kuin `char_emanta` (sama kasvo- ja hiusparametrit), muinaispuvun henkinen
  juhla-asu: sininen mekko, punainen hartiavaate pronssispiraalireunuksin ja pyöreällä soljella, sininen
  esiliina spiraalinauhoin, kupurasoljet helyketjuineen, huntu ja otsanauha.
- `char_nainen_arki`: uusi nuori nainen arkiasussa (punertava palmikko, harmaanruskea hihaton villamekko,
  pellavapaita hihat käärittyinä, karkea esiliina, vyö ja puukko, yksi pieni solki).

Tunnetut rajat: kädet lepoasennossa (kädet alhaalla) painuvat helman ja vyön sivuun 1,4–2,7 cm kuten vanhoillakin
kyläläisillä. Hartiavaate ja sepän viitta seuraavat rintaa, joten laulu- tai iskuasennossa käsi menee niiden läpi.
Kauppiaan helma puskee ääri-kävelyssä 3 cm. Uudet materiaalit `M_MK_Trim_pk`, `M_MK_Trim_kp`, `M_MK_Trim_spiral`;
muut ovat samoja `C_*`-materiaaleja kuin muilla hahmoilla.

**Havaittu vanhassa mallissa:** `villagers_f.glb`:n `char_emanta`n hihansuut ja vyö saavat painot lähimmistä
vartaloverteksistä (myös reisi ja kyynärvarsi), joten kädet alas laskettuina hihansuut voivat venyä renkaiksi.
Tarkista pelissä; uusissa malleissa tämä on korjattu.

## Suorituskyky

Rakennelmat ja tavarat ovat yhteensä noin 26 000 kolmiota ja 2,9 Mt; hahmotiedostot 7,9 Mt lisää. Jos tavaroita monistetaan paljon
(esim. 20 nassakkaa), käytä instansointia. Hahmot ovat 25 000–29 000 kolmiota kukin kuten muutkin kyläläiset; viisi hahmoa kerralla on noin 135 000 kolmiota.
FPS:ää ei ole mitattu, koska kohtausta ei vielä ole.

## Tarkistettu / ei tarkistettu

- Tarkistettu: Blender-kuvat viedyistä ja uudelleen tuoduista GLB:istä (orkestroija katsoi jokaisen mallin;
  hylättyjä ja korjattuja: kuivakalanippu, suolarakeet, tuohikatos, nahkasuoja, ketunnahat, asetelineen
  seinä, pöytäliina).
- Ei tarkistettu: lataus Three.js:ssä, sävykartoitus pelin valaistuksessa, FPS, törmäykset pelissä.
