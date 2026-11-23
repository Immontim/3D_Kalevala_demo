# Sepän pihapiiri: sijoitusehdotus pelikoodille

Claude, 2026-11-23 (vaiheet B3–B4, pohja main ebd6a23). Muistio Codexille: miten valmiit mallit asetetaan
peliin. Tämä on ehdotus. Pelikoodin päätökset ja toteutuksen tila kirjataan `AGENT_HANDOFF.md`:hen,
mallien sisältö ja mitat `BLENDER_HANDOFF.md`:hen ja `assets-src/blender/smithy.py`:n alkuun.

Luvut tulevat skriptistä `assets-src/blender/smithy_yard.py`. Skripti kokoaa pihan Blenderiin samoilla
kaavoilla kuin `world.ts` (`onRing`, `fromLocal`, aitasilmukka) ja tulostaa taulukon `LAYOUT_JSON`.
Muutos kannattaa tehdä skriptiin ja ajaa uudelleen, ei laskea käsin.

## Mallit

| Tiedosto | Solmut |
| --- | --- |
| `smithy.glb` | `paja`, `paja_katto`, `ahjo`, `ahjo_hiillos`, `palkeet`, `paja_rekvisiitta`, `poyta_aihiot`, `keihasteline`, `saarisuojat_myytavat` + tyhjät pisteet |
| `homestead.glb` | `talo_seppa`, `aitta`, `pino` ×6, `polkky`, `aita`, `portinpieli` |
| `household.glb` | `pukkipoyta` (aihioiden alle), `penkki`, `pata` |
| `smithfolk.glb` | `char_seppa`, `char_salli`, `sepan_vasara`, luuranko `RIG` (sama kuin `villagers.glb`:ssä) |

## Pihan pohja

Sama kehämalli kuin `homestead`/`yard`-pihoilla: aita `FENCE_R = 12.9`, portti etelässä
(`GATE_HALF = 0.11`), kamera säteen 12,2 sisällä. Rauhallinen RPG-piha, ei aaltotaistelua.

| Kohde | `onRing(a°, d, hx, front, back)` | x | z | yaw |
| --- | --- | --- | --- | --- |
| Paja (`SMITHY`) | `onRing(155, 14.2, 3.4, 2.6, 2.3)` | 6.001 | -12.870 | 5.8469 |
| `talo_seppa` (`HOUSE`) | `onRing(255, 16.0, 5.3, 3.4, 3.4)` | -15.455 | -4.141 | 7.5922 |
| `aitta` (`STOREHOUSE`) | `onRing(-38, 15.6, 2.0, 3.0, 2.1)` | -9.604 | 12.293 | 2.4784 |

Miksi näin:
- Portista tuleva näkee pajan ja ahjon hehkun suoraan edessä noin 14° oikealla. Paja on lähes
  suoraan päin, ja kauppapaikka on pihan puolella.
- Ahjosta on sepän taloon noin 23 m (paloriski).
- Halkopinot ovat kahtena kolmen pinon rivinä aidan vieressä talon ja pajan välissä. Lähin puu on
  noin 5 m pajan räystäästä ja noin 10 m ahjosta.
- Talon ja aitan etuseinät ovat yli 12,6 m:n säteellä, kuten tilan pihalla, joten kamera ei mene
  niiden sisään.

### Pajan kaikki solmut samalla muunnoksella

Jokainen `smithy.glb`:n solmu asetetaan kohtaan `SMITHY` (x 6.001, z -12.870, yaw 5.8469), kuten
`place(key, SMITHY)`. Verkkojen koordinaatit ovat valmiiksi pajan origossa. Kaksi poikkeusta:

- `poyta_aihiot` on `pukkipoyta`n omissa koordinaateissa. Pöytä ja aihiot menevät kumpikin kohtaan
  `fromLocal(SMITHY, -1.25, 3.35)` = (3.453, -10.362), yaw `SMITHY.yaw`. Jos peli lukee solmun
  glTF-siirtymän, se on jo (-1,25, 0, 3,35) pajan origosta.
- Pajan sisäinen piste Blenderissä (bx, by) on pelissä `fromLocal(SMITHY, bx, -by)`.

### Muut esineet (pelin koordinaatit)

| Malli | x | z | yaw |
| --- | --- | --- | --- |
| `pino` (takarivi, r 12) | -4.592 | -11.087 | 6.6759 |
| `pino` | -6.623 | -10.007 | 6.8679 |
| `pino` | -8.411 | -8.559 | 7.0599 |
| `pino` (eturivi, r 11,35) | -4.298 | -10.505 | 6.6715 |
| `pino` | -6.306 | -9.437 | 6.8722 |
| `pino` | -8.061 | -7.991 | 7.0729 |
| `polkky` | -5.253 | -8.743 | 0.8 |
| `penkki` (talon seinustalla) | -12.904 | -1.491 | 7.5922 |
| `pata` (keittopaikka talon edessä) | -10.223 | -5.120 | 8.1922 |
| `portinpieli` | ±1.416 | 12.822 | ±1 |

`aita` tulee `world.ts`:n silmukalla sellaisenaan. Kohdat, joissa aita on `blocked()`-alueen sisällä,
jäävät pois (26 pätkää jää jäljelle). Jos pihalle tulee nuotio tai polku `SITE.circles`/`pathDist`iin,
pois jäävät pätkät muuttuvat.

Pihan `fire`: keskellä ei ole nuotiota. Kenttä kannattaa asettaa padan kohdalle pienellä
`fireScale`lla (kuten järvenrannalla 0,62), jotta tallattu maa ja valo ovat talon edessä eivätkä
pajassa.

## Törmäykset: älä tee pajasta kiinteää laatikkoa

Jos `SMITHY` lisätään `SITE.footprints`iin, `addFootprintCollider` tekee koko avokatoksesta
kiinteän laatikon (liike, lähitaistelu ja kamera). Silloin sankari ei pääse puheväliin (noin
2,2 m) alasimella takovan sepän (noin 2,6 m) eikä palkeita pumppaavan sällin luo.

Ehdotus:
- Käytä `SMITHY`ä vain aidan ja puiden karsintaan.
- Tee törmäykset osittain `smithy.py`:n alun luvuilla, pajan Blender-koordinaatteina:
  - paalut: ympyrät, säde 0,11;
  - kiviseinä: x -3,2..3,2, y 1,7..2,3;
  - ahjo: x -1,85..-0,1, y 0,2..1,6;
  - palkeet: x -3,0..-1,8, y 0,4..1,4;
  - alasinpölkky (0,35; 0,3): r 0,32;
  - kivialasin (1,45; -0,4): r 0,4;
  - kaukalo: x 0,2..1,5, y 0,98..1,66;
  - astia (2,3; 1,22): r 0,33;
  - hiilikasa (-2,35; -0,95): r 0,55;
  - kuonakasa (3,8; 1,15): r 0,7;
  - keihästeline: x 0,6..2,9, y -3,7..-3,0;
  - pöytä: `pukkipoyta`n tavallinen törmäys.
- Sivut voi jättää auki tai sulkea matalilla esteillä kohtiin lx ±3,7. Kamera rajautuu säteelle
  12,2, joten syvällä pajassa se jää sankarin lähelle räystään alle. Siksi katto on oma solmunsa ja
  häivytetään.

## Hahmot ja kauppa

| Paikka | x | z | yaw (katse) | Huom. |
| --- | --- | --- | --- | --- |
| Seppä alasimella | 6.15 | -12.36 | 8.988 | oletuspaikka, takoo |
| Seppä ahjolla | 5.34 | -13.23 | 8.988 | vaihtoehto |
| Seppä kauppapaikalla | 3.79 | -11.09 | 12.13 | pöydän takana pihalle päin |
| Sälli palkeilla | 3.39 | -15.08 | 7.418 | pumppaa, kasvot ahjoon |
| Sälli kivialasimella | 6.89 | -11.35 | 8.988 | vaihtoehto |
| Lapsi hiilikorilla | 4.31 | -12.55 | 8.638 | 1,35 m |
| Sankari kauppapaikalla | 4.05 | -8.92 | kohti pajaa | pöydän ja telineen välissä |

Katse on suunta (sin yaw, cos yaw), kuten `src/engine/ai.ts`:ssä. Lapsi tulee vaiheessa B5
(`smithfolk_child.glb`); siihen asti sen paikka on varattu.

### Seppä ja sälli (`smithfolk.glb`)

- `char_seppa` ja `char_salli` käyttävät samaa miesvartaloa ja luurankoa (23 luuta) kuin tietäjä.
  Ne ladataan kuten `villagers.glb`:n `char_tietaja`. Kumpikin on noin 27 000–28 500 kolmiota, ja
  tiedosto on 3,25 Mt.
- Molemmilla on koverrettu miehen nyrkki, joten vasara mahtuu oikeaan käteen otekanavalle
  `GRIP_P`/`GRIP_D` (`GRIP_CHANNEL`) kuten keihäs.
- `sepan_vasara`: ote origossa, varsi kulkee +Y:stä −Y:hen ja pää on −Y:n päässä 0,285 m:n kohdalla,
  kuten keihään kärki. Iskupinta osoittaa +Z:aan ja poikkipeeni −Z:aan (pelissä ±Y).
  - `folk.ts`:n `prop.kind` tuntee nyt vain `staff` ja `bow`. `staff` seisoo maassa käden
    vieressä, joten kädessä pidettävä vasara tarvitsee uuden tavan.
  - Ehdotus: kind `tool`, joka asettaa paikallisen −Y:n otekanavan suuntaan `GRIP_D` ja origon
    pisteeseen `GRIP_P` käden luun lapsena.
- Testatut asennot (`char_smith.py`, `SMITH_POSES`), joissa esiliina ei mene tunikan eikä
  housujen läpi:
  - lepo kädet alhaalla (vähintään 19 mm);
  - vasara ylhäällä `isku_ylhaalla` (10 mm);
  - isku alasimeen `isku_alhaalla` (12 mm);
  - palkeiden pumppaus `palkeet` (18 mm).

  Pelin asennot voi tehdä samoilla luukierroilla.
- Kävely: ääriasennossa (reisi eteen 0,6 rad) reisi työntyy esiliinan alareunan läpi 7–22 mm, kuten
  tunikan helma muillakin hahmoilla. NPC:n kävelyn reisiheilahdus kannattaa rajata noin 0,45
  rad:iin, tai esiliinan läpimeno hyväksytään.
- Vasen käsi on töissä tyhjä. Pihdit sen käteen ovat myöhempi lisä.

Kauppa (omistajan päätös): keihäs ja säärisuojat otetaan telineestä **sepän luvalla**, kuten emännän
ruoka (`putSceneItem`, `ownerId` seppä).
- Keihäs: kloonaa `characters.glb`:n `spear` ja aseta se pisteen `mount_keihas_1` (tai 2 tai 3)
  maailmamuunnokseen sellaisenaan. Tyvi on silloin maassa ja kärki ylhäällä.
- Säärisuojat: `saarisuojat_myytavat` on poimittava solmu, joka piilotetaan, kun suojat on saatu.
  Varusteena käytetään pelin omia `*_greaves`-verkkoja.

## Tyhjät pisteet ja eläminen

- `mount_ahjo`: liekki ja varjoton pistevalo. Ehdotus: oranssi, intensiteetti välkkyy noin
  ±20 %, kantama noin 6 m.
- `mount_kipinat`: kipinät ja savu ahjon yllä.
- `mount_alasin`: kipinät iskusta.
- `mount_karkaisu`: höyry karkaisukaukalosta.
- `mount_keihas_1..3`: keihäät.
- `palkeet`: muotoavaimet `palje_a` ja `palje_b`. Pumppaus vastakkaisessa vaiheessa, noin 1 Hz.
- `ahjo_hiillos`: `M_Embers` (emissio 3, bloom tarttuu). `emissiveIntensity`n voi tahdistaa
  palkeisiin: kirkastuu, kun palje painuu.
- Materiaalit: `M_Iron` (metalness 0,3) ei tarvitse ympäristökarttaa. `M_SM_Water` on tumma
  läpinäkymätön pinta.

## Kuorma ja riskit

- `smithy.glb` 1,78 Mt / noin 15 450 kolmiota ja `smithfolk.glb` 3,25 Mt / noin 55 000 kolmiota.
  Pihan muut mallit ovat jo ladattavissa olevia tiedostoja.
- `smithy.glb` sisältää homesteadin tekstuurien kopiot (noin 0,6 Mt), ellei peli jaa niitä nimellä.
- Pajan lattialaikku on 1,2–1,8 cm maan yläpuolella, joten maaston pitää olla pajan alla tasainen
  (`rough` pieni, kuten tilan pihalla 0,03).
- Hehkun sävy ja veden tummuus pitää katsoa pelin sävykartoituksella. Blender-esikatselu ei kerro
  niitä luotettavasti.
