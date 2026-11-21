# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-21 (Codex, Windows; pohja `origin/main` `8fc9397`)

- **Koodiversio v05.00.02** branchissa `codex/pause-meter-lock`. Koodi valmis; ei deployattu eikä
  omistaja ole käsin testannut. Ajettu: `bun run test` 1119/1119, `bunx tsc --noEmit`, `bun run lint` ja
  `bun run build` läpi. Headless-Chromen savutesti clearingissä 1920×1080: ei konsolivirheitä;
  in-app-selain ei tavoittanut localhostia ja olemassa olevan Chromen ohjausta ei hyväksytty.
- **Taukomenu ja mittarit.** ESC avaa mittarit aina lukittuina ilman siirtokehyksiä taukodialogin ja
  tummennuksen alla. `Vapauta mittarit` / `Lukitse mittarit` -nappi vaihtaa `#hud.arrange`-tilan;
  vain vapautettuja mittareita voi raahata. Paikat tallentuvat entiseen `meters.v1`-avaimeen,
  lukitus ei muuta niitä, ja napit pysyvät mittarikerroksen päällä klikattavina.
- **Lehvästö ja laulun ilme.** `prepareMaterials` palauttaa BLEND-lehvästölle `depthWrite = true`n.
  Laulun haalistus ja vinjetti ovat `engine/view.ts`:n grade-shaderissa 0,4 s siirtymällä; vanha
  koko ruudun CSS-suodin poistettiin heikomman läppärin tahmausriskin vuoksi (ei vielä vahvistettu).
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
- **Loppuruutu** (`map/ending.ts` puhdas `endingSummary`/`shouldShowEnding`; `map/app.ts` `#mapEnding`,
  CSS `.ending-card`: pellavapohja, kaksoiskehys ja punasininen kirjontanauha): näkyy kartalla
  voiton jälkeen kerran. Tilasto: pelipäivät (+ kuunkierrot), tutkittu kartta %, opitut laulut x/3,
  kukistetut 9, kaatumiset (tai "et kaatunut kertaakaan"), luvattomat otot (tai "et ottanut mitään
  luvatta") ja sivupolut (huhu, Louhi, jousineito, taivaanrautamiekka ✓/–). "Jatka vaellusta"
  asettaa `campaign.endSeen` (Esc sama), "Aloita uusi matka" nollaa kampanjan; asetuksissa
  "Katso loppuruutu". Päivät ja kartta jäädytetään voiton hetkeen.
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
- **Tarkistukset 2026-11-21 (v05.00.00):** `bun run test` (27 tiedostoa, 320 testiä),
  `bunx tsc --noEmit`, `bun run lint`, `bun run build` ja `git diff --check` läpäisty. Build
  varoittaa vain suuresta 3D-chunkista (840 kt, gzip 227 kt). GLB-tarkistus löysi kaikki mies- ja
  naissankarin modulaariset solmut sekä `sword_sky_iron`in; Node-ympäristön tekstuurivaroitukset
  eivät koske selaimen Vite-latausta.
- **Riippuvuustarkistus:** 2026-11-20: ei mitään odottamassa. `bun audit` on puhdas ja
  `bun outdated --no-cache` ei listaa paketteja.
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
- 3D-chunk on noin 829 kt; rantakohtauksessa 1,26 milj. kolmiota (puut 2–2,7 k kpl, ~400 puuta).
  LOD-malleja tai laatuasetusta ei ole; 60 FPS on mitattu tehokoneella. Metsä on aukiokohtainen:
  puut, varvut ja heinät sijoitetaan kehänä origon ympärille, kaikki instanssinipat piirretään aina
  (`frustumCulled = false`), `@near`/`@far`-jako ja varjokamera (±34 m) ovat origon, eivät pelaajan,
  mukaan. Kuljettavan alueen laajennus vaatii ruutujaon, etäisyys-LODin/impostorit, pelaajaa
  seuraavat varjot ja kameran estekäsittelyn metsässä.
- Moottori on v0: ei ajastimia, `unless`-peruutusta eikä efektien ketjureaktioita.
  Tuntematon engine-versionumero luetaan sallivasti; semantiikkamuutos tarvitsee versionhaaran.
- Rikkinäistä tallennetta ei kopioida talteen ennen korvaamista (ROADMAPin riski);
  moottorilohkossa salliva luku vain pudottaa tuntemattoman.

## Seuraava tehtävä

Suunnittele omistajan kanssa 3D-kohtausten kuljettavan alueen laajennus (myös metsään): tavoitekoko,
metsän ruutujako ja LOD/impostorit, kamera metsässä. Ei toteutusta ennen omistajan hyväksymää suunnitelmaa.

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
- Metsän LOD, impostorit tai ruutujako ennen kuin laajennussuunnitelma on hyväksytty.
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
