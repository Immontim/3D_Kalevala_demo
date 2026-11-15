# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-15 (Codex, Windows)

- **Branchin `codex/rpg-map` koodiversio on v02.00.00** (toteutuscommit
  `c87f9e6`, pohjana `origin/main` `3191123`). Koodi on valmis, ei
  deployattu. Tarkista merge-tila ennen jatkamista:
  `git merge-base --is-ancestor codex/rpg-map origin/main`.
- **Sovellusrakenne.** `src/main.ts` on kevyt sovelluskuori. URL ilman
  `scene`-parametria käynnistää 2D-kartan; `?scene=yard&return=map`
  lataa dynaamisesti `src/scene3d.ts`:n ja nykyisen Three.js-moottorin.
  Tuotantobuildissä kartan oma JS-chunk on noin 8 kt ja 3D-chunk noin
  790 kt; karttareitti ei pyydä GLB-tiedostoja eikä aja 3D-silmukkaa.
- **2D-maailmankartta** (`src/map/app.ts`) on Canvas 2D -näkymä, jossa
  48 × 48 px:n ruudut, 13 × 11 ruudun kamera ja 20 × 20 ruudun maailma.
  Kartta alkaa lähes pimeänä: sankarin ruutu ja kaikki kahdeksan naapuria
  paljastuvat pysyvästi. WASD ja nuolinäppäimet liikuttavat vain neljään
  pääilmansuuntaan, yksi ruutu painallusta kohti.
- **Karttadata ja säännöt.** `src/map/domain.ts` on puhdas TypeScript-ydin.
  Kuusi maastoa: niitty, metsä, umpimetsä, suo, kallio ja vesi. Kohderuudun
  `minuteCost` lisää maailmanaikaa; estynyt liike ei kuluta aikaa. Vesi on
  nyt kulkukelvoton. `src/map/prototype.ts` on käsin sommiteltu vertailukartta
  tulevalle generaattorille; aloitus on (10,14) ja rauhallinen piha (10,11).
- **Aika ja nälkä.** Erillistä karttavoimaa ei ole. Kuluneet minuutit lisäävät
  nälkää nopeudella 0,05 / min; nälkä rajataan välille 0–100 eikä se tapa tai
  estä liikkumista. UI näyttää matka-ajan, 180 minuutin välein vaihtuvan
  kahdeksanosaisen kuunkierron sekä kasvot `:)`, `:|`, `:(`.
  Nälkä ei vielä vaikuta 3D:n HP:hen tai staminaan.
- **Tuohikontti ja paperinukke.** Kampanjassa on kahdeksan pinopaikkaa,
  kolme ohrarieskaa ja kaksi kuivattua kalaa. Ruoka vähentää nälkää eikä
  kulu täysin kylläisenä. Paperinuken pääkäsi valitsee miekan tai keihään;
  sivukäsi pyöreän kilven tai tyhjän. Keihäs tyhjentää sivukäden. Vain
  nykyisen 3D-moottorin tukemat yhdistelmät hyväksytään tallennuksesta ja
  muunnetaan `sword_shield`-, `sword`- tai `spear`-loadoutiksi.
- **Kampanjatallennus** (`src/map/campaign.ts`, `storage.ts`) käyttää
  versionoitua avainta `laulun-miekka.campaign.v1`. Se säilyttää kartan,
  ruudun, ajan, nälän, paljastukset, ruuat ja varusteet. Tuntematon skeema,
  rikkinäinen JSON, väärä karttakoko tai kelpaamaton varustus palauttaa
  turvallisen uuden kampanjan. Tallennus tehdään jokaisen onnistuneen
  liikkeen, syömisen ja varustevaihdon jälkeen.
- **Kartta–3D-siirtymä.** Pihapiiri on terrainista erillinen rautapunainen
  paikkasymboli. Enter/välilyönti ruudulla avaa
  `?scene=yard&return=map`:n. Käyttäjän painallus "Astu pihalle" käynnistää
  äänen ja pointer lockin. Esc → "Palaa kartalle" poistaa reittiparametrit;
  kampanja palautuu samalle ruudulle samalla ajalla, nälällä, ruuilla ja
  varusteilla. Siirtymä lataa sivun uudelleen tarkoituksella.
- **Karttagrafiikka** on `assets/map/kalevala-map-atlas.png`: 192 × 192 px,
  4 × 4 ruudun atlas, jonka jokainen ruutu on 48 × 48 px. Siinä ovat kuusi
  maastoa, pihapiirin kalliomaalausikoni, sankari neljään suuntaan,
  ohrarieska, kuivattu kala, miekka ja kilpi. Tyyli ja paletti on johdettu
  omistajan referensseistä; kuva tehtiin OpenAI ImageGenillä tätä peliä varten.
- **UI ja kielituki.** Kartan pellavapohja, rautapunaiset kirjontakehykset,
  hillitty paletti, tuohikontti ja paperinukke ovat `src/style.css`:ssä.
  Kaikki näkyvät tekstit ovat tyypitetyissä FI/EN-sanakirjoissa. Kartassa
  on oma FI/EN-valinta; kielenvaihto säilyttää aktiivisen reitin.
- **3D-kohtaukset säilyivät.** `src/engine/` on yhä taistelu- ja
  kohtausmoottori. `Encounter` hoitaa aaltotaistelun, tyhjän `peace`-tilan
  ja rauhallisen pihan `visit`-tilan. Rauhallisella pihalla ovat talo,
  ulkorakennukset, emäntä, tietäjä, jousineito, koira, kanat, kukko ja possu.
  Kartta antaa 3D-sankarille paperinuken varustuksen ennen `spawnHero()`:a.
- **Savutestattu käsin 2026-11-15** Codexin in-app browserissa:
  - kartta käynnistyi ilman GLB-pyyntöjä;
  - alku paljasti 3 × 3 ruutua, kolme askelta pihalle kulutti 30 min ja
    kasvatti nälkää;
  - ruoka väheni pinosta ja nälkä laski;
  - miekka+kilpi vaihtui keihääksi paperinukessa ja 3D-sankarilla;
  - pihasiirtymä avasi rauhallisen `yard`-kohtauksen ilman aaltoa;
  - 3D näytti 60 FPS ja kartalle paluu säilytti koko kampanjatilan;
  - selaimen konsolissa ei ollut varoituksia tai virheitä.
- **Tarkistukset 2026-11-15:** `bun run test` 206/206 (17 tiedostoa),
  `bunx tsc --noEmit`, `bun run lint`, `bun run build` ja
  `git diff --check` läpäisty. Build varoittaa edelleen 3D-chunkin
  ylittävän 500 kt; kartan dynaaminen jako toimii.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- Debug: kartalla `window.__map` (tila, `move`, `enterSite`), 3D:ssä
  `window.__game`. Selainpaneelin fokus voi pysäyttää 3D-pelin.

## Tunnetut rajoitteet ja riskit

- Kartan maastokustannukset, nälkänopeus ja 180 minuutin kuunvaihe ovat
  ensimmäisiä arvauksia, eivät pelitestattua tasapainoa.
- Prototyyppikartta on käsin tehty ja kiinteä. Puheena ollut siemenpohjainen
  semi-satunnainen generaattori, juonipaikkojen ehdot ja validaattori eivät
  vielä ole toteutettuja.
- Terrain käyttää yhtä 48 px kuvaa maastoa kohti. Toisto näkyy etenkin
  niityllä; rannoilla, joilla ja poluilla ei ole autotile-reunoja eikä vesi
  vielä animoidu. Atlas on käyttökelpoinen prototyyppi, ei lopullinen
  tuotantoassetti.
- Tutkimussumu on kaksitilainen: löydetty terrain jää täysin näkyviin.
  Nykyinen näköalue tai dynaamisten toimijoiden piilottaminen ei ole mukana.
- Paperinukke tukee vain pää- ja sivukättä. Miekka, keihäs ja kilpi oletetaan
  sankarin alkuvarusteiksi eivätkä ne vie tuohikontin pinopaikkoja.
- Nälkä ei vielä alenna 3D:n HP-/stamina-kattoa. Tämä on tarkoituksella
  seuraavan erillisen tasapaino- ja integraatiotyön asia.
- Kartta–3D-siirtymä lataa sivun uudelleen. Samassa ajossa mount/dispose
  vaatisi 3D:n scene/world-singletonien laajemman elinkaarirefaktoroinnin.
- 3D-taistelun tasapainoa ei ole kattavasti pelitestattu. Suuntatorjunta,
  keihään kantama, usean vastustajan rytmi ja nuotion vahinko ovat arvauksia.
- Rauhallisen pihan väki ei reagoi taisteluun; kyläläiset ja eläimet jatkavat
  toimintaansa, jos paikalle tuodaan vastustaja. Eläinten ja kyläläisten
  mallikohtaiset avoimet asiat ovat `docs/BLENDER_HANDOFF.md`:ssä.
- 3D-suorituskyky on mitattu tehokoneella. Metsässä on noin 2 milj. kolmiota,
  LOD-malleja tai laatuasetusta ei ole, ja 3D-chunk on noin 790 kt.

## Seuraava tehtävä

Suunnittele ja toteuta deterministinen, siemenpohjainen karttageneraattori,
joka käyttää nykyistä käsin tehtyä karttaa laatutavoitteena. Ensimmäinen
rajaus: kuusi terrainia, yksi aloituspiha ja joukko ehdollisesti sijoitettavia
paikkasymboleita; validaattori todistaa saavutettavuuden ja hylkää rikkinäiset
siemenet. Tee samalla kehittäjän siemen-/paljastusesikatselu, ei vielä täyttä
karttaeditoria.

## Ei vielä aloiteta

- Nälän vaikutus 3D:n HP- ja stamina-kattoon (tasapaino päätetään erikseen).
- Täysi karttaeditori, satunnaiset matkakohtaamiset ja sivujuonigeneraattori.
- Dialogijärjestelmä ja kyläläisten liikkuminen.
- Kyläläisen muuttuminen vastustajaksi.
- 3D-kohtausten mount/dispose ilman sivun uudelleenlatausta.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Isojen skannattujen puiden lataus ja kevennys.
- Aseiden laatuerot ja vahingon hajonta.

## Pysyvät päätökset

- PC-peli hiirelle ja näppäimistölle; kosketusohjausta ei suunnitella.
- 2D-maailmankartta käyttää Canvas 2D:tä ja 48 × 48 px:n tiiliä. Terrain on
  yksinkertainen, merkityspaikat kalliomaalaushenkisiä ja UI:n identiteetti
  tulee karjalaisesta kirjonta-/käspaikkageometriasta.
- Karttaliike on nelisuuntainen. Paljastus on pysyvä Chebyshev-säde 1
  eli 3 × 3 aluetta myös viistoon.
- Kartalla ei ole erillistä liikevoimaa. Maaston aika tuottaa nälkää; nälkä
  ei tapa. Kampanjatila on eri asia kuin 3D:n `Actor` ja `g.gameTime`.
- Three.js ladataan vain 3D-kohtauksiin. Kartta–3D-siirtymä saa prototyypissä
  ladata sivun uudelleen, kunhan kampanjatila säilyy.
- Tyyli: myyttinen pronssikautinen / varhaisen rautakauden Fennoskandia,
  ei keskieurooppalainen ritarifantasia.
- Ulkopuoliset assetit CC0 tai CC-BY (ei NC/ND/SA). CC-BY merkitään
  `assets/CREDITS.md`:hen ja pelin tekijäluetteloon.
- Moottori: Three.js selaimessa; hostaus aluksi GitHub Pagesissa.
- `bun.lock` vaatii Bun 1.4 tai uudemman. Kotikoneella Bun 1.4.4.
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
