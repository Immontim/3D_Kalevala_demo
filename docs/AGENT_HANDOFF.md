# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-21 (Claude, Windows; pohja `origin/main` `ae23d7e`)

- **Koodiversio v06.02.00** branchissa `claude/path-entry-spawns` (tarkista merge-tila `git merge-base`illa).
  Koodi valmis ja savutestattu in-app-selaimessa; ei deployattu eikä omistaja ole käsin testannut. Ajettu:
  `bun run test` 99 tiedostoa / 1178 testiä, `bunx tsc --noEmit`, `bun run lint`, `bun run build` (3D-chunk
  861 kt) ja `git diff --check` läpi. Selaimessa katsottu aukio (aallot 1 ja 5), piha, taistelupiha, ranta ja
  palanut ranta: 60 FPS (800 px:n paneeli), ei pelin konsolivirheitä.
- **Saapuminen polunsuulta (v06.02).** `sceneLayout.entrySpawn(layout, inset)` = ensimmäisen polunsuun portista
  `ENTRY_INSET` 3,5 m sisään, katse sisään. `world.ts` `SPAWN`: kalmisto ja erämaa käsin (jo polulla), pihat
  inset 6,4 (kameran `camMaxR` 12,2 aidan sisällä, muuten kamera painuu maahan), ranta katsoo `LAKE_FIRE`a.
  Rannan polunsuu siirrettiin 205° → 150° (mökin itäpuolelle); polku ja puuton kaista seuraavat dataa.
- **Aaltojen tulo (v06.02).** `sceneLayout.approachSpawns`: ryhmä vierekkäin (1,8 m) arenan keskeltä katsoen
  pelaajan vastakkaisella puolella ± satunnainen 0,5 rad, kehällä `SceneLayout.approach` (vain aukio, 14,5 m;
  puut alkavat 13,2 m) tai alueen reunalla (r − 1). `addEnemy` kääntää vihollisen heti pelaajaa kohti.
  Alueen ulkopuolella syntynyt saa `ai.arriveUntil`in (12 s): `melee.keepApartAndInside` ei rajaa häntä,
  kunnes hän on alueen sisällä. `ENEMY_AI.strafeRange` 5: kauempaa ei kierrellä. Aukiolla 1. aallon urho on
  sankarin luona noin 7 s:ssa.
- **Kohtausmalli (`src/sceneLayout.ts`, puhdas).** Jokaisella kohtauksella on `SceneLayout`: kuljettava
  monikulmio `bounds`, taistelun `arena` (keskus + säde, vihollisten tulopaikat) ja polunsuut `exits`
  (portti, ulos-suunta, leveys, `mapDir`). Kuljettava alue = monikulmio TAI polunsuun käytävä (5 m sisään,
  4 m ulos portista). `clampToWalkable` korvasi `ARENA_RADIUS`-ympyrän `melee.ts`:ssä ja `skirmish.ts`:ssä
  (`ARENA_RADIUS` on yhä `world.ts`:ssä vanhan sijoittelun säteenä). Vanhat kohtaukset ovat 11 m:n
  ympyröitä, joissa on yksi polunsuu (aukio etelä, pihat portista, rannat ja kalmisto maan puolelle).
  Konventio: 3D:n −z = pohjoinen, +x = itä.
- **Polunsuusta poistuminen (`src/engine/exit.ts`).** Portin ylitys aloittaa 1 s:n mustan häivytyksen
  (`#exitFade`), jonka aikana peli jatkuu (vihollinen voi lyödä; kuolema tai käytävästä palaaminen
  peruu). Lopuksi `?return=map`-reitillä `createEmptySceneReturn(scene, mapDir)` ja kartalle; muuten
  aloitusvalikkoon. Kartta (`initMap`) ottaa `exitDir`in ja astuu yhden ruudun siihen suuntaan `move()`lla
  (estetty askel ei tee mitään). Vihje "Polku vie pois" alle 6 m:n päässä portista. `__game.exitState()`.
- **Metsä (`src/forest.ts`).** Kaikki puut piirtää `Forest`: alle `nearR`:n täysi malli varjoineen,
  kauempana `forest_lod.glb`:n kaukopuu; vaihto 5–6 m:n kaistalla vastakkaisilla Bayer-pikselikuvioilla
  (`aFade`-attribuutti, kloonatut materiaalit). Lista kootaan, kun pelaaja liikkuu 0,8 m. Aukioilla
  `nearR` 48 (reunametsä pysyy täytenä), erämaassa 38 ja `farR` 135 (sumu). Kaukopuiden sävy korjataan
  `LOD_TINT`illä ja `M_BarkLOD` × 0,62 (BLENDER_HANDOFF). Horisonttisuikaleet (`metsaseina`): aukioilla
  kehä 84 m (rannoilla vain maan puolella), erämaassa neliö ±178 m. Varjokamera ja taivaspallo seuraavat
  pelaajaa/kameraa (varjo napsautetaan tekseleihin). Konsoli: `__world.forest`, `__world.forestNear(r)`,
  `__game.drawLoad()`, `__game.ground(x, z)`.
- **Kamera metsässä.** `CollisionWorld.firstCameraHit` + `blocksCamera` (puut, kota, karsikko, juurakko,
  rakennukset): kamera vetäytyy rungon eteen heti ja palaa hitaasti. `engine/foliageFade.ts`: lehvästö
  häipyy kuvioiden alle 2,2 m:n päässä kamerasta ja harvenee 80 % kameran ja sankarin rinnan välisellä
  kapselilla (säde 0,9 m). Varjot pysyvät umpinaisina.
- **Erämaa `wilds` (friendly, Esc-oikotie, aloitusvalikko, `?scene=wilds`; ei karttapaikkaa).** 200 × 200 m:n
  kuljettava alue (34-kärkinen monikulmio ±97 m), polunsuut pohjoinen (14, −97), itä (97, 18) ja etelä
  (−36, 97). Maasto 380 m (`wildsHeight`: moreenikumpareet, suoniitty `bogMix` keskellä tasoitettuna,
  paloaukea `burnMix` (52, −40) hiiltyneellä maalla). ~4 900 puuta (myös 70 m rajan yli), reunalla tiheä
  nuori kuusikko, lohkareet ja juurakot; polut puuttomia 3,6 m. Kivet, kelot ja juurakot piirretään alle
  60 m:n päähän (`Forest` ilman kaukomallia). Aluskasvillisuus `ScatterField`illa 12 m:n ruutuina 34 m:n
  säteellä, reunalla häivytys. Piirtokuorma alussa ~0,96 milj. kolmiota (ranta nyt 0,92, ennen 1,26).
- **Paperinukke ja inventaario.** Skeema 6, avain `laulun-miekka.campaign.v6`, 12 tavarapaikkaa ja
  seitsemän varustepaikkaa. Kartta ja 3D:n pause käyttävät samaa `ui/inventoryView.ts`-näkymää.
  Rauhassa varusteita voi vaihtaa ja ruokaa syödä; taistelussa näkymä on vain luettavissa.
  `B` avaa 3D-inventaarion ja pysäyttää kohtauksen. Ase- ja kilpivaihdot ovat atomisia;
  keihäs palauttaa kilven inventaarioon, eikä pääkättä voi jättää tyhjäksi.
- **3D-varusteet ja suoja.** Mies- ja naissankari käyttävät Clauden modulaarisia base/mail/greaves/
  shoes-solmuja ja Taivaanrautamiekka omaa `sword_sky_iron`-malliaan. Rengaspaita kertoo vahingon
  0,85:llä, säärisuojat 0,95:llä. Vain ylälyönti voi irrottaa kypärän; silloin koko isku torjutaan.
  Sama sääntö on pelaajalla ja vihollisilla. Tarkat arvot ovat `combat.ts`in `ARMOUR`-vakiossa.
- V1-V7 ja Codexin kahlaamo on mergattu. **MVP:n koko pelikaari on nyt koodissa.**
- **Leirin aallot ja voitto (V7).** `src/waves.ts` (puhdas): `CAMPAIGN_WAVES` 5 kiinteää aaltoa
  omistajan listan mukaan (urho/miekka; pohja/miekka+kilpi; urho/keihäs + pohja/miekka; pohja/keihäs +
  pohja/miekka+kilpi; urho/keihäs + pohja/miekka+kilpi + pohja/miekka), `FINAL_WAVE`, `TOTAL_ENEMIES` (9).
  **Vastustajat ovat perusarvoissa** (taso 0, ei `groupHpScale`a; urho 70 HP, pohja 80 HP); vain
  tekoälyn taito nousee (`aiLevelForWave` = aalto-1, `EnemyDef.aiLevel`). `engine/skirmish.ts`:
  viimeisen aallon kaatuminen -> viesti -> `engine/victory.ts` `finishVictory`: `battle.won`
  -> sääntö `campaign.victory` (efekti `recordVictory`: lippu `campaign.won`, laskurit `win.days` =
  `totalDays(worldMinutes)` ja `win.explored` %) -> `mapUrl`. Kaatuminen: `onPlayerDeath` ->
  `player.died` -> `player.deaths`-laskuri. Debug: `__game.killEnemies()`, `skipTo(1..5)`.
  Alkuperäiset `groupSize`/`WAVES.hpPerWave` jäivät `combat.ts`:ään käyttämättöminä (testit).
- **Loppuruutu** (`map/ending.ts` puhdas, `map/app.ts` `#mapEnding`): näkyy kartalla voiton jälkeen kerran
  (päivät, tutkittu %, laulut, kukistetut, kaatumiset, luvattomat otot, sivupolut); "Jatka vaellusta"
  asettaa `campaign.endSeen`, asetuksista voi katsoa uudelleen. Päivät ja kartta jäädytetään voittoon.
- **V6 ja leirin arvonta (mergattu).** Leiri on instanssi `camp` (`placement.ts` `CAMP_PLACEMENT`: reunakaista,
  >= 8 ruutua aloituksesta, <= 600 min, lukossa lipulla `louhi.banished`). Jousineito makaa `archer`-pihassa;
  parannuslaulu rauhassa (`SongDef.peaceTargets`) -> `archer.healed` + `setNpcState` -> seisoo; dialogista
  `sky_iron_sword` (vahinko 1,3; oma GLB-malli). Tietäjä vain rannalla, nuori urho
  `archer`-vapaassa pihassa, emäntä kertoo huhun (`rumor.heard` + tietäjän ranta kartalle).
- **Louhen karkotus (V5, mergattu).** Pohjolan uni <= 6 m (`SONG_AUDIENCE_RANGE`) Louhesta
  kalmistolla: `endSong` lähettää `song.performed` (cast, `nearNpcId`); sääntö `louhi.banished`
  asettaa lipun, `revealSite` ja `removeNpc` (`world.removeNpc`: `vanishVillager`,
  `CollisionWorld.disable`, `removeTalkable`). Pysyvyys: `cairnState.louhiBanished` lipusta.
  Lukitut paikat: `MapSiteDefinition.requiresFlag`, `siteUnlocked`. Esc-oikotie `clearing`iin
  on kehittäjälle auki.
- **Laulun opettelu (V4, mergattu).** Laulu **Pohjolan uni** (`SONGS.sleep`, Kalevala runo 42).
  Tietäjän dialogi -> efekti `startSongLesson` (`OutAction`) -> `engine/song.ts` `startLesson`
  (`SongState.lesson`: ei hidastusta, säe näkyy etukäteen) -> `endLesson` lähettää `song.performed`
  (lesson); sääntö `sage.song-learned` antaa lipun `song.sleep.learned`. Epäonnistuminen ei rankaise
  (raja `SONG.minHits` 4/8). `songLogic.songSlots(flags)` sijoittaa laulun paikkaan F3.
- **Satunnaiset pihapiirit (V3, mergattu).** Kampanjan `world.siteInstances` (`yard`/`yard-b`,
  `archer`) ja `worldSeed`; skeema 5/v5. Vanha piha = `yard` (`yard.table-*`), toinen
  `yard-b.table-*`. `map/placement.ts`, `map/siteInstances.ts`, `sites.ts` `siteIdAt`;
  kartta välittää `?site=<id>`, `scene3d.ts` `setSiteInstance`, jousineito vain `archer`-pihaan.
- **CampaignStore (V1).** `map/campaignStore.ts`: 3D:n yksi tilan omistaja, `update(fn)`
  tallentaa ennen käyttöönottoa; 3D:ssä `engine/store.ts` (`campaignStore()`,
  `worldRuntime()`). Kartta (`map/app.ts`) lataa kampanjan omaan muuttujaansa.
- **Maailmamoottori v0 (V2), `src/world/`**, Three.js- ja DOM-vapaa: `registry.ts` (liput, laskurit;
  **uusi lippu lisätään tänne**), `state.ts` (`campaign.engine`, sallivasti luettu), `conditions.ts`,
  `effects.ts` (atominen, ei koske `worldMinutes`iä; UI-toimet `OutAction`eina), `engine.ts`
  (`postEvent`; ei ajastimia, `unless`ia eikä ketjureaktioita), `take.ts`, `dialogue.ts`,
  `summary.ts`, `runtime.ts`, `content.ts` (**pelin oikea data**: `RULES`, dialogit, `GAME_WORLD`).
  Tapahtumat `item.taken`, `npc.talked`, `scene.entered`, `song.performed`. Jokaisella säännöllä ja
  dialogilla pakollinen `intent`-lause. Konsoli `__world`: `flags`, `counters`, `post`, `explain`,
  `describe()` (kaikki proosana omistajalle), `items`, `scene`. Dialogi 3D:ssä: `engine/dialogue.ts`
  (puhe-ele -> `npc.talked` -> dialogi, jos `findDialogue(ARENA, npcId)`; pelilogiikka seisoo; numero/
  klikkaus, Esc sulkee). Tietäjä (`lakeside`): `sage.permission` + `setSceneItemTakeMode`; luvaton
  otto -> `sage.theft-noticed` (lippu, laskuri, viesti), anteeksipyyntö, loki säilyy.
- **Rauhallisten 3D-kohtausten esineet.** `sceneInteraction.ts` valitsee
  sankarin katseakselilta enintään 2,8 m:n päässä olevan esineen. HUDin pieni
  piste projisoidaan maailmaan; osuva piste näyttää esineen nimen, varkauden ja
  täyden inventaarion. Käytä-ele lukitsee painallushetken kohteen ja ratkaisee
  oton eleen keskellä. Tallennus tehdään ennen 3D-juuren poistamista; epäonnistunut
  tallennus jättää esineen paikalleen. `world.ts`:n dynaamiset esineet jakavat
  GLB-prototyyppien geometrian ja materiaalit, eikä niillä ole liikecollidereita.
  Instanssit: `lakeside.sage-pack` (sama myös `lakeruin`issa) sekä pihassa
  `<pihan tunniste>.table-flatbread` (3 rieskaa) ja `.table-dried-fish` (3 kalaa).
  Pöydän muut astiat jäävät paikoilleen ruoan ottamisen jälkeen.
- **Esinedomain ja pysyvyys.** Kampanjaskeema 6 ja avain
  `laulun-miekka.campaign.v6`; v5 migroidaan menettämättä etenemistä tai varusteita.
  `CampaignWorld.sceneItems` tallentaa otetut instanssit, `allowed|theft`-
  lupapoikkeamat, varkaustietueet sekä varauksen myöhemmille pudotetuille
  esineille (paikka, kierto, määrä ja seuraava tunniste). `setSceneItemTakeMode`
  on nyt kytketty tietäjän dialogiin (yllä). Pudotus-UI:ta tai pudotettujen mallien
  luontia ei vielä ole. Uusi matka alkaa kolmella ohrarieskalla ilman kalaa;
  tuohikontti on tavallinen yhden kappaleen esine.
- **Kalmisto `cairnfield` (v03.10.00)**, rauhallinen kohtaus (`SCENE_KINDS`:
  friendly). Esc-dialogin oikotie, aloitusvalikon paikanvalinta, `?scene=cairnfield`
  ja karttapaikka `cairnfield` (v03.12.00, ruutu 16,16 kaakon vaaran kalliolla;
  ikoni `assets/map/cairn-site.png`; koillisen kallio on joen takana, ei kuljettava).
  `world.ts`: `CAIRN`-lippu; `LAKE` = `LAKESIDE || CAIRN` (vesi, kaukoranta, rantakaistan
  maasto), mökki/laituri/vene `LAKESIDE`ssä. Maasto: kallionokka (`terrainHeight`:
  loiva kumpare keskipisteessä (1, 4), +1,15 m, ja matalia kalliokumpuja), `shoreZ`
  siirtää rannan z ≈ 21:een ja vetää sen sivuille, joten järvi on kumpareen takana ja
  sivuilla. Sijoittelu vakioina `world.ts`:n alussa: `CUPSTONE` (1,2; 3,0),
  `CAIRNS_AT` (kuusi röykkiötä, kehällä r ≤ 12), `KARSIKKO` (−11,6; 9,2), `LOUHI_AT`
  (−9,9; 7,5; katse kuppikiveen), `DARK_SOIL` (musta maa: kuusi canvas-tekstuurilla
  piirrettyä läikkää, jotka seuraavat maastoa; ei mallia). Aloitus (−0,6; −9,5) katse
  järvelle. Mallit `cairnfield.glb`:stä (BLENDER_HANDOFF); törmäykset
  `PROP_COLLIDERS`ista (kuppikivi laatikko, röykkiöt ympyrä/laatikko ilman
  `blocksMelee`, karsikko ympyrä) ja Louhi ympyrä. Puut harvaa (koivu 40 %, mänty,
  vähän kuusta), ei puita järvinäkymän kaistalla (z > 7, |x| < 14) eikä kumpareen
  13 m:n sisällä. Heinää 40 %, sammalta ja varvikkoa enemmän, valo ja sumu vaaleaa
  (`FOG_COLOR`). Ei tulta (`buildFire` palauttaa sammuneen), ei tulen törmäystä.
  Louhi: `populateCairnLife`, `louhi.glb` `spawnVillager`illä (kädet kuten emännällä),
  puhuteltava (`folk.louhi`). Kaukainen vesilintu `buildLoon` (koodigeometria, ei
  sumua, sukeltaa 70 s kierroksella). **Ääni:** `Sfx.birds(dt, taso)` (`audio.ts`),
  taso `birdSongLevel` (`ambience.ts`, testattu): hiljaa alle 4 m kuppikivestä, täysi
  yli 11 m; muissa kohtauksissa taso 0 eli ei lintuja. Veden ääntä ei ole, vain
  vanha tuulikohina. Tarkistettu pelissä: 60 FPS (1024×768 in-app, 1,15 milj.
  kolmiota), ei konsolivirheitä, rauha/ranta/aukio latautuvat ennallaan. **Ei
  tarkistettu:** käveleminen törmäyksiä vasten (in-app-selain ei saanut näppäimiä
  perille; laatikon `yaw`-konventio tarkistettu koodista), ääni kuultuna, tarkka
  FPS suurella näytöllä.
- **Taisteluvaraukset (Louhi suohon):** kuppikiven ympärillä on röykkeistä vapaa
  noin 5 m:n alue, ja suoloitsun efekti (`bog`, `effects.ts`) on jo olemassa. Puuttuu
  vielä vihollistyyppi `louhi` (nyt vain NPC), hänen taistelumalli ja animaatiot
  (kävely, kädet ylös) sekä `Encounter`, joka vaihtaa `cairnfieldVisit`in taisteluun.
  `ARENA_RADIUS` 11 m kattaa kuppikiven ja neljä röykkiötä; karsikko ja Louhi ovat
  sen ulkopuolella.
- **Rauhan kävely ja eleet** (`fighter.ts`, `interact.ts`, `engine/{hero,melee,animate}.ts`): rauhassa
  (`heroAtPeace`) iskunappi = `talk`, torjuntanappi = `use`; eleet ovat `gesturePose()`-avainkehyksiä ja
  vaikutus ratkeaa `gestureEffect`issä (`TALK_ZONE` 2,3 m / ±60°). Puhuteltava väki `world.ts`:n `solid()`ista.
- **Naissankari 3D:ssä.** `PLAYER_LOOK.female` kampanjasta; `Fighter.build` ottaa vartalon, huotran ja
  hihnan `villagers_f.glb`:stä (`char_jousineito`) ja varusteet `characters.glb`:stä (`attachFemaleGear`).
  **Avoin:** omistajan näkemä leijuva musta kypärä aloitusvalikossa (Chrome/Edge) ei toistunut;
  v03.05.01:n korjaus vahvistamatta. Keihästä ja kilvetöntä asetta naisella ei ole katsottu.
- **Sormet.** Luurangoissa `finger1..3_L/R`; `Fighter.applyFingers` (`FINGER_OPEN`, `handOpen`): rauha 0,7,
  eleet 0,9, taistelussa nyrkki (kilvetön miekka 0,35).
- **Vapaa kamera** (pause-valikko; `src/freecam.ts`, `engine/freecam.ts`): peli pysyy tauolla, Esc palaa.
- **Debug:** `__game.gesture`, `findNamed`, `freeze()`/`step(n)`, `setCamera`, `placePlayer`. Monien
  muokkausten jälkeen dev-palvelimen moduulit voivat monistua: käynnistä uudelleen.
- **Järven rannat.** `lakeside` on kartan (9,6) rauhallinen mökki-, keittotuli-, laituri-, vene- ja
  tietäjäkohtaus; `lakeruin` käyttää samaa maastoa mutta palaneita rakennuksia, kuollutta tietäjää ja
  sammunutta tulta. Järvi jatkuu horisonttiin, vastaranta on sumuinen maisema ja syvä vesi estää kulun;
  laiturilla voi kävellä. Tietäjä, koira, mökki, vene ja tuli törmäävät. Tarkat mallit ja mitat ovat
  `BLENDER_HANDOFF.md`:ssä, sijoittelu ja maastosäännöt `world.ts`:ssä.
- **Dev-palvelin työpuusta:** in-app-esikatselu lukee pääkansion `.claude/launch.json`in; työpuuta varten
  `bun --cwd=<työpuu> run dev --port 5174 --strictPort` (palauta launch.json, sulje lopuksi).
- **Laulun tahmaus heikolla koneella:** CSS-suotimen siirto shaderiin (v05.00.01) on yhä vahvistamatta.
- **Sovellusrakenne.** URL ilman `scene`-parametria käynnistää 2D-kartan;
  `?scene=<id>&return=map` lataa dynaamisesti `src/scene3d.ts`:n ja Three.js-
  moottorin. Kartta ei pyydä GLB-tiedostoja eikä aja 3D-silmukkaa.
- **2D-maailmankartta** (`src/map/app.ts`) on Canvas 2D -näkymä: 20 × 20
  ruudun maailma, 48 × 48 px:n tiilet ja 17 × 13 ruudun kamera
  (816 × 624 px). 1135 px leveässä testinäkymässä canvas oli noin 798 px.
  Sankarin ruutu ja kaikki kahdeksan naapuria paljastuvat pysyvästi. Vain tämä
  nykyinen 3 × 3 -alue on kirkas; aiemmin löydetty terrain näkyy sumutettuna,
  ja löydetyt kiinteät paikat näkyvät siinä himmeinä. Tuntematon paikka tai
  liikkuva kohtaaminen ei näy sumun läpi. WASD/nuolet liikuttavat vain neljään
  pääilmansuuntaan.
- **Karttadata ja säännöt** ovat puhtaassa `src/map/domain.ts`:ssä. Kuusi
  aiempaa maastoa (niitty, metsä, umpimetsä, suo, kallio ja vesi) sekä uusi
  joki. Kohderuudun `minuteCost` lisää maailmanaikaa; estynyt liike ei kuluta
  aikaa. Vesi ja joki ovat jalan kulkukelvottomia paitsi joen kivinen kahlaamo
  (13,11). `crossingId` on terrainista erillinen,
  joten myöhempi silta voi käyttää samaa sääntöä. Joki kiemurtelee keskisen
  järven etelälaidasta itäiseen ulkoveteen. Kiinteät paikat: aloitus (10,14),
  punainen käsi (13,14), rantamökki (9,6), kalmisto (16,16); pihat ovat instansseja.
- **Aika ja kylläisyys.** Erillistä karttavoimaa ei ole. Piilotettu `worldMinutes` sallii päivän
  murto-osat; vanhojen tallennusten jo kertynyt aika, 180 yksikön kuunkierto ja 28 päivää säilyvät.
  Kohderuudun kulku: niitty 1/6 päivää, metsä 1/4, umpimetsä 1/3, kallio 1/2, suo 0,7 ja kahlaamo
  0,4 päivää. Kylläisyys vähenee 3,6 pistettä päivässä (niittyliike 0,6); 100 → 0 kestää noin 28
  päivää ilman ruokaa. Arvo ei tapa tai estä liikkumista. Kuun kuva näyttää kahdeksan vaihetta;
  tavallinen liike ei näytä kustannusta.
  Viisi numerotonta kasvokuvaa:
  80–100 oikein kylläinen, 60–alle 80 kylläinen, 40–alle 60 puolivatsainen,
  yli 20–alle 40 nälkäinen, 0–20 nääntynyt.
- **Kampanjatallennus** (`campaign.ts`, `storage.ts`) käyttää skeemaa 6 ja
  avainta `laulun-miekka.campaign.v6`. Terrain-muisti ja `knownSiteIds` säilyvät erikseen.
  Vanhat hunger-, sukupuoli-, maailmanesine- ja virtuaalivarustetiedot migroidaan häviöttömästi;
  kelvollinen vanha tila palautetaan myös, jos migraation kirjoitus estyy.
- **Matkan asetukset.** Esc-dialogissa ovat FI/GB-kieli, sukupuoli, vahvistettava uudelleenaloitus
  ja 3D-oikotiet kohtaustyyppeineen. Mies on uuden ja migroidun kampanjan oletus.
- **Paikat.** `sites.ts` omistaa liikkumisen (`fixed|mobile`), elinkaaren
  (`persistent|temporary`), sijainnin ja `sceneId`-kytkennän. Nykyiset paikat ovat
  `fixed+persistent`; kaksi pihainstanssia käyttää samaa 3D-sceneä.
- **2D↔3D-sillat.** `transition.ts` vähentää nälkäisessä taistelussa HP- ja staminakattoa 20,
  nääntyneenä 40; vaikutus on idempotentti eikä koske ystävällisiä kohtauksia. Paluukuorma
  `laulun-miekka.scene-return.v1` kulutetaan kerran; `rewards` on vielä tyhjä varaus.
- **Karttagrafiikka ja sankari.** `kalevala-map-atlas-v2.png` sisältää kaksi terrainvariaatiota
  ja naapureista kierrettävät jokipalat. 48 px:n `lake-shore-edge.png` pyöristää rannat ja
  `river-ford-overlay.png` piirtää kahlaamon.
  Naisella ovat `paper-doll-hero.png`, `satiety-faces.png` ja nelisuuntainen
  `map-hero-female.png`; sininen viitta erottaa hänet kartalla. Miehellä ovat
  `paper-doll-hero-male.png`, `satiety-faces-male.png` ja atlaksen nykyiset
  neljä sankariruutua. Paperinuket ovat 256 × 384, kasvot 480 × 96 ja
  karttaspritet 48 px. Valinta vaihtaa kaikki kolme 2D-esitystä heti.
- **3D-moottori.** Rauhassa miekka on huotrassa, kilpi selässä ja kypärä poissa;
  taistelu palauttaa varustuksen. Keihäs pysyy kädessä. Assettiriskit: `BLENDER_HANDOFF.md`.
- **Taistelun stamina-arvot:** kevyt isku 6, raskas isku 12, toteutunut
  torjunta 4 ja torjunta-asento 1,5/s. Tavallisella 1/s palautumisella
  torjunta kuluttaa nettomääräisesti 0,5/s. Keihään vahinkokerroin on 1,1.
  Samat stamina- ja asearvot koskevat sankaria ja vihollisia.
- **UI ja kielituki.** Kartan pellavapohja, kirjontakehykset, paperinukke,
  kasvot ja dialogi ovat `src/style.css`:ssä. Kaikki näkyvät tekstit ovat
  tyypitetyissä FI/EN-sanakirjoissa.
- **Riippuvuustarkistus:** 2026-11-20: ei mitään odottamassa. `bun audit` on puhdas ja
  `bun outdated --no-cache` ei listaa paketteja.
- Debug: kartalla `window.__map` (tila, `move`, `enterSite`, paluukuorma),
  3D:ssä `window.__game`. Selainpaneelin fokus voi pysäyttää 3D-pelin.

## Tunnetut rajoitteet ja riskit

- Uusi karttavauhti ja 3,6 kylläisyyspistettä/päivä eivät ole vielä pelitestattuja. Suon 0,7 päivän
  ja kahlaamon 0,4 päivän hinnat säilyttävät niiden vanhan suhteen kallioon, eivät ole omistajan
  erikseen päättämiä. Ruokien arvot sekä 50/0-rajat ja 20/40-rangaistukset jäivät ennalleen.
- Prototyyppikartta on käsin tehty; vain pihojen paikat ja jousineidon talo
  arvotaan. Tallennettu piha jää paikalleen, vaikka Codex muuttaisi karttamaastoa
  myöhemmin: jos pihan ruutu muuttuu kulkukelvottomaksi, sille ei ole korjausta.
  Sijoitteluluvut (etäisyydet, 150 aikayksikköä) ovat arvio; nopeampi matkanteko tekee aikarajasta
  aiempaa väljemmän, joten löydettävyys selviää pelaamalla.
- Liikkuvien ja väliaikaisten kohtaamisten luokitus sekä piirron piilotussääntö
  ovat valmiina, mutta niiden instanssilistaa, liikeratoja tai poistumistiloja
  ei ole vielä toteutettu.
- Jokigrafiikka tukee suoria, kaarteita, päitä ja yhtä kahlaamoa, mutta ei
  vielä haaroja, siltoja, koskia, venettä tai vesianimaatiota.
- Vanha v3-tallennus voi ensimmäisellä latauksella asettaa sankarin ruutuun,
  joka on tässä karttaversiossa muuttunut joeksi. Sankari pääsee poistumaan
  viereiseen maahan, mutta lataus ei vielä siirrä häntä automaattisesti.
- Keskushahmon paperinukkekuva ei kerrostu vaatekappale kerrallaan; toimiva varustetila näkyy
  sitä ympäröivissä ikonislotteissa. Hansikkailla ei vielä ole erillistä 3D-mesh-versiota eikä
  kengillä tai hansikkailla pelivaikutusta. Rauhassa kypärä on edelleen tarkoituksella pois päästä.
- Sukupuolivalinta vaihtaa 2D-kartan spriten, paperinuken ja kylläisyyskasvot
  sekä 3D-sankarin (jousineidon vartalo). Jousineito-NPC pihalla (vain `archer`-talossa) on
  jousen kanssa, joten naissankarin rinnalla on kaksi samannäköistä hahmoa.
  Naissankarin kilpi on selässä jousineidon viinen päällä.
- Paluusillan kuljetus toimii, mutta 3D ei vielä myönnä palkintoja eikä kartta
  lisää `rewards`-kentän esineitä inventaarioon.
- Varkaudelle reagoi vain tietäjä rannalla (viesti, lippu, dialogi); muut
  esineet (pihan ruoka) eivät vielä laukaise mitään. Pudotetun esineen
  tallennusmuoto on varattu, mutta inventaarion pudotus-UI ja 3D-instanssin luonti
  puuttuvat. `sceneItems.ts`:n save-failure-, rakennuspeitto- ja eleen lukituspolut
  ovat käsin/koodista tarkistettuja, eivät vielä automatisoituja integraatiotestejä.
- Kartta–3D-siirtymä lataa sivun uudelleen. Samassa ajossa mount/dispose
  vaatisi scene/world-singletonien laajemman elinkaarirefaktoroinnin.
- 3D-taistelun tasapainoa ei ole kattavasti pelitestattu. Suuntatorjunta,
  keihään kantama, usean vastustajan rytmi ja nuotion vahinko ovat arvioita.
- Rauhallisen pihan väki ei reagoi taisteluun. Eläinten ja kyläläisten
  mallikohtaiset avoimet asiat ovat `docs/BLENDER_HANDOFF.md`:ssä.
- Järven rannan vesi on yksinkertainen: ei rantavaahtoa, syvyysväriä eikä
  aaltoja laiturin kohdalla. Kaukorannalla ei ole kasvillisuutta kaukaa
  nähtynä; rantakohtauksen koira ei käyskentele (ei kävelyleikettä).
- **FPS:ää ei ole mitattu v06:lla** (in-app-paneeli oli piilossa). Laatuasetusta ei ole (pikselitiheys,
  MSAA 4×, hehku, 4096 px:n varjokartta). Vaihtokaistan pikselikuvio voi näkyä liikkeessä; kaukopuiden
  sävy on pikselimittauksella viritetty arvio. Instanssinippuja ei rajata näkökentän mukaan (kaikki
  etäisyyden sisällä piirretään). Aukioiden varvut ja heinät ovat yhä kiinteitä kehiä origon ympärillä.
- Polunsuun käytävä ei katso kohtauksen omia esteitä (esim. pihan aita portin vieressä); polku on
  piirretty vain maaston väriin. Aloitus on aina ensimmäisellä polunsuulla, ei sillä, jonka suunnasta
  kartalta tultiin (kartta ei vielä välitä tulosuuntaa). Metsästä tuleva vihollinen voi juuttua runkoon;
  12 s:n jälkeen hänet rajataan aukiolle (näkyvä hyppäys). Vihje "Polku vie pois" näkyy heti alussa. Viholliset eivät vielä pakene polunsuista. Pako ei muuta kampanjaa:
  leiri jää kartalle ja aallot alkavat alusta.
- Moottori on v0: ei ajastimia, `unless`-peruutusta eikä efektien ketjureaktioita.
  Tuntematon engine-versionumero luetaan sallivasti; semantiikkamuutos tarvitsee versionhaaran.
- Rikkinäistä tallennetta ei kopioida talteen ennen korvaamista (ROADMAPin riski);
  moottorilohkossa salliva luku vain pudottaa tuntemattoman.

## Seuraava tehtävä

Omistaja testaa v06:n peliläppärillä (selain GTX:llä, laturissa): erämaa, aukio ja ranta (uusi saapuminen
polulta ja aaltojen tulo metsästä), FPS oikeasta alakulmasta, polunsuusta poistuminen kartan kautta, kamera ja lehvästö metsässä sekä kartalla päivä- ja
kylläisyysrytmi eri maastoissa. Palautteen mukaan säädetään ensin suorituskykyä tai matkatasapainoa.

## Ei vielä aloiteta

- Louhen taistelu (varaukset yllä; karkotus laululla kuuluu V5:een); esine- ja puhemekaniikka kalmistolla
  on Codexin suunnittelema.
- Täysi karttaeditori, satunnaiset matkakohtaamiset ja sivujuonigeneraattori.
- 3D-palkintojen tai ruokien lisääminen paluukuormasta inventaarioon.
- Yleinen quest-editori, laaja dialogipuu, ajastimet, `unless` ja kyläläisten vapaa liikkuminen.
- Inventaarion pudotus-UI ja pudotettujen esineiden 3D-instanssit.
- 3D-kohtausten mount/dispose ilman sivun uudelleenlatausta.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Isojen skannattujen puiden lataus ja kevennys.
- Metsästys (jousi, nuolet, nuoliviini, jänis), kylä/markkinat ja vihollisten pako ennen omistajan
  v06-testiä.
- Erämaan karttapaikka (karttagrafiikka on Codexin alaa); erämaa on toistaiseksi testikohtaus.
- Aseiden laatuerot ja vahingon hajonta.

## Pysyvät päätökset

- PC-peli hiirelle ja näppäimistölle; kosketusohjausta ei suunnitella.
- 2D-kartta käyttää Canvas 2D:tä ja 48 × 48 px:n tiiliä. Terrain on
  yksinkertainen, merkityspaikat kalliomaalaushenkisiä ja UI:n identiteetti
  tulee karjalaisesta kirjonta-/käspaikkageometriasta.
- Karttaliike on nelisuuntainen. Paljastus on pysyvä 3 × 3 alue myös viistoon.
- Vain sankarin nykyinen 3 × 3 on aktiivisesti näkyvä. Löydetty maasto jää
  muistiksi sumun alle. Löydetty kiinteä paikka näkyy sumussa himmeänä;
  tuntematon paikka ja liikkuva kohtaaminen eivät näy sumun läpi.
- Kartalla ei ole erillistä liikevoimaa. Maaston aika vähentää kylläisyyttä;
  kylläisyys ei tapa. Kampanjatila on eri asia kuin 3D:n `Actor` ja aika.
- Karttakalenterissa yksi kuunkierto on 180 tausta-aikayksikköä ja 28 päivää.
  Tausta-aikaa tai yksittäisen siirron kustannusta ei näytetä pelaajalle.
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
- 3D-kohtauksen kuljettava alue on enintään 200 × 200 m; maisema jatkuu rajan yli. Kohtauksesta poistutaan
  polunsuista (ei koko reunalta); sankari (myöhemmin vihollisetkin) saa paeta kesken taistelun, ja
  häivytyksen aikana vieressä oleva vihollinen voi vielä osua (2026-11-21).
- Jousi on ensin metsästysase, myöhemmin myös taisteluun; nuolet ovat kohtauksessa rajattu resurssi
  (alkuun nuoliviini, 15 nuolta), voidaan lykätä (2026-11-21).
- Vertailukone on vanha peliläppäri (i5, 8 Gt, GTX 16 -sarja), ei työläppäri (2026-11-21).
