# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-15 (Codex, Windows)

- **Branchin `codex/rpg-map-ui` koodiversio on v03.00.00** (toteutuscommit
  `bad843b`, pohjana `origin/main` `609c1e3`). Koodi on valmis, ei
  deployattu, käsin testattu. Tarkista merge-tila ennen jatkamista:
  `git merge-base --is-ancestor codex/rpg-map-ui origin/main`.
- **Sovellusrakenne.** `src/main.ts` on kevyt sovelluskuori. URL ilman
  `scene`-parametria käynnistää 2D-kartan. `?scene=<id>&return=map` lataa
  dynaamisesti `src/scene3d.ts`:n ja nykyisen Three.js-moottorin. Kartta
  ei pyydä GLB-tiedostoja eikä aja 3D-silmukkaa. Tuotantobuildin kartta-UI
  on noin 15 kt JS; 3D-chunk noin 787 kt.
- **2D-maailmankartta** (`src/map/app.ts`) on Canvas 2D -näkymä: 20 × 20
  ruudun maailma, 48 × 48 px:n tiilet ja 17 × 13 ruudun kamera
  (816 × 624 px). 1135 px leveässä testinäkymässä canvas oli noin 798 px.
  Sankarin ruutu ja kaikki kahdeksan naapuria paljastuvat pysyvästi.
  WASD/nuolet liikuttavat vain neljään pääilmansuuntaan.
- **Karttadata ja säännöt** ovat puhtaassa `src/map/domain.ts`:ssä. Kuusi
  maastoa: niitty, metsä, umpimetsä, suo, kallio ja vesi. Kohderuudun
  `minuteCost` lisää maailmanaikaa; estynyt liike ei kuluta aikaa. Vesi on
  kulkukelvoton. `prototype.ts` on käsin sommiteltu vertailukartta:
  aloitus (10,14), rauhallinen piha (10,11), punainen käsi (13,14).
- **Aika ja kylläisyys.** Erillistä karttavoimaa ei ole. Kuluneet minuutit
  vähentävät kylläisyyttä nopeudella 0,05 / min; 100 = kylläinen ja
  0 = nääntynyt. Arvo ei tapa eikä estä liikkumista. UI näyttää matka-ajan,
  180 minuutin kuunvaiheet ja viisi numerotonta kasvokuvaa:
  80–100 oikein kylläinen, 60–alle 80 kylläinen, 40–alle 60 puolivatsainen,
  yli 20–alle 40 nälkäinen, 0–20 nääntynyt.
- **Paperinukke ja inventaario.** Oikean reunan yhtenäinen näkymä korvaa
  tuohikonttipaneelin. Siinä ovat ImageGenillä tehty sankari, viisi tulevaa
  vaatepaikkaa, toimivat pää- ja sivukäden valinnat sekä kahdeksan
  tavarapaikkaa. Kolme ohrarieskaa ja kaksi kuivattua kalaa kasvattavat
  kylläisyyttä eivätkä kulu arvossa 100. Keihäs tyhjentää sivukäden.
  Vain 3D-moottorin tukemat `sword_shield`-, `sword`- ja `spear`-yhdistelmät
  hyväksytään.
- **Kampanjatallennus** (`campaign.ts`, `storage.ts`) käyttää skeemaa 2 ja
  avainta `laulun-miekka.campaign.v2`. Se säilyttää karttaruudun, ajan,
  kylläisyyden, paljastukset, ruuat ja varusteet. Skeeman 1 `hunger`
  migroidaan kaavalla `satiety = 100 - hunger`; kelvollinen vanha tallennus
  palautetaan myös silloin, kun migraation kirjoitus estetään.
- **Matkan asetukset.** Esc avaa saavutettavan dialogin. Siellä ovat
  vahvistettava "Aloita matka uudelleen" sekä oikotiet kaikkiin 3D-paikkoihin:
  rauhallinen piha on ystävällinen, nuotioaukio ja pihapiiri taisteluita.
  Paperinuken selectit ja tavaranapit eivät vuoda kartan näppäinohjaukseen.
- **Paikat.** Pihapiirin ihmisikoni vie `yard`-kohtaukseen. Erillinen 48 × 48
  px:n rautapunainen kädenjälki vie `clearing`-nuotioaukiolle. Enter tai
  välilyönti aktivoi ruudun paikan. 3D:n kartalta avattu aloitusikkuna näyttää
  ystävälliselle pihalle "Astu pihalle" ja taisteluille "Astu taisteluun".
- **Yleinen 2D→3D-silta** on `src/map/transition.ts`. Kohtaukset luokitellaan
  `src/app/route.ts`:ssä. `SCENE_TRANSITION_BALANCE` säätää vaikutuksen:
  taistelussa kylläisyys 50–100 ei rankaise, 1–alle 50 vähentää 20 ja 0
  vähentää 40 sekä HP:n että staminan enimmäis- ja nykyarvosta. Vaikutus on
  idempotentti ja säilyy taistelun restartissa. Ystävällinen kohtaus ei
  rankaise kylläisyydestä riippumatta.
- **3D→2D-paluusilta** käyttää versionoitua avainta
  `laulun-miekka.scene-return.v1`. 3D tallentaa ennen kartalle palaamista
  tyypitetyn `SceneToMapTransition`-kuorman; kartta kuluttaa sen kerran.
  `rewards` on nyt aina tyhjä, mutta rakenne varaa paikan tuleville ruoka- ja
  esinepalkinnoille.
- **Karttagrafiikka.** `kalevala-map-atlas.png` on 4 × 4 atlas. Uudet
  projektin omat ImageGen-assetit ovat `paper-doll-hero.png` (256 × 384),
  `satiety-faces.png` (480 × 96, viisi 96 px:n kasvoa) ja
  `red-hand-site.png` (48 × 48). Tyyli seuraa omistajan pellava-, rautapuna-,
  järvensininen- ja kansankirjontareferenssejä.
- **3D-moottori.** `src/engine/` hoitaa taistelun ja kohtausten elinkaaren.
  Rauhallisella pihalla sankarin miekka on huotrassa, kilpi selässä ja
  kypärä poissa; vihollisen lisääminen palauttaa taisteluvarustuksen.
  Keihäs pysyy kädessä. Pihalla ovat emäntä, tietäjä, jousineito ja eläimet.
  Mallien, otteiden ja animaatioiden avoimet asiat ovat
  `docs/BLENDER_HANDOFF.md`:ssä.
- **UI ja kielituki.** Kartan pellavapohja, kirjontakehykset, paperinukke,
  kasvot ja dialogi ovat `src/style.css`:ssä. Kaikki näkyvät tekstit ovat
  tyypitetyissä FI/EN-sanakirjoissa.
- **Käsin testattu 2026-11-15 Codexin in-app browserissa:**
  - 1135 px leveässä näkymässä kartta pysyi noin 798 px leveänä;
  - paperinuken selectin nuoli ei liikuttanut karttaa tai kuluttanut aikaa;
  - Esc-dialogin fokus siirtyi sulkunappiin ja palasi lähtöelementtiin;
  - punainen käsi näkyi ja avasi `clearing`-taistelun;
  - kylläisyys 49 tuotti HUDiin 80/80 HP ja stamina;
  - kylläisyys 0 tuotti HUDiin 60/60 HP ja stamina;
  - kylläisyys 0 rauhallisella pihalla jätti molemmat arvoon 100/100;
  - paluu 3D:stä säilytti saman karttaruudun ja kampanjatilan;
  - uusi puhdas selainlataus: ei konsolivirheitä tai -varoituksia, 60 FPS.
- **Tarkistukset 2026-11-15:** `bun run test` 382/382 (35 tiedostoa),
  `bunx tsc --noEmit`, `bun run lint`, `bun run build` ja
  `git diff --check` läpäisty. Build varoittaa edelleen 3D-chunkin
  ylittävän 500 kt; kartan dynaaminen jako toimii.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- Debug: kartalla `window.__map` (tila, `move`, `enterSite`, paluukuorma),
  3D:ssä `window.__game`. Selainpaneelin fokus voi pysäyttää 3D-pelin.

## Tunnetut rajoitteet ja riskit

- Maastokustannukset, kylläisyyden kulumisnopeus, ruokien arvot, 50/0-rajat
  ja 20/40-rangaistukset ovat omistajan ensimmäinen päätös, eivät vielä
  laajasti pelitestattua tasapainoa.
- Prototyyppikartta on käsin tehty ja kiinteä. Deterministinen
  siemenpohjainen generaattori, juonipaikkojen ehdot ja validaattori puuttuvat.
- Terrain käyttää yhtä 48 px kuvaa maastoa kohti. Toisto näkyy etenkin
  niityllä; ranta-/joki-/polkuautotilejä tai vesianimaatiota ei ole.
- Tutkimussumu on kaksitilainen: löydetty terrain jää täysin näkyviin.
- Paperinuken viisi vaatepaikkaa ovat vasta visuaalisia varauksia. Vain
  pää- ja sivukäsi ovat toimivia; alkuvarusteet eivät vie tavarapaikkoja.
- Paluusillan kuljetus toimii, mutta 3D ei vielä myönnä palkintoja eikä kartta
  lisää `rewards`-kentän esineitä inventaarioon.
- Kartta–3D-siirtymä lataa sivun uudelleen. Samassa ajossa mount/dispose
  vaatisi scene/world-singletonien laajemman elinkaarirefaktoroinnin.
- 3D-taistelun tasapainoa ei ole kattavasti pelitestattu. Suuntatorjunta,
  keihään kantama, usean vastustajan rytmi ja nuotion vahinko ovat arvioita.
- Rauhallisen pihan väki ei reagoi taisteluun. Eläinten ja kyläläisten
  mallikohtaiset avoimet asiat ovat `docs/BLENDER_HANDOFF.md`:ssä.
- 3D-chunk on noin 787 kt ja metsä noin 2 milj. kolmiota. LOD-malleja tai
  laatuasetusta ei ole; 60 FPS on mitattu tehokoneella.

## Seuraava tehtävä

Toteuta deterministinen, siemenpohjainen karttageneraattori nykyisen käsin
tehdyn kartan rinnalle. Ensimmäinen rajaus: kuusi terrainia, aloituspiha,
punaisen käden taistelupaikka ja ehdollisesti sijoitettavat juonipaikat.
Validaattorin pitää todistaa kaikkien pakollisten paikkojen saavutettavuus ja
hylätä rikkinäinen siemen. Lisää kehittäjän siemen-/paljastusesikatselu, ei
vielä täyttä karttaeditoria.

## Ei vielä aloiteta

- Täysi karttaeditori, satunnaiset matkakohtaamiset ja sivujuonigeneraattori.
- Paperinuken vaate-esineiden datamalli ja 3D-ulkoasun vaihto.
- 3D-palkintojen tai ruokien lisääminen paluukuormasta inventaarioon.
- Dialogijärjestelmä ja kyläläisten liikkuminen tai vihamielistyminen.
- 3D-kohtausten mount/dispose ilman sivun uudelleenlatausta.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Isojen skannattujen puiden lataus ja kevennys.
- Aseiden laatuerot ja vahingon hajonta.

## Pysyvät päätökset

- PC-peli hiirelle ja näppäimistölle; kosketusohjausta ei suunnitella.
- 2D-kartta käyttää Canvas 2D:tä ja 48 × 48 px:n tiiliä. Terrain on
  yksinkertainen, merkityspaikat kalliomaalaushenkisiä ja UI:n identiteetti
  tulee karjalaisesta kirjonta-/käspaikkageometriasta.
- Karttaliike on nelisuuntainen. Paljastus on pysyvä 3 × 3 alue myös viistoon.
- Kartalla ei ole erillistä liikevoimaa. Maaston aika vähentää kylläisyyttä;
  kylläisyys ei tapa. Kampanjatila on eri asia kuin 3D:n `Actor` ja aika.
- Nälkäisen taistelurangaistus muuttaa HP:n ja staminan kattoa, ei vain
  hetkellistä nykyarvoa; ystävällisiä kohtauksia ei rangaista.
- Three.js ladataan vain 3D-kohtauksiin. Kartta–3D-siirtymä saa prototyypissä
  ladata sivun uudelleen, kunhan kampanjatila säilyy.
- Tyyli: myyttinen pronssikautinen / varhaisen rautakauden Fennoskandia,
  ei keskieurooppalainen ritarifantasia.
- Ulkopuoliset assetit CC0 tai CC-BY (ei NC/ND/SA). CC-BY merkitään
  `assets/CREDITS.md`:hen ja pelin tekijäluetteloon.
- Moottori: Three.js selaimessa; hostaus aluksi GitHub Pagesissa.
- `bun.lock` vaatii Bun 1.4 tai uudemman. Kotikoneella Bun 1.4.4.
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
