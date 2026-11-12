# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-12 (Claude, kotikone, Windows)

- **Versio v00.06.00**, branch `claude/helmets-keybinds` (tarkista merge-tila
  `git merge-base --is-ancestor`). Mainissa on v00.05.00 (metsä, hahmot,
  iskusuunnat, kilven kesto).
- **Kypärät** (`helmet_hero`, `helmet_pohja`) ovat `characters.glb`:ssä omia
  kappaleitaan ilman luurankoa. `Fighter.build()` kiinnittää kypärän
  pääluuhun lepoasennossa. `knockHelmet(dir)` irrottaa sen lentämään
  (`FlyingProp`). Pelaajan sivallus tai ylälyönti lennättää vastustajan
  kypärän: kevyt 25 %, raskas 60 %, kaatava isku aina. Ei pelivaikutusta.
  Hiukset ovat nyt kokonaiset myös kypärän alla. Urholla on myssy, ei kypärää.
- **Näppäinsidonnat** (`src/bindings.ts`, testit vieressä): toiminnot
  sivallus, ylälyönti, pisto, torjunta, väistö ja laulu, kullakin kaksi
  paikkaa. Koodit ovat `KeyboardEvent.code`-arvoja tai `Mouse0`…`MouseN`.
  Asetusikkuna on taukoikkunassa (Esc); tallennus `localStorage`-avaimeen
  `laulun-miekka.bindings.v1`. WASD, välilyönti, R ja Esc ovat kiinteitä.
  Hiiren nappien 4 ja 5 oletustoiminto (selaimen takaisin/eteenpäin) on estetty.
- **Taistelusäännöt ovat parametritaulukoita** tiedostossa `src/combat.ts`
  (puhdasta logiikkaa, testit vieressä):
  - `STRIKES`: iskusuunta (`overhead`, `slash`, `thrust`) × paino (`light`,
    `heavy`): ajoitus, kantama, kaari, vahinkokerroin, askel, kilven kulutus.
  - `WEAPONS`: miekka ja keihäs: vahinkokerroin (laatu), ulottuma,
    minimikantama, hitaus, sallitut iskusuunnat kertoimineen, torjuntakaari.
  - `SHIELDS`: kesto 10, torjuntakaari, loven raja 0,5. `BASH`: kilpityöntö.
  - `makeAttack(ase, suunta, paino)` yhdistää nämä. Vahinko =
    lyöjän voima (`Actor.power`) × ase × isku. Uusi aselaatu on uusi rivi
    `WEAPONS`-taulukkoon; hajontaa ei vielä ole.
- **Säännöt:** kilpi torjuu kaikki iskut ja kuluu (kevyt 1, raskas 2;
  täydellinen torjunta ei kuluta). Aseella torjunta onnistuu vain, jos
  torjunta-asento vastaa iskun suuntaa. Kilpityöntö murtaa asetorjunnan,
  mutta kilpeen se vain osuu. Raskas isku ei enää murra torjuntaa.
- **Ohjaus:** sivallus hiiren vasen / J, ylälyönti F / I, pisto E / L.
  Nappi pohjassa virittää: kun raskaan iskun viritysaika täyttyy, isku on
  raskas; vapautus laukaisee. Täyttä viritystä voi pidätellä 0,8 s.
  Torjunnan aikana iskunappi on kilven kanssa kilpityöntö ja ilman kilpeä
  torjunta-asennon vaihto.
- **HUD:** viritysmittari, kilpien kestopalkit, vastustajan tulevan iskun
  suunta nimen alla, oma torjunta-asento.
- **Kilven hajoaminen** (`src/fighter.ts`): lovi ja sirpaleet tehdään
  shaderilla kilven materiaaliin (`patchShield`, `ShieldDebris`), ei omilla
  malleilla. Pelaaja saa uuden kilven jokaiseen aaltoon.
- **Animaatio on yhä kokonaan koodia.** Uudet asennot: `slashWindup/Strike`,
  `thrustWindup/Strike`, `blockSide`, `blockThrust` (`block` on ylätorjunta,
  `windup/strike` ylälyönti). Keihään etukäsi viedään varrelle kahden luun
  käänteiskinematiikalla (`reachShaft`).
- **Tekoäly** (`pickEnemyAttack`, `src/main.ts`): arpoo iskusuunnan ja
  painon varustuksen mukaan, lyö raskaasti kilven takana seisovaa pelaajaa,
  ja aseella torjuessaan arvaa suunnan oikein sitä useammin, mitä pidemmällä
  aalloissa ollaan. Keihäällä voi vain pistää.
- **Blender-putket:** metsä `assets-src/blender/build_all.py`, hahmot
  `char_all.py` → `run_chars()`. Lähteet: `tools/fetch-polyhaven.ps1` ja
  `tools/fetch-characters.ps1` (ei Gitissä). `.blend`-tiedostot eivät ole
  Gitissä, eikä lähdemallien tuontia SRC-kokoelmaan ole skriptattu.
- **Deployattu:** GitHub Pages julkaisee mainin; v00.06.00 ei ole mainissa.
  **Omistaja testaa julkaistusta osoitteesta**, ei dev-serveriltä.
- **Käsin testattu 2026-11-12** (Clauden in-app browser, dev-serveri,
  skriptattu syöte): uusi kypärä istuu päähän ja nenäsuoja on kiinni
  vanteessa; kypärä lentää ja jää maahan, alta paljastuvat hiukset;
  asetusikkunassa sidonta hiiren napille 4 ja näppäimelle F13 toimii,
  varattu näppäin hylätään, sama nappi siirtyy pois vanhalta toiminnolta,
  asetus tallentuu ja uusi nappi tekee iskun pelissä; ei konsolivirheitä.
  **FPS:** lukema vaihteli 60:n ja 29:n välillä, koska selainpaneeli
  kuristi ajoittain päivitystä; luotettava mittaus puuttuu. Muutos lisää
  yhden piirtokutsun per kypärä.
  **Ei testattu:** oikealla moninappihiirellä (vain keinotekoisilla
  tapahtumilla), ihmisen pelaamana, kosketusnäyttö, buildattu versio.
- **Komennot 2026-11-12:** `bun run test` (35/35), `bun run lint`,
  `bun run build` ok.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- Savutestien apuna `window.__game`: `tick(n, dt)` ajaa peliä askelin
  ruudunpäivityksestä riippumatta, `skipTo(n)`, `showcase(true, "asento")`,
  `poses` (asentojen säätö lennossa), `setCamera(pos, look)`, `state`,
  `events` muodossa `kuka:isku/paino:tulos`.

## Tunnetut rajoitteet ja riskit

- **Tasapainoa ei ole pelitestattu.** Kaikki luvut ovat arvauksia.
  Suuntatorjunta ilman kilpeä voi olla liian vaikea: iskun suunta pitää
  lukea vastustajan asennosta tai HUD-vihjeestä noin puolessa sekunnissa.
- **Keihäällä on vain pisto**, joten sitä vastaan riittää pistotorjunta.
- **Kosketusnäytöllä** on vain sivallus; ylälyönnille, pistolle ja
  torjunta-asennon vaihdolle ei ole nappeja.
- **Asennot on viritetty silmämääräisesti** kuvakaappauksista. Raskaalla
  sivalluksella ja pistolla ei ole omaa asentoa (sama kuin kevyellä).
  Keihäsmiehen torjunta näyttää samalta kaikissa kolmessa asennossa.
- **Hiiren lisänapit:** jos hiiren ajuri on määrittänyt napin omaan
  toimintoonsa (makro, DPI-vaihto), selain ei näe painallusta lainkaan.
  Joissain selaimissa napit 4 ja 5 voivat silti selata historiaa.
- **Kypärän tekstuuri** on sama metallilevy kuin muissa osissa, ja kupu on
  melko sileä; lentävä kypärä voi pudota puun tai kiven läpi (ei törmäyksiä).
- **Kilven lovi** leikkaa pinnan shaderilla, joten loven reunassa ei ole
  paksuutta, ja kilven varjo pysyy ehjänä.
- **Hahmojen avoimet viat:** kasvot ilman tekstuuria, rengaspanssari varjossa
  lähes musta, tukeva vartalo, hiukset sileä "verho", peukalo ei kierry
  kahvan ympäri, helma voi venyä haara-asennossa.
- Suorituskyky on mitattu vain tehokoneella; LOD-malleja tai
  laatuasetusta ei ole. Metsässä 2 milj. kolmiota, hahmoissa 28 000 / kpl.
- Metsän avoimet viat: kodan oviaukko, ruskea uhrikivi, paperiset
  latvukset vastavalossa, ei tuulta, puihin ei voi törmätä.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`).
- Osumat ratkaistaan etäisyyden ja kulman perusteella, ei terän liikeradasta.

## Seuraava tehtävä

Omistaja pelaa v00.06.00:n julkaistusta osoitteesta mergen jälkeen ja kertoo
tuntuman (kypärät, näppäinasetukset oikealla hiirellä, taistelun tasapaino).
Sen perusteella säädetään taulukoiden luvut ja asennot.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Muut referenssihahmot (tietäjä, emäntä, Louhi, jousineito, isäntä).
- Isojen skannattujen puiden lataus ja kevennys.
- Aseiden laatuerot ja vahingon hajonta: rakenne on valmiina, mutta sisältö
  odottaa omistajan päätöstä.

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
