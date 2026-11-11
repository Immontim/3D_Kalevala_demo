# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-11 (Claude, kotikone, Windows)

- **Versio v00.03.00**, branch `claude/characters` (tarkista merge-tila
  `git merge-base --is-ancestor`). Metsäaukio (v00.02.00) on mainissa.
- **Koodi valmis:** taisteluprototyyppi, Blender-metsäaukio ja nyt
  Blender-hahmot. `assets/characters.glb` (5 Mt): yksi luuranko `RIG`
  (17 luuta), kolme hahmoa (`char_hero`, `char_urho`, `char_pohja`, noin
  28 000 kolmiota / hahmo) ja varusteet (`sword`, `spear`, `shield_*`).
  `src/fighter.ts` kloonaa mallin taistelijalle, jättää näkyviin oman hahmon,
  kiinnittää aseen oikeaan käteen ja kilven vasempaan kyynärvarteen.
- **Animaatio on yhä kokonaan koodia:** samat `Pose`-nivelkulmat kuin
  ennen. `Fighter.apply()` muuntaa ne luiden kierroiksi "virtuaalisen
  rangan" kautta (kädet suorina alas = nolla-asento), joten vanhat asennot
  toimivat A-asennossa mallinnetulla luurangolla. Lantio korjataan niin, että
  alempi jalka pysyy maassa. Kilvelle ja keihäälle on omat asentolisät
  (`SHIELD_*`, `SPEAR`).
- **Varustukset ovat vasta ulkoasua:** pelaaja on sankari (miekka ja kilpi),
  vastustajat kiertävät urho/pohja × miekka, miekka+kilpi, keihäs.
  Osumalogiikka, kantama ja torjunta ovat kaikilla samat kuin miekalla.
- **Blender-putket:** metsä `assets-src/blender/build_all.py`, hahmot
  `char_all.py` → `run_chars()` (`char_rig.py` luuranko ja nyrkit,
  `char_build.py` vaatteet ja varusteet, `char_export.py`). Lähteet:
  `tools/fetch-polyhaven.ps1` ja `tools/fetch-characters.ps1` (ei Gitissä).
  `.blend`-tiedostot eivät ole Gitissä, eikä lähdemallien tuontia
  SRC-kokoelmaan ole skriptattu (hahmoilla: `GEO-body_male_realistic` ja
  sen silmät Human Base Meshes -paketista).
- **Deployattu:** GitHub Pages julkaisee mainin; v00.03.00 ei ole mainissa.
- **Käsin testattu 2026-11-11** (Clauden in-app browser, dev-serveri):
  hahmot renderöityvät, ase ja kilpi istuvat käteen, taistelu käynnistyy,
  lyönti- ja torjunta-asennot toimivat, ei konsolivirheitä.
  **FPS:ää ei mitattu hahmojen kanssa**, koska selainpaneeli oli piilossa
  (kuristaa ~1 FPS:ään). Edellinen mittaus ilman hahmoja: 60 FPS /
  1280×720 / RTX 4080 Super.
- **Komennot 2026-11-11:** `bun run test` (12/12), `bun run lint`,
  `bun run build` ok.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- **Arviointi (ali-agentti, kuvakaappauksista):** hahmot 4–5/10
  referensseihin nähden ensimmäisellä kierroksella. Korjauskierros tehty
  (housut, rengaspanssari, nahka, kypärät, kilvet, viitta, kengät), sitä ei
  ole arvioitu uudelleen.
- Savutestien apuna `window.__game`: `showcase()` asettaa kaikki hahmot ja
  varustukset riviin aukiolle, `setCamera([x,y,z],[x,y,z])` vapaa kamera.

## Tunnetut rajoitteet ja riskit

- **Hahmojen avoimet viat:** kasvot ovat ilman tekstuuria (verteksivärit) ja
  näyttävät lähikuvassa nukkemaisilta; rengaspanssari on varjossa lähes
  musta; vartalo on tukeva verrattuna referenssien hoikkiin hahmoihin;
  hiukset ovat sileä "verho"; peukalo ei kierry kahvan ympäri; keihästä
  pidetään kahdella kädellä vain likimäärin (ei IK:ta), joten etukäsi ei
  osu varteen; helma voi venyä tai leikata jalkaa isoissa askelissa.
- **Asennot ovat jäykkiä:** jalat rinnakkain, ei painonsiirtoa eikä
  askelluksen ja iskun yhteyttä. Tämä on seuraavan kierroksen työ yhdessä
  uusien iskujen kanssa.
- Suorituskyky on mitattu vain tehokoneella; LOD-malleja tai
  laatuasetusta ei ole. Metsässä 2 milj. kolmiota, hahmoissa 28 000 / kpl.
- Metsän avoimet viat: kodan oviaukko, ruskea uhrikivi, paperiset
  latvukset vastavalossa, ei tuulta, puihin ei voi törmätä.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`).
- Osumat ratkaistaan etäisyyden ja kulman perusteella, ei terän liikeradasta.
- Kosketusnapit ovat alkeelliset, eikä liikkumista ole kosketuksella.

## Seuraava tehtävä

Pelimoottoriin muutakin kuin peruslyönti ja miekkatorjunta: varustuskohtainen
taistelu (kilpitorjunta, keihään pisto ja kantama, iskusuunnat) ja sen
vaatimat asennot. Omistaja pelaa ensin hahmot ja kertoo, mikä ulkoasussa
pitää korjata ennen sitä.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Muut referenssihahmot (tietäjä, emäntä, Louhi, jousineito, isäntä).
- Isojen skannattujen puiden lataus ja kevennys.

## Pysyvät päätökset

- Moottori: Three.js selaimessa. Claude/Codex kirjoittavat moottorin,
  fysiikan ja suuren osan animaatiosta koodina.
- Hostaus aluksi GitHub Pagesissa. Lovable on mahdollinen myöhemmin
  GitHub-synkkauksen kautta, mutta koodia ei kirjoiteta Lovablen tekoälyllä
  (kaksi tekoälyä samassa koodissa sotkisi).
- Tyyli: pronssikautinen / varhaisen rautakauden Fennoskandia.
- Ulkopuoliset assetit vain CC0 (Poly Haven); lähteet `assets/CREDITS.md`.
  Puut tehdään itse oksakorteista, koska skannatut puut ovat selaimelle
  liian raskaita (17 milj. polygonia).
- `bun.lock` on muotoa `lockfileVersion: 2`, joten vaaditaan Bun 1.4 tai
  uudempi (1.3 ei osaa lukea sitä). Kotikoneella Bun 1.4.4.
- Hahmojen pohja on Blender Studion Human Base Meshes (CC0); vaatteet
  johdetaan vartalon pinnasta skriptillä, ja animaatio tehdään koodilla
  ilman valmiita animaatioleikkeitä.
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
