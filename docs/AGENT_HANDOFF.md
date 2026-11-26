# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-26 (Claude, Windows; pohja `origin/main` `b06a767`)

- **Koodiversio v08.07.00** branchissa `claude/pohja-warriors-axe` (tarkista merge `git merge-base`illa).
  Koodi valmis, ei deployattu. Agentti testasi käsin (leiri, `?scene=clearing`); omistaja ei. Väijytyksen
  vaihe 1/2. Tarkistukset ja tulokset: ks. commit-viesti. v08.06.03:n (seppä, selkäkilpi) omistajatesti puuttuu yhä.
- **Pohjan uudet soturit ja kirves (v08.07, `fighter.ts`, `combat.ts`).** `FighterLook`: `build`
  (`tanakka`|`hoikka`, vain `character: "pohja"`; vartalo `pohja_<build>.glb`:stä kuten naissankarin
  `villagers_f.glb`), `tunic` (`vaalea`|`tumma`, oletus tumma), `axe` (`parta`|`karjala`, `kirveet.glb`;
  varustus pysyy `sword`/`sword_shield`). Osat: `_base` + yksi nuttu + `_mail` jos `ringMail` + `_huotra` vain
  miekalla; kypärä `helmet_<build>`; kilpi/miekka/keihäs `characters.glb`:stä; keihäs `GRIP_CHANNEL_POHJA`.
  Uusilla vartaloilla ei ole säärisuojaosaa (`greaves` vaikuttaa vain laskentaan). Kirves = `WEAPONS.axe`:
  reach −0,15, slowness 1,15, damage 1,2, overhead 1,1 / slash 1, ei pistoa, `shieldWear` 1,5 (uusi
  `WeaponDef`-kenttä, kertoo `shieldDamage`n). Kirves kiertyy varren ympäri −90° ylälyönnin asennoissa
  (`AXE_CHOP_POSES`), muuten 0: mitattuna terä johtaa ylälyönnissä 0,84–0,93 ja sivalluksessa 0,45–0,75
  (ilman kiertoa ylälyönti meni lappeella). `ai.ts` arpoo vain aseen omista iskuista. Rauhassa kirves menisi
  `mount_kirves`iin (vain uudet vartalot). Konsoli: `__game.showcase(true, undefined, "pohja")`,
  `__game.addWarrior(look, x, z)`. Kolme soturia + sankari leirissä: `renderBench` 7,8 ms/ruutu (2,24 milj.
  kolmiota, 212 kutsua), näkyvä mittari 60 FPS; konsoli puhdas.
- **Sepän paja (v08.06, `smithyLayout.ts`, `smithyLife.ts`, `world.ts`, `world/content.ts`).** Kohtaus arpoo
  käynnillä työn (seppä vasaroi, sälli palkeilla, pikkusälli karkaisuvadilla; ei koiraa) tai kaupan (seppä
  kojulla, pikkusälli + koira yhdessä neljästä pihapaikasta; ei aikuista sälliä). GLB-puun mountit ja palkeiden
  morphit säilytetään; assetit latautuvat vain pajassa. `smithy.spear` ja `.greaves` alkavat varkautena.
  Kahdeksan `meat`-tagin esinettä avaa yhden; jommankumman luvallinen otto sulkee molemmat. Lähdössä merkitty
  maailma-aika avaa toisen kaupan 30 pelipäivän jälkeen. Avoin maksettu lupa säilyy, kunnes tuote otetaan.
  Sällin kertadialogi paljastaa neidon maatilan. Avokatos on kuljettava osakohtaisin törmäyksin. Katoksen
  säde 10,9 m, kävelyraja 12,35 m. Paljemorphit ja kisällin IK lukevat samaa `actionTime`-kelloa.
- **Villisika (v08.04, `hunt/boar.ts` puhdas + `engine/boars.ts`).** 0–2 sikaa (`boarCount`), tilakone ja
  luvut `BOAR`-vakiossa. Nuolet `boarBodies` → `traceWorld`, lyönnit `melee.setCreatureStrike` →
  `meleeBoarDamage`. `g.danger` kumoaa `heroAtPeace`n; X vaihtaa vaarassa jousen ja aseen. Kuolema
  erämaassa: `huntDeathReturn(toStartMenu)` (väijytyksen kuoleman malli). Lukitus ei tunne sikaa.
- **Uhri ennen laulua (v08.02, `content.ts`).** `ASK_SONG`: `ask-song` → `sage.offeringAsked` + `revealSite
  cairn-b`; `ask-song-taught` (`offering.made`) → `songIntro`; odotus `sage.offeringAwaited` → `askOffering`.
  Esineillä `tags` (`ItemTag` `"meat"`); ehto `hasTagged`, efekti `takeTagged` (`tryRemoveTagged`).
- **Pitkäkestoiset efektit (v08.01, `map/longEffects.ts`).** `CampaignPlayer.effects` = `{ id, until }`
  (maailma-aika, salliva luku). Kolme paikkaa; sama efekti alkaa alusta, neljäs eri epäonnistuu. Moottorin
  efekti `addLongEffect`; 3D `transition.applyLongEffects` (muunnin `long-effect:<id>:<stat>`).
- **Kuppikivi (v08.01–02, `cupstoneDialogue`).** Louhen kalmistolla puhuteltava `kuppikivi`, `cairn-b`:llä
  `uhrikivi`; vain uhrikivellä "Ota uhrit…". "Ukon muistan…" → `ukko_blessing` + `markMoon`.
- **Mökki ja kalmistot ovat instansseja (v08.00, `map/sites.ts`).** `lakeside`, `cairnfield` ja `cairn-b`
  arvotaan rannoille (`placeShoreSites`) ennen pihoja; vanha tallennus `completeSiteInstances`.
- **Piha (v07.02–v07.04, `content.ts`, `world.ts`, `yardLife.ts`).** Neito `vuode`lla; `archer.healed` (`minHits`
  6), `archer.died-song`, `archer.died-left` (`npc.leftBehind`, `engine/leave.ts`). `housewifeDialogue(npc)`
  (`emanta` neidon talossa, `emanta_b` toisessa): huhu kerran kummalta tahansa (`rumor.heard`), sitten apaja
  kerran kuussa (`emanta.huntTipMoon`); tervehdykset `greetWounded`/`greet`/`greetAgain`/`greetHealer`
  (`meetingRules`: `<npc>.greeted` → lähtiessä `<npc>.met`); ruoka `householdFood`/`theftRule`
  (`<npc>.robbed`, `moonChance`, pöytäesineet roolilla `@archerYard.`/`@otherYard.`, `world/instances.ts`).
  Väen ja eläinten paikat arvotaan käynnittäin (`pickSpot`, `planYardAnimals`; `__world.yard`).
- **Kohtausmalli (`src/sceneLayout.ts`, puhdas).** `SceneLayout`: kuljettava monikulmio `bounds`, `arena`
  ja polunsuut `exits` (`mapDir`); kuljettava = monikulmio tai polunsuun käytävä, rajaus `clampToWalkable`.
  Vanhat kohtaukset ovat 11 m:n ympyröitä. Konventio: 3D:n −z = pohjoinen, +x = itä.
- **Polunsuusta poistuminen (`src/engine/exit.ts`).** 1 s:n häivytys (`#exitFade`), jonka aikana peli jatkuu;
  kuolema tai paluu peruu. `?return=map`: `postLeftBehind` → `createEmptySceneReturn(scene, mapDir)` → kartta
  astuu ruudun `exitDir`iin. Vihje "Polku vie pois" alle 6 m:stä. `__game.exitState()`.
- **Metsä (`src/forest.ts`).** `Forest`: alle `nearR`:n täysi puu, kauempana `forest_lod.glb`, vaihto Bayer-
  kuvioilla 5–6 m:n kaistalla; `nearR` 48 (erämaa 38), `farR` 135. Horisonttisuikaleet `metsaseina`.
  Konsoli: `__world.forest`, `__world.forestNear(r)`, `__game.drawLoad()`.
- **Kamera metsässä.** `CollisionWorld.firstCameraHit` + `blocksCamera`: kamera vetäytyy rungon eteen.
  `engine/foliageFade.ts` häivyttää lähilehvästön ja harventaa kameran ja sankarin välistä (varjot umpinaisia).
- **Erämaa `wilds` (friendly, Esc-oikotie, aloitusvalikko, `?scene=wilds`; ei karttapaikkaa).** 200 × 200 m:n
  kuljettava alue (monikulmio ±97 m), kolme polunsuuta. Maasto `wildsHeight` (suoniitty `bogMix`,
  paloaukea `burnMix`). ~4 900 puuta; kivet, kelot ja juurakot alle 60 m:n päähän, aluskasvillisuus
  `ScatterField`illa 34 m:n säteellä. Piirtokuorma alussa ~0,96 milj. kolmiota.
- **Paperinukke ja inventaario.** Skeema 8 (`laulun-miekka.campaign.v8`): kuusi peruspaikkaa, reppupaikka ja
  repusta 0–12 lisäpaikkaa (`ItemDefinition.storageCapacity`; tuohikontti 6), seitsemän varustepaikkaa.
  Vanhan tallennuksen ylivuoto säilyy. Kartta ja 3D:n pause (`B`) käyttävät `ui/inventoryView.ts`:ää;
  taistelussa vain luku. Uusi matka alkaa ilman keihästä ja säärisuojia; v1–v7:stä ne poistetaan, paitsi
  sepältä jo otettu kappale. Ase- ja kilpivaihdot ovat atomisia; pääkättä ei voi jättää tyhjäksi.
- **3D-varusteet ja suoja.** Mies- ja naissankari käyttävät Clauden modulaarisia base/mail/greaves/
  shoes-solmuja ja Taivaanrautamiekka omaa `sword_sky_iron`-malliaan. Rengaspaita kertoo vahingon
  0,85:llä, säärisuojat 0,95:llä. Vain ylälyönti voi irrottaa kypärän; silloin koko isku torjutaan.
  Sama sääntö on pelaajalla ja vihollisilla. Tarkat arvot ovat `combat.ts`in `ARMOUR`-vakiossa.
- **V6 ja leirin arvonta (mergattu).** Leiri on instanssi `camp` (`placement.ts` `CAMP_PLACEMENT`: reunakaista,
  >= 8 ruutua aloituksesta, <= 600 min, lukossa lipulla `louhi.banished`). Jousineito on `archer`-pihassa
  (v07.02 yllä); dialogista `sky_iron_sword` (vahinko 1,3; oma GLB-malli). Tietäjä vain rannalla, nuori urho
  `archer`-vapaassa pihassa.
- **Louhen yhteenotto ja karkotus (v08.05).** Puhdas `louhiEncounter.ts` erottaa taistelun vaiheen,
  Louhen läsnäolon ja aktiivisen kyvyn, jotta Louhelle voi myöhemmin lisätä liikkeen ja kykyjä ilman
  dialogin tai vartija-aallon muutosta. `engine/louhi.ts`: dialogihaaste tai suoran Pohjolan unen 2.–3.
  riimu kutsuu kerran kaksi `pohja/sword_shield`-soturia Louhen takaa. Soturien kuoltua paikka rauhoittuu.
  Louhi on paikallaan ja vahingoittumaton; aktiivisessa taistelussa hän aloittaa 8 m:n sisältä 18 s:n
  reaaliaikaisen suolaulun. Louheen osuva lyönti katkaisee sen. Läpimeno juurruttaa 4 s, tekee 5 HP/s ja
  pitää asevahingon normaalina. Pohjolan uni vaatii taistelussa Louhen ≤ 6 m:n päähän, hidastaa viholliset
  50 %:iin 6 s:ksi ja käyttää vanhaa `song.performed` → `louhi.banished`/leirin paljastus -ketjua.
  `folk.ts`:n `idle|sing|hit`-toimintakerros animoi nykyistä Louhi-mallia koodissa. Karkotus käyttää vielä
  vanhaa kutistumista; lumihiutalekatoaminen on myöhempi työ.
- **Satunnaiset pihapiirit.** `map/siteInstances.ts` tallentaa siemenen ja paikat (`yard`/`yard-b`).
  `yardMeadows.ts` kasvattaa taloruudusta 3–9 sivuttain kiinni olevaa niittyruutua viiden ruudun
  levyisellä alueella. Metsät ja nykyinen niitty käyvät, ranta ja muut paikat rajaavat kasvua.
  `map/app.ts` johtaa saman kartan piirtoon ja liikkeeseen tallennusta avatessa ja matkaa aloittaessa.
  Kartta välittää `?site=<id>` 3D:lle. Jousineito kuuluu `archer`-pihaan.
- **CampaignStore (V1).** `map/campaignStore.ts`: 3D:n yksi tilan omistaja, `update(fn)`
  tallentaa ennen käyttöönottoa; 3D:ssä `engine/store.ts` (`campaignStore()`,
  `worldRuntime()`). Kartta (`map/app.ts`) lataa kampanjan omaan muuttujaansa.
- **Maailmamoottori v0 (V2), `src/world/`**, Three.js- ja DOM-vapaa: `registry.ts` (liput, laskurit;
  **uusi lippu lisätään tänne**), `conditions.ts`, `effects.ts` (atominen, ei koske `worldMinutes`iä;
  UI-toimet `OutAction`eina), `engine.ts` (`postEvent`; ei ajastimia eikä ketjureaktioita), `content.ts`
  (**pelin oikea data**). Jokaisella säännöllä ja dialogilla pakollinen `intent`. Konsoli `__world`:
  `flags`, `counters`, `post`, `explain`, `describe()`, `items`. Dialogi 3D:ssä `engine/dialogue.ts`.
- **Rauhallisten 3D-kohtausten esineet.** `sceneInteraction.ts` valitsee katseakselilta enintään 2,8 m:n
  päässä olevan esineen (tai `Pickable`n); HUDin piste näyttää nimen, varkauden ja täyden inventaarion.
  Käytä-ele lukitsee painallushetken kohteen ja ratkaisee oton eleen keskellä. Tallennus ennen 3D-juuren
  poistoa; epäonnistunut tallennus jättää esineen paikalleen. Instanssit: `lakeside.sage-pack` (myös
  `lakeruin`) sekä pihassa `<pihan tunniste>.table-flatbread` (3) ja `.table-dried-fish` (3).
- **Esinedomain ja pysyvyys.** `CampaignWorld.sceneItems` tallentaa otetut instanssit, `allowed|theft`-
  lupapoikkeamat, varkaustietueet sekä varauksen myöhemmille pudotetuille
  esineille (paikka, kierto, määrä ja seuraava tunniste). `setSceneItemTakeMode`
  on nyt kytketty tietäjän dialogiin (yllä). Pudotus-UI:ta tai pudotettujen mallien
  luontia ei vielä ole. Uusi matka alkaa kolmella ohrarieskalla ilman kalaa;
  tuohikontti on tavallinen yhden kappaleen esine.
- **Kalmisto `cairnfield`** (friendly; Esc-oikotie, aloitusvalikko, `?scene=cairnfield`; karttapaikat
  instansseina, ks. v08.00). `world.ts`: `CAIRN`-lippu; `LAKE` = `LAKESIDE || CAIRN` (vesi, kaukoranta, rantakaista). Maasto on
  kallionokka (`terrainHeight`, `shoreZ` z ≈ 21). Sijoittelu vakioina `world.ts`:n alussa (`CUPSTONE`,
  `CAIRNS_AT`, `KARSIKKO`, `LOUHI_AT`, `DARK_SOIL`). Louhi `populateCairnLife`issa, ääni `Sfx.birds`.
  Louhen kalmisto käyttää hybridi-Encounteria; toinen kalmisto pysyy rauhallisena.
- **Rauhan kävely ja eleet** (`fighter.ts`, `interact.ts`, `engine/{hero,melee,animate}.ts`): rauhassa
  (`heroAtPeace`) iskunappi = `talk`, torjuntanappi = `use`; eleet ovat `gesturePose()`-avainkehyksiä ja
  vaikutus ratkeaa `gestureEffect`issä (`TALK_ZONE` 2,3 m / ±60°). Puhuteltava väki `world.ts`:n `solid()`ista.
- **Naissankari 3D:ssä.** `PLAYER_LOOK.female` kampanjasta; `Fighter.build` ottaa vartalon, huotran ja
  hihnan `villagers_f.glb`:stä (`char_jousineito`) ja varusteet `characters.glb`:stä (`attachFemaleGear`).
  **Avoin:** omistajan näkemä leijuva musta kypärä aloitusvalikossa (Chrome/Edge) ei toistunut;
  v03.05.01:n korjaus vahvistamatta. Keihästä ja kilvetöntä asetta naisella ei ole katsottu.
- **Sormet, vapaa kamera, debug.** `Fighter.applyFingers` (rauha 0,7, eleet 0,9, taistelussa nyrkki); vapaa
  kamera pause-valikosta (`freecam.ts`); `__game.gesture`, `freeze()`/`step(n)`, `setCamera`, `placePlayer`.
  Monien muokkausten jälkeen dev-palvelimen moduulit voivat monistua: käynnistä uudelleen.

- **Järven rannat.** `lakeside` on rauhallinen mökki-, keittotuli-, laituri-, vene- ja
  tietäjäkohtaus; `lakeruin` käyttää samaa maastoa mutta palaneita rakennuksia, kuollutta tietäjää ja
  sammunutta tulta. Järvi jatkuu horisonttiin, vastaranta on sumuinen maisema ja syvä vesi estää kulun;
  laiturilla voi kävellä. Tietäjä, koira, mökki, vene ja tuli törmäävät. Tietäjän paikka arvotaan käynnittäin
  (`populateLakeLife`: pata 0,45, ovensuu 0,3, laituri 0,25), koira on useimmiten hänen lähellään
  (`__world.lake`). Tietäjän repliikit eivät saa olettaa tulta. Mallit: `BLENDER_HANDOFF.md`.
- **Dev-palvelin ja savutesti:** `preview_start` lukee session aloituskansion `.claude/launch.json`in
  (työpuussa tarkista `fetch('/src/…')`illa). 3D-kohtaus vaatii aloitusvalikon "Aloita" (`#startBtn`).
  Piilotettu paneeli pysäyttää rAF:n: aja ruudut `__game.renderBench(n)`illä. Moduulin konsolituonti
  muokkausten jälkeen antaa erillisen kopion: käynnistä palvelin uudelleen.
- **Laulun tahmaus heikolla koneella:** shaderisiirto (v05.00.01) vahvistamatta; jos tahmaa, poista ensin
  säekaarten `verseGlow` (CSS `drop-shadow`). Opetuksen kaaripolku on tarkistettu vain koodina.
- **Sovellusrakenne ja kartta.** Ilman `scene`-parametria käynnistyy 2D-kartta (`map/app.ts`, Canvas 2D, 20 × 20
  ruutua, 48 px:n tiilet, kamera 17 × 13); `?scene=<id>&return=map` lataa dynaamisesti `scene3d.ts`:n. Säännöt
  puhtaassa `map/domain.ts`:ssä (maastot, `minuteCost`, ainoa kuljettava vesiruutu silta (13,11), `bridgeArt.ts`).
- **Aika ja kylläisyys.** Erillistä karttavoimaa ei ole. Piilotettu `worldMinutes` sallii päivän
  murto-osat; vanhojen tallennusten jo kertynyt aika, 180 yksikön kuunkierto ja 28 päivää säilyvät.
  Kohderuudun kulku: niitty 1/6 päivää, metsä 1/4, umpimetsä 1/3, kallio 1/2, suo 0,7 ja silta
  0,4 päivää. Kylläisyys vähenee 3,6 pistettä päivässä (niittyliike 0,6); 100 → 0 kestää noin 28
  päivää ilman ruokaa. Arvo ei tapa tai estä liikkumista. Kuun kuva näyttää kahdeksan vaihetta;
  tavallinen liike ei näytä kustannusta. Viisi numerotonta kasvokuvaa 20 pisteen portain.
- **Kampanjatallennus** (`campaign.ts`, `storage.ts`) käyttää skeemaa 8 ja avainta
  `laulun-miekka.campaign.v8`. V1–v7 migroidaan;
  kelvollinen vanha tila palautetaan myös, jos migraation kirjoitus estyy. **Uusi aikakenttä tarkistetaan
  `validWorldTime`illa**, ei kokonaislukuna (kartan aika on murtolukuja).
- **Matkan asetukset.** Esc-dialogissa ovat FI/GB-kieli, sukupuoli, vahvistettava uudelleenaloitus
  ja 3D-oikotiet kohtaustyyppeineen.
- **2D↔3D-sillat.** `transition.ts` vähentää nälkäisessä taistelussa HP- ja staminakattoa 20,
  nääntyneenä 40; vaikutus on idempotentti eikä koske ystävällisiä kohtauksia. Paluukuorma
  `laulun-miekka.scene-return.v1` kulutetaan kerran; `rewards` on vielä tyhjä varaus.
- **Karttagrafiikka.** `kalevala-map-atlas-v2.png` (maasto, joki, miehen sankariruudut), `lake-shore-edge.png`;
  naisella `paper-doll-hero.png`, `satiety-faces.png`, `map-hero-female.png`, miehellä `*-male.png`-parit.
- **3D-moottori.** Rauhassa miekka on huotrassa, kilpi selässä ja kypärä poissa;
  taistelu palauttaa varustuksen. Keihäs pysyy kädessä. Assettiriskit: `BLENDER_HANDOFF.md`.
- **Taistelun stamina-arvot:** kevyt isku 6, raskas isku 12, toteutunut
  torjunta 4 ja torjunta-asento 1,5/s. Tavallisella 1/s palautumisella
  torjunta kuluttaa nettomääräisesti 0,5/s. Keihään vahinkokerroin on 1,1.
  Samat stamina- ja asearvot koskevat sankaria ja vihollisia.
- **Riippuvuustarkistus:** 2026-11-20: ei mitään odottamassa. `bun audit` on puhdas ja
  `bun outdated --no-cache` ei listaa paketteja.
- Debug: kartalla `window.__map` (tila, `move`, `enterSite`, paluukuorma),
  3D:ssä `window.__game`. Selainpaneelin fokus voi pysäyttää 3D-pelin.

## Tunnetut rajoitteet ja riskit

- Sepän pajalla ei ole vielä omaa karttakuvaketta, vaan se käyttää pihan merkkiä. Työliikkeet ovat koodilla
  tehtyjä asentoja, eivät GLB-klippejä. Koiran assetissa ei ole kävelyklippiä, joten koira pysyy pihapaikassaan.
  Uuden kauppatuotteen lisääminen vaatii toistaiseksi myös sepän kahden takeMode-efektilistan laajentamisen.
- Karttavauhti, kylläisyys 3,6 pistettä/päivä ja uudet niityt kaipaavat pidempää pelitestiä.
  Pihaniitty voi liittyä valmiiseen aukeaan, jolloin aukea kokonaisuutena on yli yhdeksän ruutua.
  Tallennetut pihat jäävät paikoilleen myös tulevissa maastomuutoksissa.
- Liikkuvien ja väliaikaisten kohtaamisten luokitus on valmis; instanssilista, liikeradat ja poistumistilat puuttuvat.
- Jokigrafiikassa ei vielä haaroja, useita siltoja, koskia, venettä eikä vesianimaatiota.
- Keskushahmon paperinukkekuva ei kerrostu vaatekappale kerrallaan; toimiva varustetila näkyy
  sitä ympäröivissä ikonislotteissa. Hansikkailla ei vielä ole erillistä 3D-mesh-versiota eikä
  kengillä tai hansikkailla pelivaikutusta. Rauhassa kypärä on edelleen tarkoituksella pois päästä.
- Sukupuolivalinta vaihtaa 2D-kartan spriten, paperinuken ja kylläisyyskasvot
  sekä 3D-sankarin (jousineidon vartalo). Jousineito-NPC pihalla (vain `archer`-talossa) on
  jousen kanssa, joten naissankarin rinnalla on kaksi samannäköistä hahmoa.
- Jousineito v07.02: välilehden sulkeminen tai 3D-sivun uudelleenlataus ei ole "lähtö", joten neito säilyy
  silloin hengissä, eikä emäntä myöskään muista tapaamista (`<npc>.met`) (vain polunsuu ja valikon paluu kartalle lähettävät `npc.leftBehind`). Kuollut neito jää
  samalla käynnillä vuoteelle silmät auki (ei kuolinasentoa). Emännän "kuoli"-vastaus ei erottele, lauloiko
  pelaaja itse. Kukko ja istuva kana katolla: korkeus `COOP_ROOST` on yard.py:n mitoista, kaltevaa kattoa
  ei seurata.
- Emäntien pöytäruoka ei uusiudu (`takenInstanceIds` pysyvä), joten ruokaa saa kerran taloa kohden.
  Kalaonni on siemenestä ja kuunkierrosta, ei käyntikohtainen. Väen paikat on valittu käsin ja
  tarkistettu törmäysmaailmasta; pihan rakennusten siirto vaatii niiden tarkistuksen (`__world.yard.spots`).
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
  keihään kantama, usean vastustajan rytmi, etenevä nosto ja nuotion vahinko ovat arvioita.
  v07.01:n jälkeen ryhmät ovat vaarallisempia (aaltojen ja metsästysmaiden ryhmät viritettiin vuorottelulle),
  laulu katkeaa useammin, ja ryhmä uupuu samaan aikaan (yhteinen hiljainen jakso). Älä palauta id- tai
  järjestyspohjaista vuoroa: omistaja haluaa tilannepohjaisen katon.
- Louhen kahden kilpisoturin lähitaistelu on tarkoituksella vaarallinen: suojaamatta paikallaan seisova
  testihahmo kaatui noin kahdeksassa sekunnissa. Louhen 18 s:n laulun keskeytys, taistelulaulun rytmi ja
  vartijoiden lopullinen tasapaino tarvitsevat omistajan käsin pelattavan testin. Vartijat syntyivät
  savutestissä esteittä ja saapuivat Louhen takaa. Lumihiutalekarkotus puuttuu suunnitellusti.
- Torjunta ratkeaa yhä tilan (`block`) eikä asennon mukaan: hetken vielä nouseva asento torjuu. Keihäsmiehen
  hitaampi torjunta-animaatio (tulossa) tehdään suurentamalla `BLOCK_RAISE.spear`ia, joka hidastaa myös
  keihästä kantavaa sankaria; jos vain vihollisen pitää hidastua, erota arvot silloin.
- Rauhallisen pihan väki ei reagoi taisteluun. Eläinten ja kyläläisten
  mallikohtaiset avoimet asiat ovat `docs/BLENDER_HANDOFF.md`:ssä.
- Järven rannan vesi on yksinkertainen: ei rantavaahtoa, syvyysväriä eikä
  aaltoja laiturin kohdalla. Kaukorannalla ei ole kasvillisuutta kaukaa
  nähtynä; rantakohtauksen koira ei käyskentele (ei kävelyleikettä).
- **FPS:** omistajan mukaan peliläppärillä v06 on "siedettävä"; tarkkaa lukua ei ole. Laatuasetusta ei ole (pikselitiheys,
  MSAA 4×, hehku, 4096 px:n varjokartta). Vaihtokaistan pikselikuvio voi näkyä liikkeessä; kaukopuiden
  sävy on pikselimittauksella viritetty arvio. Instanssinippuja ei rajata näkökentän mukaan (kaikki
  etäisyyden sisällä piirretään). Aukioiden varvut ja heinät ovat yhä kiinteitä kehiä origon ympärillä.
- Polunsuun käytävä ei katso kohtauksen omia esteitä (esim. pihan aita portin vieressä); polku on
  piirretty vain maaston väriin. Aloitus on aina ensimmäisellä polunsuulla, ei sillä, jonka suunnasta
  kartalta tultiin. Metsästä tuleva vihollinen voi juuttua runkoon (12 s:n jälkeen hyppäys aukiolle).
  Viholliset eivät pakene polunsuista; sankarin pako ei muuta kampanjaa (aallot alkavat alusta).
- Metsästys: täydellä jännityksellä nuolen perä on vasemman korvan kohdalla; naissankarin kilpi peittää
  tähdätessä vasemman alakulman. Nuolet puissa yli 2,2 m:ssä menetetään. Jousi ei ole inventaarion esine,
  ruoanlaittoa ei ole. 3D-sivun uudelleenlataus toistaa apajan täydellä viinillä. Tiheällä kartalla apaja
  voi jäädä hiljaa syntymättä.
- Moottori on v0: ei ajastimia, `unless`-peruutusta eikä efektien ketjureaktioita.
  Tuntematon engine-versionumero luetaan sallivasti; semantiikkamuutos tarvitsee versionhaaran.
- Hylätty tallennus näkyy pelaajalle vain alapalkin viestinä, joka häviää ensimmäisestä liikkeestä. Talteen
  jää vain viimeisin hylätty. Palautustyökalua ei ole: matka palautetaan käsin `raw`-kentästä, kun vika
  on korjattu. Moottorilohkossa salliva luku vain pudottaa tuntemattoman.

## Seuraava tehtävä

**Väijytys, vaihe 2** (säännöt alla kohdassa Pysyvät päätökset): uusi taistelukohtaus `ambush` (`route.ts`
`SCENE_IDS`, `sceneLayout.ts`, `world.ts` `SITES`); polun suuntainen soikea aukio noin 30 × 18 m, metsä
ympärillä, 3–5 isoa puuta polun lähellä, `rock_3` noin 2,2-kertaisena lohkareena (kuten leirin uhrikivi),
polku läpi päästä päähän ja polunsuu kummassakin päässä; sankari saapuu tulosuunnan päästä. Kartalla
(`map/app.ts` `move`) arvonta tehdään vain onnistuneeseen siirtoon ilman `siteIdAt`-paikkaa; paluun
automaattinen askel ei arvo. Siemen kulkee tunnisteessa (`?site=ambush-<siemen>`), joten tallennusmuotoa ei
muuteta ja 3D:n uudelleenlataus tuo samat soturit. Joukon arvonta puhtaaksi moduuliksi testeineen
(`FighterLook`: `build`, `tunic`, `axe`, `ringMail`, `helmet`). Kohtaus ilman aaltoja (`skirmish.ts` mallina),
ruumiit eivät poistu (`WAVES.corpseTime`), kuolema kuten `huntDeathReturn` + ruokien menetys
(`ItemTag`/ruoat: lihat, kalat, rieskat). Omistajan v08.06.03-testi (selkäkilpi, seppä) on yhä tekemättä.

## Ei vielä aloiteta

- Louhen lumihiutalekarkotus, liikkuminen tai uudet kyvyt ennen v08.05:n omistajatestiä.
- Täysi karttaeditori ja sivujuonigeneraattori. Väijytyksen rantaversio vasta metsäpolun pelitestin jälkeen.
- Kaatuneiden soturien saalis ja pelaajan kirves (tulevat väijytyksen jälkeen).
- 3D-palkintojen tai ruokien lisääminen paluukuormasta inventaarioon.
- Yleinen quest-editori, laaja dialogipuu, ajastimet, `unless` ja kyläläisten vapaa liikkuminen.
- Sepän pajan uudet kauppatuotteet, koiran kävely tai uudet Blender-animaatiot ennen v08.06:n omistajatestiä.
- Inventaarion pudotus-UI ja pudotettujen esineiden 3D-instanssit.
- 3D-kohtausten mount/dispose ilman sivun uudelleenlatausta.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Isojen skannattujen puiden lataus ja kevennys.
- Kylä ja markkinat sekä vihollisten pako. Jousi ihmisvihollisia vastaan, hirvi (pakenee aina, verijälki
  valmiina sialla), muut riistalajit ja ruoanlaitto.
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
- Jousi on ensin metsästysase, myöhemmin myös taisteluun. Viinissä on 15 nuolta kohtausta kohti, ja se
  täyttyy automaattisesti kohtausten välillä; poistumalla täyttäminen sallitaan toistaiseksi. Ammutut
  nuolet saa poimia samassa kohtauksessa (2026-11-21).
- Jousi: oikea painike tähtää, vasen jännittää, tähdätään aina (ei lonkalta); jousi esiin/pois X,
  sidottavissa Esc-valikossa (2026-11-21).
- Villisika: 0–2 apajalla, osa pakenee ja osa ryntää; nuoli suututtaa; 3 nuolta kaataa; kilpi jää leiriin,
  joten väistetään tai lyödään. Haavoittunut pakenee useammin ja kauemmas ja jättää verijäljen. Kuolema
  apajalla palauttaa kartalle saaliin kanssa. X vaihtaa vaarassa jousen ja aseen (2026-11-22).
- Metsästysapajat: kertakäyttöisiä (kuluvat sisään mentäessä), uudella matkalla 2–4, 20 päivän välein
  yksi lisää ja enintään 4 (täynnä vanhin väistyy; 2026-11-23). Eivät koskaan valmiiksi näkyvissä: paljastuvat vasta
  viereisestä ruudusta, myös tutkitulla alueella, tai kun toisen talon emäntä neuvoo yhden (kerran
  kuunkierrossa, 2026-11-22); eivät toisen 3D-paikan viereen. Jäniksiä 7–9, joista 1–3 suolla ja 1–3
  paloaukealla (2026-11-21).
- Ukon siunaus (2026-11-22): +20 kestävyyden yläraja 15 päivää, kerran kuussa yhteensä molemmilla
  kalmistoilla; uhri (pala 3) vain avaa laulunopetuksen eikä anna buffia.
- Tietäjän mökki ja kaksi kalmistoa arvotaan uudella matkalla rannoille (2026-11-22). Kalmistot vain
  rannoille, kunnes kalmiston 3D-kohtauksesta on suo- ja vaaraversiot (järvi näkyy kohtauksessa).
- Jousineito (2026-11-22): parannus vaatii 6/8 osumaa, kolme yritystä; kuolee myös, jos ensimmäiseltä
  käynniltä lähdetään parantamatta. Huhun kertoo se emäntä, jolta ensin kysytään (2026-11-22). NPC-repliikeillä on
  vähintään kolme samaa tarkoittavaa muunnelmaa; uudet repliikit kirjoitetaan samoin.
- Emäntien ruoka (2026-11-22): pöydältä kysymättä otettu ruoka suututtaa sen talon emännän heti; kaksi
  jänislihaa lepyttää. Ruokaa pyydettäessä kalaonnen kuulla kalat annetaan, muuten yksi jänis antaa
  luvan ottaa rieskat ja kalat.
- Riista: alkuun pako 12 m:stä, mutta näkö ja kuulo pidetään erillisinä; jänis ei ole ainoa riista.
  Saalis poimitaan kaadetusta eläimestä lihana, joka on toistaiseksi syötävää (2026-11-21).
- Vertailukone on vanha peliläppäri (i5, 8 Gt, GTX 16 -sarja), mutta se on vain referenssi: omistaja
  pelaa ja kehittää tehokkaammalla koneella (2026-11-21).
- Väijytys (2026-11-26): 5 % jokaisella karttasiirrolla, joka ei pääty 3D-paikkaan; aluksi aina metsäpolku
  (myöhemmin ranta vesialueen laidalla). 1–3 Pohjan soturia (45/35/20 %) kerralla, ei aaltoja; vartalot vanha,
  tanakka ja hoikka, aseet miekka, kaksi kirvestä ja keihäs; ryhmässä enintään yksi kilpi ja yksi keihäs.
  Pako kumpaa tahansa polkua: eteenpäin jää kohderuutuun, taaksepäin palaa lähtöruutuun (aika kuluu, ei
  uutta arvontaa); väijytykseen ei voi palata. Kuolema palauttaa kartalle ja vie kaikki ruoat (lihat, kalat,
  rieskat). Kaatuneet pysyvät vain kohtauksen ajan; poistuessa niiden tuleva saalis katoaa.
- Kirves (2026-11-26): miekkaa lyhyempi, hitaampi ja raskaampi, ei pistoa, kuluttaa kilpeä enemmän.
