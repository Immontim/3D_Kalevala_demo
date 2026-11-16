# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-16 (Claude, Windows; pohja `origin/main` `eed0b8c`)

- **Origin/mainin koodiversio on v03.09.00** (järven laajennus, hävitetty ranta,
  stamina- ja keihästasapaino). **Branchin `claude/cairn-birch-grove` koodiversio on
  v03.10.00** (kalmisto). Koodi valmis, ei deployattu, käsin testattu (alla).
  Tarkista merge-tila ennen jatkamista:
  `git merge-base --is-ancestor claude/cairn-birch-grove origin/main`.
- **Kalmisto `cairnfield` (v03.10.00)**, rauhallinen kohtaus (`SCENE_KINDS`:
  friendly). Esc-dialogin oikotie, aloitusvalikon paikanvalinta ja `?scene=cairnfield`;
  ei vielä karttapaikkaa (`sites.ts`:ään lisätään kuten rannalle, kun omistaja haluaa).
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
  (= miekan kevyt sivallus, 2,3 m / ±60°) ja näyttää nimen; `USE_ZONE` (1,6 m /
  ±60°) odottaa esineitä, kohteita ei vielä ole. Puhuteltava väki rekisteröidään
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
  varusteet ja sukupuolen kampanjatallennuksesta (`laulun-miekka.campaign.v4`).
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
- **Dev-palvelin työpuusta.** Clauden `preview_start` käynnistää palvelimen
  pääkansiosta, ei työpuusta. Työpuun testi: `bun run dev --port 5174
  --strictPort` työpuusta; sulje palvelin lopuksi.
- **Sovellusrakenne.** `src/main.ts` on kevyt sovelluskuori. URL ilman
  `scene`-parametria käynnistää 2D-kartan. `?scene=<id>&return=map` lataa
  dynaamisesti `src/scene3d.ts`:n ja nykyisen Three.js-moottorin. Kartta
  ei pyydä GLB-tiedostoja eikä aja 3D-silmukkaa. Tuotantobuildin kartta-UI
  on noin 19 kt JS; 3D-chunk noin 803 kt.
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
  aikaa. Vesi ja joki ovat jalan kulkukelvottomia. Joki kiemurtelee keskisen
  järven etelälaidasta itäiseen ulkoveteen. `prototype.ts` on vertailukartta:
  aloitus (10,14), rauhallinen piha (10,11), punainen käsi (13,14).
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
  tavarapaikkaa. Kolme ohrarieskaa ja kaksi kuivattua kalaa kasvattavat
  kylläisyyttä eivätkä kulu arvossa 100. Keihäs tyhjentää sivukäden.
  Vain 3D-moottorin tukemat `sword_shield`-, `sword`- ja `spear`-yhdistelmät
  hyväksytään.
- **Kampanjatallennus** (`campaign.ts`, `storage.ts`) käyttää skeemaa 4 ja
  avainta `laulun-miekka.campaign.v4`. Se säilyttää terrain-paljastusten lisäksi
  erilliset `knownSiteIds`-paikkatiedot. V1–v3-migraatio päättelee tunnetuiksi
  vain ne kolmesta vanhasta paikasta, joiden ruutu oli löydetty; tulevia paikkoja
  ei skannata rekisteristä. Skeeman 1 `hunger` muunnetaan kylläisyydeksi ja
  v1/v2-tallennukset saavat miesoletuksen. Kelvollinen vanha tallennus ja sen
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
  `sceneId`-kytkennän. Piha, järven ranta ja nuotioaukio ovat `fixed+persistent`:
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
  naapuriyhteyksien mukaan. Uusi grafiikka tehtiin ImageGenillä annetun
  Kalevala-tyylioppaan ja vanhan atlaksen pohjalta sekä viimeisteltiin 48 px:iin.
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
- **Käsin testattu 2026-11-16 Codexin in-app browserissa:**
  - punainen käsi ei näkynyt ennen lähestymistä, löytyi 3 × 3 -lähinäössä;
  - löydetty käsi jäi etääntymisen jälkeen sumuun himmeänä;
  - himmennetty ikoni ja paikkatieto säilyivät sivun uudelleenlatauksen yli;
  - vain nykyinen 3 × 3 näkyi kirkkaana ja vanha terrain jäi himmeäksi;
  - pihapiirin ikoni katosi kahden ruudun päässä ja palasi lähinäössä;
  - joen suorat ja mutkat liittyivät, reitti kiemurteli ja liike jokeen estyi;
  - uusi matka alkoi tekstistä ”Päivä 1” ja niittyliike eteni päivään 2;
  - 180 tausta-aikayksikössä teksti vaihtui muotoon ”Kuu 1, päivä 1”;
  - tavallinen liike tyhjensi vasemman alareunan siirtokohtaisen aikaviestin;
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
- **Tarkistukset 2026-11-16 (v03.09.00):** erillisessä worktreessä
  `bun run test` 194/194 (17 versionhallittua testitiedostoa),
  `bunx tsc --noEmit`, `bun run lint`, `bun run build` ja
  `git diff --check` läpäisty. Pääkansion aiempi 416/37-lukema sisälsi
  myös sen alle luotujen Claude-worktreeiden testit.
  Selaimessa: `?scene=lakeside` ja kartalta (9,6) → "Astu rannalle" toimivat,
  konsolissa ei virheitä, 56–60 FPS pienessä in-app-ikkunassa (suuremmalla
  näytöllä FPS mittaamatta); kävelytesti: laiturin päähän asti, rannalla pysähtyy
  nilkkaan, laiturin sivuille ei pääse; pihan ja nuotioaukion lataus ennallaan.
  Build varoittaa edelleen 3D-chunkin ylittävän 500 kt (803,27 kt;
  gzip 214,11 kt). Build sisältää myös uuden `lakeruin.glb`:n (1,88 Mt).
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
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
- Jokigrafiikka tukee suoria, kaarteita ja päitä, mutta ei vielä haaroja,
  siltoja, koskia, venettä tai vesianimaatiota.
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
- Kartta–3D-siirtymä lataa sivun uudelleen. Samassa ajossa mount/dispose
  vaatisi scene/world-singletonien laajemman elinkaarirefaktoroinnin.
- 3D-taistelun tasapainoa ei ole kattavasti pelitestattu. Suuntatorjunta,
  keihään kantama, usean vastustajan rytmi ja nuotion vahinko ovat arvioita.
- Rauhallisen pihan väki ei reagoi taisteluun. Eläinten ja kyläläisten
  mallikohtaiset avoimet asiat ovat `docs/BLENDER_HANDOFF.md`:ssä.
- Järven rannan vesi on yksinkertainen: ei rantavaahtoa, syvyysväriä eikä
  aaltoja laiturin kohdalla. Kaukorannalla ei ole kasvillisuutta kaukaa
  nähtynä; rantakohtauksen koira ei käyskentele (ei kävelyleikettä).
- 3D-chunk on noin 803 kt ja metsä noin 2 milj. kolmiota. LOD-malleja tai
  laatuasetusta ei ole; 60 FPS on mitattu tehokoneella.

## Seuraava tehtävä

Toteuta deterministinen, siemenpohjainen karttageneraattori nykyisen käsin
tehdyn kartan rinnalle. Ensimmäinen rajaus: kuusi terrainia, aloituspiha,
punaisen käden taistelupaikka ja ehdollisesti sijoitettavat juonipaikat.
Validaattorin pitää todistaa kaikkien pakollisten paikkojen saavutettavuus ja
hylätä rikkinäinen siemen. Lisää kehittäjän siemen-/paljastusesikatselu, ei
vielä täyttä karttaeditoria.

## Ei vielä aloiteta

- Louhen taistelu ja suoloitsu (varaukset yllä); esine- ja puhemekaniikka kalmistolla
  on Codexin suunnittelema.
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
