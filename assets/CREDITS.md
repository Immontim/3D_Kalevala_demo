# Assettien lähteet ja lisenssit

Kaikki ulkopuoliset assetit ovat [Poly Havenista](https://polyhaven.com) ja
lisenssiltään **CC0** (vapaa käyttää, ei nimeämisvelvoitetta). Lähdetiedostot
haetaan skriptillä `tools/fetch-polyhaven.ps1` kansioon
`assets-src/_downloads/` (ei Gitissä).

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

## `ground/`

| Tiedosto | Lähde |
| --- | --- |
| `needles_*.webp` | `forrest_ground_03` |
| `moss_*.webp` | `forest_leaves_02` |
| `dirt_*.webp` | `forest_ground_04` |

Ladattu mutta ei käytössä pelissä: `moss_01`, `boulder_01`, `mossy_rock`,
`pine_tree_01` (vain tekstuurit).
