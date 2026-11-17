# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-17 (Codex, Windows; pohja `origin/main` `b675df9`)

- **Branchin `codex/map-ford-shore-tiles` koodiversio on v04.01.00.** Kartalla
  on yksi kivinen kahlaamo ja järvillä pyöristetyt rantareunat. Koodi valmis,
  ei deployattu; varsinaista selainkoetta ei saatu auki (tarkistus alla).
- **CampaignStore (V1).** `src/map/campaignStore.ts` (puhdas) on 3D-puolen yksi
  tilan omistaja: `update(fn)` laskee uuden tilan, tallentaa sen ja ottaa sen
  käyttöön vasta onnistumisen jälkeen (epäonnistunut tallennus jättää tilan ja
  3D-esineen ennalleen), `subscribe` ilmoittaa muutoksista. 3D:ssä sen luo
  `engine/store.ts` (`initCampaignStore`, `campaignStore()`, `worldRuntime()`).
  `engine/sceneItems.ts` ei pidä enää omaa kopiota. Kartta (`map/app.ts`) on
  erillinen sivu ja lataa kampanjan omaan muuttujaansa; sitä ei siirretty storeen.
- **Maailmamoottori v0 (V2), `src/world/`**, Three.js- ja DOM-vapaa. `registry.ts`
  (tunnetut liput, laskurit, esineiden nimet; **uusi lippu lisätään tänne**),
  `state.ts` (`EngineState`: versioitu lohko `campaign.engine`, luetaan sallivasti:
  tuntematon lippu/laskuri ja väärän tyyppiset pudotetaan, tallennus säilyy),
  `types.ts`, `conditions.ts` (all/any/not, flag, counter, moonPhase, itemTaken;
  jokainen tulos kertoo syyn suomeksi), `effects.ts` (setFlag, addCounter, giveItem,
  takeItem, setSceneItemTakeMode, message; efektilista on **atominen**, eivät koske
  `worldMinutes`iä), `engine.ts` (`postEvent`: säännöt määrittelyjärjestyksessä, efekti
  ei synnytä uusia tapahtumia, ei ajastimia eikä `unless`ia), `take.ts` (esineen otto +
  `item.taken`-säännöt yhtenä päivityksenä), `dialogue.ts` (sama ehto/efektijärjestelmä),
  `summary.ts` (suomenkielinen yhteenveto), `runtime.ts` (store + moottori),
  `content.ts` (**pelin oikea data**: `RULES`, `SAGE_DIALOGUE`, `GAME_WORLD`).
  Tapahtumat: `item.taken`, `npc.talked`, `scene.entered` (3D lähettää kaikki).
  Jokaisella säännöllä ja dialogilla on pakollinen `intent` (suunnitteluaie-lause;
  testi vaatii). ROADMAPin hyväksymiskriteeri "emäntä kertoo huhun" on testattu
  testimaailmalla (`engine.test.ts`), ei pelisääntönä: pelin oikea sisältö on vain
  tietäjä + tuohikontti (omistajan rajaus).
- **Konsoli `__world`** (3D): `flags`, `counters`, `post(event)`, `explain(ruleId?)`,
  `describe()` (kaikki säännöt ja dialogit proosana omistajan hyväksyttäväksi),
  `last`, `items` (poimittavat esineet ja katseen kohde), `scene`. Sama olio sisältää
  `world.ts`:n tilastot (puut, kolmiot, törmäykset), jotka `world.ts` liittää siihen.
- **Dialogi 3D:ssä** (`engine/dialogue.ts`, `#dialogue` index.html:ssä): puhe-ele
  (`melee.ts` `gestureEffect`) lähettää `npc.talked`in ja avaa dialogin, jos
  `findDialogue(ARENA, npcId)` löytyy; muille hahmoille näytetään vain nimi.
  Dialogin ajan pelilogiikka ja pelin aika ovat pysähdyksissä (maisema liikkuu),
  hiiren lukitus vapautuu, valinta numerolla 1-9 tai klikkauksella, Esc sulkee.
  **Ensimmäinen polku (`lakeside`, tietäjä `tietaja`, esine `lakeside.sage-pack`):**
  pyyntö asettaa lipun `sage.permission` ja `setSceneItemTakeMode(allowed)`, jolloin
  otto ei ole varkaus. Luvaton otto (`item.taken`, theft, kohtaus `lakeside`) jättää
  varkausloki-tietueen **ja** sääntö `sage.theft-noticed` asettaa `sage.robbed`,
  kasvattaa laskuria `thefts.noticed` ja näyttää viestin; tietäjän dialogi vaihtuu
  (`robbed` → anteeksipyyntö → `forgiven`, loki säilyy). Hävitetyllä rannalla
  (`lakeruin`) ja pihalla tietäjällä ei ole dialogia eikä varkaus laukaise seurausta.
- **Käsin testattu 2026-11-16 Clauden in-app-selaimessa (dev-palvelin):** dialogi avautui
  puheesta, klikkaus/numero valitsi, Esc sulki ilman taukoa; lupa säilyi uudelleenlatauksen
  yli; luvaton otto antoi viestin, liput, lokin ja `explain`in; pihalla puhe näytti vain
  nimen; ei konsolivirheitä. **Ei testattu:** oikea hiiren lukitus dialogissa, ruudunlukija,
  englanninkieliset tekstit.
- **Rauhallisten 3D-kohtausten esineet.** `sceneInteraction.ts` valitsee
  sankarin katseakselilta enintään 2,8 m:n päässä olevan esineen. HUDin pieni
  piste projisoidaan maailmaan; osuva piste näyttää esineen nimen, varkauden ja
  täyden inventaarion. Käytä-ele lukitsee painallushetken kohteen ja ratkaisee
  oton eleen keskellä. Tallennus tehdään ennen 3D-juuren poistamista; epäonnistunut
  tallennus jättää esineen paikalleen. `world.ts`:n dynaamiset esineet jakavat
  GLB-prototyyppien geometrian ja materiaalit, eikä niillä ole liikecollidereita.
  Instanssit: `lakeside.sage-pack` (sama myös `lakeruin`issa),
  `yard.table-flatbread` (3 rieskaa) ja `yard.table-dried-fish` (3 kalaa).
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
  järven etelälaidasta itäiseen ulkoveteen. Paikat: aloitus (10,14), piha
  (10,11), punainen käsi (13,14), rantamökki (9,6), kalmisto (16,16).
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
  `sceneId`-kytkennän. Piha, järven ranta, nuotioaukio ja kalmisto ovat `fixed+persistent`:
  ne löytyvät lähinäössä ja jäävät sen jälkeen sumuun himmeinä. Sama 3D-scene
  voidaan myöhemmin kytkeä moneen eri 2D-instanssiin. Enter tai välilyönti
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
- **Tarkistukset 2026-11-17 (v04.01.00):** `bun run test` (22 tiedostoa,
  258 testiä), `bunx tsc --noEmit`, `bun run lint`, `bun run build` ja
  `git diff --check` läpäisty. Buildin ainoa varoitus on ennestään suuri
  3D-chunk: 828,66 kt, gzip 223,10 kt; karttasovellus 25,59 kt, gzip 13,53 kt.
  Kaikki 16 rantamaskia ja kahlaamo tarkastettiin staattisesta renderikoosteesta:
  saumat sulkeutuvat. In-app-selain ei tavoittanut localhostia, joten oikeaa
  karttanäkymää ei tarkastettu selaimessa.
- **Riippuvuustarkistus:** 2026-11-17, ei mitään odottamassa; audit puhdas.
- Debug: kartalla `window.__map` (tila, `move`, `enterSite`, paluukuorma),
  3D:ssä `window.__game`. Selainpaneelin fokus voi pysäyttää 3D-pelin.

## Tunnetut rajoitteet ja riskit

- Maastokustannukset, kylläisyyden kulumisnopeus, ruokien arvot, 50/0-rajat
  ja 20/40-rangaistukset ovat omistajan ensimmäinen päätös, eivät vielä
  laajasti pelitestattua tasapainoa.
- Prototyyppikartta on käsin tehty ja kiinteä. Deterministinen
  siemenpohjainen generaattori, juonipaikkojen ehdot ja validaattori puuttuvat.
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
  sekä 3D-sankarin (jousineidon vartalo). Jousineito-NPC pihalla on edelleen
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

Omistaja pelaa dialogipolun käsin (tietäjä rannalla: luvallinen ja luvaton otto) ja
hyväksyy `__world.describe()`-tulosteen sääntöjen aikeet. Sen jälkeen ROADMAPin
**V3: paikkainstanssit ja satunnaiset pihapiirit** (`claude/cairn-map-site` on mergattu).
Älä aloita V3:a ennen omistajan palautetta, jos hän muuttaa dialogin tai sääntöjen muotoa.

## Ei vielä aloiteta

- Louhen taistelu ja suoloitsu (varaukset yllä); esine- ja puhemekaniikka kalmistolla
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
