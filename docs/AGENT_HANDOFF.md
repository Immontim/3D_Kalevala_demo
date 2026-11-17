# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-17 (Claude, Windows; pohja `origin/main` `0123847`)

- **Branchin `claude/archer-sword` koodiversio on v04.05.00** (V6 + leirin arvonta + pihojen
  väki, alla). Koodi valmis, ei deployattu, käsin testattu selaimessa; omistaja pelaa MVP:tä
  kokonaisuutena eikä testaa vaiheita erikseen. Tarkista merge-tila:
  `git merge-base --is-ancestor claude/archer-sword origin/main`. V1-V5 ja Codexin
  kahlaamo on mergattu.
- **Vainolaisten leiri on arvottu instanssi (`camp`).** Kartasta poistettiin kiinteä
  `campfire`; `SiteInstance.kind` on `"yard" | "camp"`. `map/placement.ts`: `CAMP_PLACEMENT`
  (kartan reuna: etäisyys reunaan <= 4, maasto niitty/metsä/umpimetsä/kallio, Chebyshev >= 8
  aloituksesta, reitti <= 600 min, >= 4 pihoista ja kiinteistä), `placeCampInstance` (oma virta
  `camp`), `validateCampPlacement`; `siteInstances.ts` `newSiteInstances`/`completeSiteInstances`
  (vanha tallennus saa puuttuvan `camp`in). `sites.ts` `instanceSiteDefinition`: leiri avaa
  `clearing`in ja on lukossa lipulla `louhi.banished` (`CAMP_REQUIRES_FLAG`). Sääntö
  `louhi.banished` paljastaa `camp`in. 1000 siementä läpäisee validaattorin.
- **Jousineidon haara (V6).** Jousineito makaa `archer`-pihassa loukkaantuneena (`lying`-malli,
  vartaloesteet `folk:jousineito-ruumis1/2`, ei jousta). Rauhassa **parannuslaulu** on käytettävissä,
  kun hän on kuuluvilla (`SongDef.peaceTargets`, `songAvailable`; ring avautuu vain, jos jokin laulu
  on käytettävissä: `canSingAtPeace`). Sääntö `archer.healed` (`song.performed` heal/cast/success,
  `yard`, `nearNpcId` jousineito) asettaa lipun ja efektin `setNpcState` (`OutAction npcState`):
  `world.setNpcState` vaihtaa makaavan seisovaan (`vanishVillager(id, true)` + `spawnArcher`) ja
  poistaa vartaloesteet. Dialogi `archer.yard`: loukkaantuneena `wounded`/`story`, parannettuna
  `reward` -> `take` antaa `sky_iron_sword`in (`giveItem`; täysi inventaario -> valinta
  epäonnistuu, toistettavissa) ja lipun `archer.gaveSword`, sen jälkeen `after`.
- **Taivaanrautamiekka.** `ItemId`/`EquipmentItemId` `sky_iron_sword`, `WEAPONS.sky_iron_sword`
  (vahinko 1,3 vs 1,0, muuten sama miekka), `weaponOf(loadout, skyIron)`, `FighterLook.skyIron`,
  `combatLoadout` kartoittaa sen miekaksi (+ kilpi), `isSkyIron`/`ownsMainHand`. Kartan
  paperinuken pääkäsi-valinta näyttää sen vasta, kun se on inventaariossa; esine pysyy
  inventaariossa valinnan jälkeen. Hierarkia: `tuning.ts` `weapons.sky_iron_sword.damage`.
  **Malli on väliaikainen:** sama miekkamalli, terä sävytetty tummansiniseksi
  (`fighter.ts`); oma Blender-malli odottaa (ks. BLENDER_HANDOFF).
- **Pihojen väki.** Tietäjä poistettiin pihoilta (yksi tietäjä, rannalla). `archer`-vapaassa pihassa
  tulen vieressä seisoo **nuori urho** (`characters.glb` `char_urho` `spawnVillager`illa, aseeton;
  dialogi `urho.yard`: vihje kalmiston lähettilääseen). Emäntällä (molemmat pihat) on dialogi
  `emanta.yard`: "Onko kuulunut mitään outoa?" asettaa `rumor.heard` ja `revealSite lakeside`
  (huhu). Tietäjän opetus (`sage.song-learned`) paljastaa myös `cairnfield`in kartalle.
  **Testattu:** Vitest (kaikki säännöt ja epäonnistumiset, leirin 1000 siementä) ja selaimessa koko
  polku (parannus rauhassa, seisomaan nousu, miekan otto, valinta kartalla, vahinko 1,3, urho, emäntä).
  **Ei testattu:** miekan ja loukkaantuneen mallin ulkonäkö lähikuvassa, rytmi ihmiskäsin.
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
- **Esinedomain ja pysyvyys.** Kampanjaskeema 5 ja avain
  `laulun-miekka.campaign.v5`; v4 migroidaan menettämättä etenemistä.
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
- **Rauhan kävely ja eleet** (`src/fighter.ts`, `src/interact.ts`,
  `src/engine/{hero,melee,animate}.ts`). `POSES.rest` on rennompi (kädet
  hieman irti vartalosta, kyynärpää taipuu); `apply()` heiluttaa käsiä
  vastakkaisen jalan tahtiin, kun `relax` on 1 (target `rest`/`restSpear`,
  vakiot `GAIT.armSwing*`). Rauhassa (`heroAtPeace`) iskunappi käynnistää
  tilan `talk` ja torjuntanappi tilan `use` (`ActionState`; `inputs.useQueued`
  asetetaan torjuntanapin painalluksesta). Eleet ovat `gesturePose()`
  -avainkehyksiä (`GESTURE_TIME` kestot), vaikutus ratkeaa `effectAt`-hetkellä
  `gestureEffect`issä: puhe etsii `pickTarget`illa kohteen `TALK_ZONE`sta
  (= miekan kevyt sivallus, 2,3 m / ±60°) ja näyttää nimen; käyttö ratkaisee
  `sceneItems.ts`:ssä painallushetkellä lukitun maailmanesineen. Puhuteltava väki rekisteröidään
  `world.ts`:n `solid()`ista (`addTalkable`). Puhuessa liike 50 %, tartunnassa 0;
  vastustajan ilmestyminen keskeyttää eleen. Keihäsmies kantaa keihästä
  `restSpear`-otteessa (vasen käsi vapaa, `spearLeftW`) ja vilkuttaa vasemmalla.
- **Naissankari 3D:ssä.** `scene3d.ts` asettaa `PLAYER_LOOK.female` kampanjan
  sukupuolesta. `Fighter.build` ottaa vartalon, huotran
  (`char_jousineito_huotra`), kantohihnan (`char_jousineito_hihna`) ja
  kiinnityspisteet (`mount_huotra_f`, `mount_kilpi_selka_f`) `villagers_f.glb`:stä
  (`char_jousineito`, jousi pois) sekä varusteet ja kypärän `characters.glb`:stä;
  kypärä siirretään luurankojen lepoasentojen erotuksen verran
  (`attachFemaleGear`, kutsutaan ennen kuin klooni liitetään `body`yn; kypärä on
  pääluun lapsi paikallisilla matriiseilla). **Avoin:** omistaja näki naishahmolla
  leijuvan mustan kypärän aloitusvalikon aikana (Chrome ja Edge, ei miehellä);
  syytä ei saatu toistumaan, v03.05.01 korjaa kypärän kiinnityksen mutta ei ole
  vahvistettu hänen selaimessaan. Keihään otteessa käytetään naisen arvioitua kanavaa
  (`GRIP_CHANNEL_F`). Ei skaalausta (nainen miehen mittainen). Ulkonäkö, eleet,
  huotra ja hihna katsottu rannalla ja pihalla (rauha, miekkaisku); keihästä
  ja ilman kilpeä -asetta naisella ei ole katsottu.
- **Sormet.** Kaikilla luurangoilla on sormiluut `finger1..3_L/R` (nyrkki on
  lepoasento). `Fighter.applyFingers` kiertää ne auki paikallisen Z-akselin
  ympäri (`FINGER_OPEN` rystys/keski/kärki 1,25/1,5/0,9 rad × avaus 0..1,
  `handOpen`): rauhassa 0,7, eleissä 0,9, taistelussa asekäsi 0 ja kilpikäsi 0
  (kilvetön miekka 0,35); keihäsmiehen oikea käsi on aina nyrkissä. Kyläläiset
  (`folk.ts`) avaavat vapaan käden 0,7:ään, esinettä pitävä käsi pysyy nyrkissä.
  Peukalolla ei ole luuta. Katkenneet ranteet olivat hihamallin vika
  (BLENDER_HANDOFF), ei animaation.
- **Vapaa kamera** (pause-valikon nappi, `src/freecam.ts` puhdas liike + testit,
  `src/engine/freecam.ts` tila, `enterFreeCam`/`exitFreeCam` `loop.ts`:ssä): peli
  pysyy `paused`-tilassa, `body.freecam` piilottaa pelin käyttöliittymän,
  `updateCamera` käyttää vapaata kameraa, Esc tai hiiren lukon vapautus palaa
  valikkoon (`pausedAt` päivitetään, ettei Esc jatka peliä). Konsolin
  `__game.setCamera` on erillinen ohjelmallinen kamera.
- **Debug:** `__game.gesture("talk"|"use")` laukaisee eleen, `__game.findNamed("hand_R")`
  antaa solmujen paikat (kameran kohdistukseen `setCamera`lla), `__game.freeze()`
  pysäyttää pelin ajan ja `__game.step(n)` etenee
  n ruutua (kuvakaappaukset tarkasta hetkestä; kuvakaappaus voi laahata
  sekunnin). Dev-palvelimen moduulit voivat monistua monien muokkausten
  jälkeen (varusteet eivät vaihdu): käynnistä palvelin uudelleen. 3D lukee
  varusteet ja sukupuolen kampanjatallennuksesta (`laulun-miekka.campaign.v5`).
- **Uusi paikka `lakeside` (Järven ranta)**, rauhallinen kohtaus
  (`SCENE_KINDS`: friendly). Kartalla ruutu (9,6) niityn ja järven rajalla,
  Esc-dialogin oikotie ja `?scene=lakeside`. `world.ts` rakentaa sen samalla
  sijoittelulla kuin pihan: mökki `CABIN`, keittopaikka `LAKE_FIRE` (oma liekki
  pienennettynä `fireScale` 0,62, höyry padasta, valo, kipinät), laituri
  `JETTY`/`JETTY_AT`, vene `BOAT_AT`, kuivausteline, halkopino, ruovikko.
  Mallit tulevat `lakeside.glb`:stä (BLENDER_HANDOFF).
  - **Järvi.** `terrainHeight` sekoittaa maaston `lakeBed`iin
    (`lakeMix`, rantaviiva `shoreZ(x)`, vesi `WATER_LEVEL` −0,42, järvi +z-
    puolella). Lahti on kapea mökin kohdalla ja aukeaa laajaksi selkäväksi:
    `bayHalf(d, puoli)` kasvattaa puolileveyttä etäisyyden mukaan, ja yli 125 m:n
    päässä maa vajoaa veteen (`sea`). Maastoverkko on 360 m, vesitaso 1800 m,
    kameran kantama 700 m. Vastaranta on kaksi matalaa harjua 330–480 m:n päässä
    (`buildFarShore`, ei sumua, väri valmiiksi sekoitettu sumuun). Pelialue on edelleen
    11 m:n säteellä (`ARENA_RADIUS`), loppu on vain maisemaa. `groundHeight` on kävelykorkeus: laiturin päällä sen kansi,
    muualla sama kuin maasto. Vesi on yksi taso (`buildWater`, heijastava,
    värähtelevä normaali); rantakaistan ja pohjan maa on tallattua. Vedessä ei
    sijoiteta puita, kiviä eikä heinää (`wet()` ja `put`in `wetOk`).
  - **Hävitetty ranta (`lakeruin`, v03.09.00).** `ArenaId`/`SCENE_IDS` sisältävät
    `lakeruin`in (friendly, Esc-oikotie, aloitusvalikko; `?scene=lakeruin`). Sama
    maailma kuin rannalla (`LAKE`), lisäksi `RUIN`-lippu `world.ts`:ssä:
    `lakeruin.glb`:n `mokki_palanut`, `keittopaikka_sammunut`, `haasia_kaatunut`,
    `verilammikko`, `verilammikko_pieni`; ei venettä, melaa, koiraa, liekkiä, valoa
    (`buildFire` palauttaa sammuneen tulen), tulen vaara-aluetta eikä hirviöitä;
    mökin kohdalla kytevä tumma savu; utuisempi sumu ja himmeämpi valo. Tietäjä
    makaa selällään (`VillagerDef.lying`: hahmo kaadetaan -90° x:n ympäri, ei
    elävää animaatiota), `RUIN_SAGE`/`RUIN_BODY` antavat paikan ja suunnan; sauva
    makaa vieressä, veri rinnan kohdalla ja jälki mökin ovelta. Mökin törmäys on
    sama laatikko kuin ehjällä mökillä (matalat seinät eivät ole kulkukelpoisia).
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
- **Dev-palvelin työpuusta:** `bun run dev --port 5174 --strictPort`; sulje lopuksi.
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
  (13,11), joka maksaa 20 aikayksikköä. `crossingId` on terrainista erillinen,
  joten myöhempi silta voi käyttää samaa sääntöä. Joki kiemurtelee keskisen
  järven etelälaidasta itäiseen ulkoveteen. Kiinteät paikat: aloitus (10,14),
  punainen käsi (13,14), rantamökki (9,6), kalmisto (16,16); pihat ovat instansseja.
- **Aika ja kylläisyys.** Erillistä karttavoimaa ei ole. Tallennuksen
  `worldMinutes` on nyt pelaajalta piilotettu tausta-aika: maastokustannukset
  ja kylläisyyden kulumisnopeus 0,05 / yksikkö säilyivät ennallaan. Yksi
  kuunkierto on 180 yksikköä ja 28 pelipäivää; kuun kuva näyttää kierron
  kahdeksan vaihetta. Ensimmäisellä kierrolla UI näyttää ”Päivä x” ja sen
  jälkeen ”Kuu x, päivä y”. Tavallinen liike ei tulosta siirron aikakustannusta.
  Kylläisyys 100 = kylläinen ja 0 = nääntynyt; arvo ei tapa tai estä liikkumista.
  Viisi numerotonta kasvokuvaa:
  80–100 oikein kylläinen, 60–alle 80 kylläinen, 40–alle 60 puolivatsainen,
  yli 20–alle 40 nälkäinen, 0–20 nääntynyt.
- **Paperinukke ja inventaario.** Oikean reunan yhtenäinen näkymä korvaa
  tuohikonttipaneelin. Siinä ovat ImageGenillä tehty sankari, viisi tulevaa
  vaatepaikkaa, toimivat pää- ja sivukäden valinnat sekä kahdeksan
  tavarapaikkaa. Uusi matka alkaa kolmella ohrarieskalla; 3D-maailmasta voi
  saada lisää rieskaa, kuivattua kalaa ja tuohikontin. Ruoat kasvattavat
  kylläisyyttä eivätkä kulu arvossa 100. Keihäs tyhjentää sivukäden.
  Vain 3D-moottorin tukemat `sword_shield`-, `sword`- ja `spear`-yhdistelmät
  hyväksytään.
- **Kampanjatallennus** (`campaign.ts`, `storage.ts`) käyttää skeemaa 5 ja
  avainta `laulun-miekka.campaign.v5`. Se säilyttää terrain-paljastusten lisäksi
  erilliset `knownSiteIds`-paikkatiedot. V1–v3-migraatio päättelee tunnetuiksi
  vain ne kolmesta vanhasta paikasta, joiden ruutu oli löydetty; tulevia paikkoja
  ei skannata rekisteristä. Skeeman 1 `hunger` muunnetaan kylläisyydeksi ja
  v1/v2-tallennukset saavat miesoletuksen; v4 saa tyhjän maailmanesinetilan.
  Kelvollinen vanha tallennus ja sen
  päätelty paikkatieto palautetaan myös silloin, kun migraation kirjoitus estyy.
- **Matkan asetukset.** Esc avaa saavutettavan dialogin. Siellä valitaan
  kieli fontista riippumattomilla FI/GB-lipuilla ja karttasankarin sukupuoli
  kylläisimmistä kasvokuvista. Mies on uuden ja migroidun kampanjan oletus.
  Lisäksi dialogissa ovat vahvistettava "Aloita matka uudelleen" sekä
  oikotiet kaikkiin 3D-paikkoihin; rauhallinen piha ja järven ranta ovat
  ystävällisiä, nuotioaukio ja pihapiiri taisteluita. Paperinuken selectit ja
  tavaranapit eivät vuoda kartan näppäinohjaukseen.
- **Paikat.** `src/map/sites.ts` omistaa 2D-instanssin liikkumisen
  (`fixed|mobile`), elinkaaren (`persistent|temporary`), sijainnin ja erillisen
  `sceneId`-kytkennän. Pihat (instanssit), järven ranta, nuotioaukio ja kalmisto ovat
  `fixed+persistent`: ne löytyvät lähinäössä ja jäävät sen jälkeen sumuun himmeinä.
  Sama 3D-scene on kytketty kahteen 2D-instanssiin (`yard`, `yard-b`). Enter tai välilyönti
  aktivoi sankarin ruudun paikan kuten ennen.
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
- **Karttagrafiikka ja sankari.** `kalevala-map-atlas-v2.png` on 8 × 4 atlas;
  sen vasen puolisko säilyttää vanhat ikonit ja hahmot ennallaan. Kuudella
  aiemmalla terrainilla on kaksi deterministisesti valittavaa variaatiota.
  Joella on kolme suora-, mutka- ja päätevariaatiota, joita kierretään
  naapuriyhteyksien mukaan. `lake-shore-edge.png` muodostaa vesiruudun viereisen
  maan mukaan kierretyt, pyöristetyt rannat; joki lasketaan vedeksi joensuissa.
  `river-ford-overlay.png` piirtää kahlaamon joen päälle. Molemmat ovat 48 px:n
  läpinäkyviä ImageGen-päällysteitä Kalevala-tyylioppaan ja atlaksen pohjalta.
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
- **Taistelun stamina-arvot:** kevyt isku 6, raskas isku 12, toteutunut
  torjunta 4 ja torjunta-asento 1,5/s. Tavallisella 1/s palautumisella
  torjunta kuluttaa nettomääräisesti 0,5/s. Keihään vahinkokerroin on 1,1.
  Samat stamina- ja asearvot koskevat sankaria ja vihollisia.
- **UI ja kielituki.** Kartan pellavapohja, kirjontakehykset, paperinukke,
  kasvot ja dialogi ovat `src/style.css`:ssä. Kaikki näkyvät tekstit ovat
  tyypitetyissä FI/EN-sanakirjoissa.
- **Tarkistukset 2026-11-17 (v04.05.00):** `bunx vitest run --exclude ".worktrees/**"` (24
  tiedostoa, 300 testiä), `bun run lint`, `bun run build`, `git diff --check` läpäisty; build
  varoittaa vain suuresta 3D-chunkista (839 kt, gzip 227 kt).
- **Riippuvuustarkistus:** 2026-11-17: `bun outdated` tyhjä, mutta **`bun audit` löysi 1 korkean
  löydöksen: picomatch 4.0.7 (ReDoS, GHSA-fc5q-39xc-vjpf) vite/vitest-kehitystyökalujen
  kautta**. Vain kehitysaikainen, ei kulje pelaajalle. **Päivitysajoa ehdotettu omana
  branchinaan, odottaa omistajan lupaa** (`bun audit fix` tai lockfilen uusinta; ei apupaketin
  `bun update`).
- Debug: kartalla `window.__map` (tila, `move`, `enterSite`, paluukuorma),
  3D:ssä `window.__game`. Selainpaneelin fokus voi pysäyttää 3D-pelin.

## Tunnetut rajoitteet ja riskit

- Maastokustannukset, kylläisyyden kulumisnopeus, ruokien arvot, 50/0-rajat
  ja 20/40-rangaistukset ovat omistajan ensimmäinen päätös, eivät vielä
  laajasti pelitestattua tasapainoa.
- Prototyyppikartta on käsin tehty; vain pihojen paikat ja jousineidon talo
  arvotaan. Tallennettu piha jää paikalleen, vaikka Codex muuttaisi karttamaastoa
  myöhemmin: jos pihan ruutu muuttuu kulkukelvottomaksi, sille ei ole korjausta.
  Sijoitteluluvut (etäisyydet, 150 min) ovat arvio; löydettävyys selviää pelaamalla.
- Liikkuvien ja väliaikaisten kohtaamisten luokitus sekä piirron piilotussääntö
  ovat valmiina, mutta niiden instanssilistaa, liikeratoja tai poistumistiloja
  ei ole vielä toteutettu.
- Jokigrafiikka tukee suoria, kaarteita, päitä ja yhtä kahlaamoa, mutta ei
  vielä haaroja, siltoja, koskia, venettä tai vesianimaatiota.
- Vanha v3-tallennus voi ensimmäisellä latauksella asettaa sankarin ruutuun,
  joka on tässä karttaversiossa muuttunut joeksi. Sankari pääsee poistumaan
  viereiseen maahan, mutta lataus ei vielä siirrä häntä automaattisesti.
- Paperinuken viisi vaatepaikkaa ovat vasta visuaalisia varauksia. Vain
  pää- ja sivukäsi ovat toimivia; alkuvarusteet eivät vie tavarapaikkoja.
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
- 3D-chunk on noin 829 kt ja metsä noin 2 milj. kolmiota. LOD-malleja tai
  laatuasetusta ei ole; 60 FPS on mitattu tehokoneella.
- Moottori on v0: ei ajastimia, `unless`-peruutusta, ketjureaktioita (efekti ei
  lähetä tapahtumaa), laulu- tai paikkatapahtumia (`song.performed`) eikä efektejä
  "avaa laulu"/"paljasta paikka". Engine-lohkon tuntematon `version` luetaan
  silti (flags/counters poimitaan); jos semantiikka muuttuu, lisää versiohaara
  `parseEngineState`en. `npc.talked` lähtee jokaiselle puhutulle hahmolle.
- Rikkinäistä tallennetta ei kopioida talteen ennen korvaamista (ROADMAPin riski);
  moottorilohkossa salliva luku vain pudottaa tuntemattoman.

## Seuraava tehtävä

ROADMAPin **V7: leiri ja loppu**: `clearing`-aaltotaistelun voitto päättää kampanjan (loppuruutu,
"jatka / aloita alusta"); leiri on jo kartalla vasta V5:n jälkeen ja arvottu reunalle. Tarvitaan
tapahtuma taistelun voitosta (`wave.cleared`/`campaign.won`) moottoriin ja lippu `campaign.won`;
valitse aaltoraja (nyt `skirmish.ts` ei lopu) ja kirjaa se ROADMAPiin. Sen jälkeen V8
(pelitestaus, tallennuksen vienti/tuonti, läpipeluutesti, deployaus).

## Ei vielä aloiteta

- Louhen taistelu (varaukset yllä; karkotus laululla kuuluu V5:een); esine- ja puhemekaniikka kalmistolla
  on Codexin suunnittelema.
- Täysi karttaeditori, satunnaiset matkakohtaamiset ja sivujuonigeneraattori.
- Paperinuken vaate-esineiden datamalli ja 3D-ulkoasun vaihto.
- 3D-palkintojen tai ruokien lisääminen paluukuormasta inventaarioon.
- Yleinen quest-editori, laaja dialogipuu, ajastimet, `unless` ja kyläläisten vapaa liikkuminen.
- Inventaarion pudotus-UI ja pudotettujen esineiden 3D-instanssit.
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
