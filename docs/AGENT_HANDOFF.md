# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-15 (Claude, Windows; pohja `origin/main` `1353ea3`)

- **Branchin `claude/hero-calm-gestures` koodiversio on v03.03.00.** Koodi
  valmis, ei deployattu, käsin testattu 3D:ssä (alla). Tarkista merge-tila
  ennen jatkamista: `git merge-base --is-ancestor claude/hero-calm-gestures origin/main`.
- **Rauhan kävely ja eleet** (`src/fighter.ts`, `src/interact.ts`,
  `src/engine/{hero,melee,animate}.ts`). `POSES.rest` on rennompi (kädet
  hieman irti vartalosta, kyynärpää taipuu); `apply()` heiluttaa käsiä
  vastakkaisen jalan tahtiin, kun `relax` on 1 (target `rest`/`restSpear`,
  vakiot `GAIT.armSwing*`). Rauhassa (`heroAtPeace`) iskunappi käynnistää
  tilan `talk` ja torjuntanappi tilan `use` (`ActionState`; `inputs.useQueued`
  asetetaan torjuntanapin painalluksesta). Eleet ovat `gesturePose()`
  -avainkehyksiä (`GESTURE_TIME` kestot), vaikutus ratkeaa `effectAt`-hetkellä
  `gestureEffect`issä: puhe etsii `pickTarget`illa kohteen `TALK_ZONE`sta
  (= miekan kevyt sivallus, 2,3 m / ±60°) ja näyttää nimen; `USE_ZONE` (1,6 m /
  ±60°) odottaa esineitä, kohteita ei vielä ole. Puhuteltava väki rekisteröidään
  `world.ts`:n `solid()`ista (`addTalkable`). Puhuessa liike 50 %, tartunnassa 0;
  vastustajan ilmestyminen keskeyttää eleen. Keihäsmies kantaa keihästä
  `restSpear`-otteessa (vasen käsi vapaa, `spearLeftW`) ja vilkuttaa vasemmalla.
- **Naissankari 3D:ssä.** `scene3d.ts` asettaa `PLAYER_LOOK.female` kampanjan
  sukupuolesta. `Fighter.build` ottaa vartalon `villagers_f.glb`:stä
  (`char_jousineito`, jousi pois), varusteet, kypärän ja kiinnityspisteet
  `characters.glb`:stä ja siirtää ne luurankojen lepoasentojen erotuksen verran
  (`attachFemaleGear`). Huotra on koodilla tehty kolmesta laatikosta; kilven
  kantohihnaa ei ole. Keihään otteessa käytetään naisen arvioitua kanavaa
  (`GRIP_CHANNEL_F`). Ei skaalausta (nainen miehen mittainen). Naisen ulkonäkö
  ja eleet katsottu rannalla (rauha, kävely, vilkutus, miekkaisku); keihästä ja
  ilman kilpeä -asetta naisella ei ole katsottu.
- **Debug:** `__game.freeze()` pysäyttää pelin ajan ja `__game.step(n)` etenee
  n ruutua (kuvakaappaukset tarkasta hetkestä; kuvakaappaus voi laahata
  sekunnin). Dev-palvelimen moduulit voivat monistua monien muokkausten
  jälkeen (varusteet eivät vaihdu): käynnistä palvelin uudelleen. 3D lukee
  varusteet ja sukupuolen kampanjatallennuksesta (`laulun-miekka.campaign.v3`).
- **Uusi paikka `lakeside` (Järven ranta)**, rauhallinen kohtaus
  (`SCENE_KINDS`: friendly). Kartalla ruutu (9,6) niityn ja järven rajalla,
  Esc-dialogin oikotie ja `?scene=lakeside`. `world.ts` rakentaa sen samalla
  sijoittelulla kuin pihan: mökki `CABIN`, keittopaikka `LAKE_FIRE` (oma liekki
  pienennettynä `fireScale` 0,62, höyry padasta, valo, kipinät), laituri
  `JETTY`/`JETTY_AT`, vene `BOAT_AT`, kuivausteline, halkopino, ruovikko.
  Mallit tulevat `lakeside.glb`:stä (BLENDER_HANDOFF).
  - **Järvi.** `terrainHeight` sekoittaa maaston `lakeBed`iin
    (`lakeMix`, rantaviiva `shoreZ(x)`, vesi `WATER_LEVEL` −0,42, järvi +z-
    puolella). `groundHeight` on kävelykorkeus: laiturin päällä sen kansi,
    muualla sama kuin maasto. Vesi on yksi taso (`buildWater`, heijastava,
    värähtelevä normaali); rantakaistan ja pohjan maa on tallattua. Vedessä ei
    sijoiteta puita, kiviä eikä heinää (`wet()` ja `put`in `wetOk`).
  - **Törmäykset.** `addLakeColliders`: rannan syvän veden reunalle 0,9 m
    ruudukosta ympyröitä (sankari voi kahlata nilkkaan), laiturille reunalaidat
    ja pääty. Mökki on `CABIN`-pohjana, vene ja istuinhirsi `PROP_COLLIDERS`ista.
    Rantakohtauksen tulen vaara-alue on 0,45-kertainen: kivikehän vierestä ei pala.
  - **Aloituspaikka.** `SPAWN` (`world.ts`) ja `spawnHero`: rannalla sankari
    alkaa laiturin juurelta katsomaan keittotulta, muualla ennallaan (0,−3).
  - **Väki.** Tietäjä sauvoineen seisoo tulen vieressä, koira kiertää
    seisoo/istuu/`tassu`. Koiralla ei ole kävelyleikettä (lähde: vain
    play_dead, rollover, shake, sitting, standing), joten se ei käyskentele.
    Pihan koiralla tassu on nyt myös kierrossa.
  - **Kartta.** `LAKESIDE_POSITION`, atlaksen ruutu (3,1) (kalliomaalausikoni:
    mökki, tietäjä, koira, aallot; piirretty koodilla PIL:llä, ei ImageGen).
- **Dev-palvelin työpuusta.** Clauden `preview_start` käynnistää palvelimen
  pääkansiosta, ei työpuusta. Työpuun testi: `bun run dev --port 5174
  --strictPort` työpuusta; sulje palvelin lopuksi.
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
- **Kampanjatallennus** (`campaign.ts`, `storage.ts`) käyttää skeemaa 3 ja
  avainta `laulun-miekka.campaign.v3`. Se säilyttää karttaruudun, ajan,
  kylläisyyden, paljastukset, ruuat, varusteet ja sankarin sukupuolen.
  Skeeman 1 `hunger` muunnetaan kylläisyydeksi ja v1/v2-tallennukset saavat
  miesoletuksen; kelvollinen vanha tallennus palautetaan myös silloin, kun
  migraation kirjoitus estetään.
- **Matkan asetukset.** Esc avaa saavutettavan dialogin. Siellä valitaan
  kieli fontista riippumattomilla FI/GB-lipuilla ja karttasankarin sukupuoli
  kylläisimmistä kasvokuvista. Mies on uuden ja migroidun kampanjan oletus.
  Lisäksi dialogissa ovat vahvistettava "Aloita matka uudelleen" sekä
  oikotiet kaikkiin 3D-paikkoihin; rauhallinen piha ja järven ranta ovat
  ystävällisiä, nuotioaukio ja pihapiiri taisteluita. Paperinuken selectit ja
  tavaranapit eivät vuoda kartan näppäinohjaukseen.
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
- **Karttagrafiikka ja sankari.** `kalevala-map-atlas.png` on 4 × 4 atlas.
  Naisella ovat `paper-doll-hero.png`, `satiety-faces.png` ja nelisuuntainen
  `map-hero-female.png`; sininen viitta erottaa hänet kartalla. Miehellä ovat
  `paper-doll-hero-male.png`, `satiety-faces-male.png` ja atlaksen nykyiset
  neljä sankariruutua. Paperinuket ovat 256 × 384, kasvot 480 × 96 ja
  karttaspritet 48 px. Valinta vaihtaa kaikki kolme 2D-esitystä heti.
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
  - mies oli uuden kampanjan oletus;
  - Esc näytti oikeat FI/GB-liput ja miehen/naisen täydet kasvot;
  - naisen valinta vaihtoi paperinuken, kylläisyyskasvot ja siniviittaisen
    karttaspriten sekä säilyi sivulatauksen yli;
  - FI/EN-kielenvaihto latasi kartan oikealla kielellä;
  - Järven ranta säilyi ystävällisenä 3D-oikotienä;
  - 1135 px leveässä näkymässä kartta pysyi noin 798 px leveänä;
  - paperinuken selectin nuoli ei liikuttanut karttaa tai kuluttanut aikaa;
  - Esc-dialogin fokus siirtyi sulkunappiin ja palasi lähtöelementtiin;
  - punainen käsi näkyi ja avasi `clearing`-taistelun;
  - kylläisyys 49 tuotti HUDiin 80/80 HP ja stamina;
  - kylläisyys 0 tuotti HUDiin 60/60 HP ja stamina;
  - kylläisyys 0 rauhallisella pihalla jätti molemmat arvoon 100/100;
  - paluu 3D:stä säilytti saman karttaruudun ja kampanjatilan;
  - uusi puhdas selainlataus: ei konsolivirheitä tai -varoituksia, 60 FPS.
- **Tarkistukset 2026-11-15 (v03.03.00):** `bun run test` 424/424 (38 tiedostoa),
  `bunx tsc --noEmit`, `bun run lint`, `bun run build` läpäisty; FPS 50–60 pienessä
  in-app-ikkunassa. Aiemmin (v03.02.00): `bun run test` 416/416 (37 tiedostoa),
  `bunx tsc --noEmit`, `bun run lint`, `bun run build` ja
  `git diff --check` läpäisty.
  Selaimessa: `?scene=lakeside` ja kartalta (9,6) → "Astu rannalle" toimivat,
  konsolissa ei virheitä, 56–60 FPS pienessä in-app-ikkunassa (suuremmalla
  näytöllä FPS mittaamatta); kävelytesti: laiturin päähän asti, rannalla pysähtyy
  nilkkaan, laiturin sivuille ei pääse; pihan ja nuotioaukion lataus ennallaan.
  Build varoittaa edelleen 3D-chunkin ylittävän 500 kt (noin 792 kt).
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
- Sukupuolivalinta vaihtaa 2D-kartan spriten, paperinuken ja kylläisyyskasvot
  sekä 3D-sankarin (jousineidon vartalo). Miehen nyrkit ovat suljetut (mallissa
  ei ole sormiluita), joten vilkutus ja kävely näyttävät jäykiltä; naisen kädet
  ovat avoimet. Jousineito-NPC pihalla on edelleen jousen kanssa.
- Paluusillan kuljetus toimii, mutta 3D ei vielä myönnä palkintoja eikä kartta
  lisää `rewards`-kentän esineitä inventaarioon.
- Kartta–3D-siirtymä lataa sivun uudelleen. Samassa ajossa mount/dispose
  vaatisi scene/world-singletonien laajemman elinkaarirefaktoroinnin.
- 3D-taistelun tasapainoa ei ole kattavasti pelitestattu. Suuntatorjunta,
  keihään kantama, usean vastustajan rytmi ja nuotion vahinko ovat arvioita.
- Rauhallisen pihan väki ei reagoi taisteluun. Eläinten ja kyläläisten
  mallikohtaiset avoimet asiat ovat `docs/BLENDER_HANDOFF.md`:ssä.
- Järven rannan vesi on yksinkertainen: ei rantavaahtoa, syvyysväriä eikä
  aaltoja laiturin kohdalla. Kaukorannalla ei ole kasvillisuutta kaukaa
  nähtynä; rantakohtauksen koira ei käyskentele (ei kävelyleikettä).
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
- Dialogijärjestelmä (puhe vain vilkuttaa ja näyttää nimen) ja kyläläisten
  liikkuminen tai vihamielistyminen. Käytä/tartu-toiminnolle esineet.
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
