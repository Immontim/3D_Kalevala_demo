# Pohjan uudet soturit ja kirveet: toteutusohje pelikoodille

Claude, 2026-11-24 (pohja main fc36128). Tämä muistio on Codexille tai sille, joka vie mallit peliin.
Mallit ovat valmiita assetteja, mutta peli ei vielä lataa niitä. Mallien sisältö ja putki on kirjattu
`BLENDER_HANDOFF.md`:hen ja `assets-src/blender/char_pohja.py`:n alkuun. Pelikoodin päätökset kirjataan
`AGENT_HANDOFF.md`:hen.

## Tiedostot

| Tiedosto | Koko | Sisältö |
| --- | --- | --- |
| `assets/pohja_tanakka.glb` | 2,1 Mt | lyhyt, tanakka ja parrakas soturi, 1,58 m |
| `assets/pohja_hoikka.glb` | 2,0 Mt | pitkä, laiha ja parraton soturi, 1,86 m |
| `assets/kirveet.glb` | 0,6 Mt | `kirves_parta` ja `kirves_karjala` (ei luurankoa) |

Molemmissa hahmotiedostoissa on yksi luuranko nimellä `RIG`. Siinä on samat 23 luuta ja samat
kierrot (roll) kuin taistelijoilla, joten `Fighter`in luukierrot liikuttavat hahmoja sellaisinaan.
Luiden pituudet ja paikat ovat kuitenkin eri, joten hahmo tarvitsee oman tiedostonsa samaan tapaan kuin
`smithfolk_child.glb`. Tiedostoissa on lisäksi tyhjät juurisolmut `RIG__tmp` ja `RIG_F` kuten
sepän tiedostoissa; ne voi poistaa.

## Osat ja näyttösäännöt

Osat ovat samassa luurangossa ja yhdessä skinissä (`<h>` = `tanakka` tai `hoikka`):

| Solmu | Kolmiot | Milloin näkyy |
| --- | --- | --- |
| `char_<h>_base` | 24 000 / 22 800 | aina: iho, hiukset, tanakalla parta, housut, säärikääreet, kengät ja vyö |
| `char_<h>_nuttu_vaalea` | 3 700 | **täsmälleen yksi** nutuista aina näkyvissä |
| `char_<h>_nuttu_tumma` | 3 900 | (perusosassa ei ole vartaloa nutun alla) |
| `char_<h>_mail` | 2 900 | jos hahmolla on panssaripaita |
| `char_<h>_huotra` | 170 | **vain jos hahmolla on miekka**; ilman miekkaa ei huotraa |
| `helmet_<h>` | 970 | kypärä (ei luurankoa); kiinnitä pääluuhun kuten `helmet_pohja` |

Täysin puettu hahmo (perusosa, nuttu, rengaspaita ja kypärä) on noin 31 000 kolmiota, eli samaa luokkaa
kuin `char_pohja`. Nutut:

- **vaalea**: värjäämätön harmaanbeige villa. Pienet punaiset vinoneliökirjailut ovat kauluksessa,
  rintahalkiossa, hihansuissa ja helmanauhassa.
- **tumma**: lähes musta villa, mukaelma nykyisestä Pohjan asusta. Siinä on luonnonvaalea-punainen siksak
  kauluksessa ja leveissä hihansuissa, sama kirjailu päällekkäisliepeen reunassa kauluksesta oikealle
  kupeelle ja helmaa pitkin alas, leveä helmanauha ja pidempi helma.

Uudet materiaalit ovat `C_Trim_pohja_vaalea` ja `C_Trim_pohja_tumma`. Muut materiaalit ovat samoja kuin
taistelijoilla (`C_Wool`, `C_Mail` ja niin edelleen). Rengaspaidan metallimateriaali tarvitsee
ympäristökartan kuten muillakin.

## Kiinnityspisteet

Molemmat kiinnityspisteet ovat lantioluun (`hips`) lapsia. Ase pannaan pisteen lapseksi
nollasijaintiin ja nollakiertoon.

- `mount_huotra`: `characters.glb`:n `sword` (tai `sword_sky_iron`) asettuu huotraan samoin kuin
  sankarilla. Huotran pituus ja suunta ovat samat kuin sankarilla (`SHEATH_D`, 0,80 m), ja vain paikka
  on siirretty lantion mukaan.
- `mount_kirves`: kirves (`kirveet.glb`) roikkuu vyöllä oikealla kupeella. Silmä on 5 cm vyön
  yläpuolella, varsi osoittaa alas ja hieman taaksepäin, terä eteen ja lappeet sivuille. Kirves voi
  roikkua siinä myös silloin, kun kädessä on miekka.

Lepoasennon paikat ovat Blenderin koordinaateissa (peliin x, z, −y):

| | tanakka | hoikka |
| --- | --- | --- |
| vyön korkeus | 0,932 | 1,131 |
| `mount_huotra` | (0,226; −0,062; 0,962) | (0,165; −0,046; 1,158) |
| `mount_kirves` (kirveen ote) | (−0,262; 0,082; 0,413) | (−0,193; 0,088; 0,612) |

## Kirveet

`kirves_parta` on parrakas kirves (kuva 1). Alaterä roikkuu partana, ja teräsreunassa näkyy hitsisauma.
Varsi on vaalea ja suora. Malli on 2 200 kolmiota.

`kirves_karjala` on karjalainen leviävä kirves (Gromovon kirves, kuvat 2–3). Siinä on kapea kaula,
korvakkeet silmän alla, hopeaupotus ja tumma varsi, jonka otteessa on nahkakääre. Malli on 3 600
kolmiota.

Molemmat ovat yksiteräisiä yhden käden kirveitä. Varsi on 0,69 m, terä 16–18 cm ja pää 19 cm silmän
takareunasta terään.

**Kehys on sama kuin miekalla:** ote on origossa, varsi kulkee −Y:hen kohti päätä (pelissä +z, kuten
miekan terä), terä osoittaa +X:ään ja lappeet ±Z:aan. Varren säde otteessa on 1,45 cm (miekan kahva
1,4 cm), joten kirves käy samaan käsikiinnitykseen kuin miekka (`GRIP`, `HAND_TWIST`). Pelissä riittää
valita malli kuten `weaponName`.

Integroinnissa tarkistettava riski: en pystynyt Blenderissä varmistamaan, kumpi miekan sivu johtaa
sivalluksessa. Jos kirves iskee pelissä hamaralla, käännä mallia 180° varren ympäri, eli z-akselin
ympäri käden kehyksessä. Sama kääntö pätee `mount_kirves`iin vain, jos terän halutaan osoittavan
taaksepäin.

Pelisuunnittelun ehdotus: kirves on miekkaa halvempi sotakalu. Lyhyempi ulottuvuus kuin miekalla (pää
0,6 m otteesta) ja voimakkaampi, hitaampi isku sopisivat sille. Pistoa kirveellä ei ole.

## Keihäs: otekanava

Miekalla ja kirveellä kanavaa ei tarvita. Jos uusille hahmoille annetaan keihäs, käytä näitä
`GRIP_CHANNEL`in tilalla. Arvot ovat pelin koordinaateissa (oikea käsi, lepoasento; vasen käsi on
peilikuva x:n suhteen):

- tanakka: p (−0,4026; 0,7364; 0,0981), d (0,3324; −0,0135; 0,9431)
- hoikka: p (−0,3855; 0,8840; 0,1277), d (0,2781; −0,1217; 0,9528)

## Tarkistukset ja tunnetut rajoitteet

Mittasin kerrosten välit viidessä asennossa. Mittaus vastaa `char_modular_check.layer_margin`ia, ja se
tehtiin hahmon mittoihin muunnettua vartaloa vasten (`pohja_clearance`). Negatiivinen arvo tarkoittaa,
että ulompi kerros painuu sisemmän alle.

| Pari | tanakka lepo / ääri-kävely | hoikka lepo / ääri-kävely | sankari (vertailu) |
| --- | --- | --- | --- |
| rengaspaita vs nuttu | −15 mm (51–59 vert.) / −23 mm | −12 mm (38–45) / −14 mm | −13 mm (103) / −14 mm (109) |
| vyö vs nuttu | +5,5 mm / +3,5 mm | +3,6 mm / +1,4 mm | – |
| vyö vs rengaspaita | −15 mm (24 vert., selän alareuna) | −11 mm (21) | ei mitattu |
| nutun helma vs housut | +13 mm / −8 mm | +7 mm / −16 mm | – |

- Lepoasennossa leikkaukset ovat kainaloissa ja selässä vyön alareunassa samaan tapaan kuin sankarilla.
  Kuvissa ne eivät näy.
- **Ääri-kävelyssä** (reisi 0,6 rad eteen) eteen heilahtava reisi puskee housut helman ja rengaspaidan
  läpi. Sankarilla on sama rajoite: samassa asennossa tunika pullistuu rengashelman läpi. Leikkautuvia
  verteksejä on uusilla hahmoilla vähemmän, mutta painuma on tanakalla syvempi. Jos pelin kävely jää alle
  noin 0,4 radiaanin, ongelmaa ei pitäisi näkyä, mutta tätä ei ole kokeiltu pelissä.
- Vyöllä roikkuva kirves ja huotra seuraavat vain lantiota. Ne voivat mennä kävellessä reiden läpi,
  kuten sankarin huotra.
- Hiukset, kasvot ja kulmakarvat ovat talon tyyliä: sileä hiuskuori, ei kasvotekstuuria. Hoikan pitkät
  hiukset menevät kypärän takaa sen läpi samoin kuin sankarilla.
- Kumpikin GLB sisältää oman kopionsa kangas- ja rengastekstuureista (noin 1,5 Mt), ellei peli jaa niitä
  nimen perusteella.
- Hahmoja ei ole katsottu pelissä eikä liikkeessä. Kuvat ovat Blenderin lepoasennosta, kävelyasennosta
  ja lähikuvista.

## Uudelleenajo

Hahmot rakennetaan taustalla `characters.blend`in **kopiossa**, joten lähdetiedostoa ei muuteta. Ohje
on skriptin alussa (`run_axes`, `run_pohja("tanakka" | "hoikka", preview_dir, out_dir)`). Älä aja kahta
ajoa rinnakkain samasta kansiosta: `img_from_px` kirjoittaa välitiedoston yhteiseen tekstuurikansioon.
Mittasuhteet ovat `BUILDS`-taulukossa. Uusi vartalotyyppi syntyy lisäämällä sinne uusi rivi.
