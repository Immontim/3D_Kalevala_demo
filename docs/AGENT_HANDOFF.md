# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-22 (Claude, Windows; pohja `origin/main` `614bcee`)

- **Koodiversio v07.04.00** branchissa `claude/yard-greetings` (tarkista merge-tila `git merge-base`illa).
  Koodi valmis, ei deployattu, omistaja ei ole testannut. Claude savutesti in-app-selaimessa (paneeli
  piilossa, ruudut `renderBench`illä, kuvakaappaukset): emännän paikat pöytä/nuotio/kanakoppi/sikolätti
  nähty kuvissa, kaikki ehdokaspaikat vapaita (`depenetrateDisc` ≤ 0,1 m väen ympyrät pois); `yard-b`:n
  emäntä kertoi huhun ja tervehti lähdön jälkeen "taas tapaamme"; aloitusnappi "Astu rannalle" /
  "Astu kalmistolle". Tarkistukset: `bun run test` 2114/2114, `bunx tsc --noEmit`, `bun run lint`,
  `bun run build`. v07.03–v06.08 ovat mainissa; niiden omistajatestit ovat yhä tekemättä.
- **Piha: jousineito, emännät ja eläimet (v07.02–v07.04).** Neito makaa `vuode`lla (`world.ts` `BED`);
  säännöt `content.ts`: `archer.healed` (`minHits` 6), `archer.heal-failed-*` → `archer.died-song` ja
  `archer.died-left` (`npc.leftBehind`, `engine/leave.ts`: polunsuu ja valikon paluu). Emännät tekee
  `housewifeDialogue(npc)` (`emanta` jousineidon talossa, `emanta_b` toisessa, `yardHousewifeId()`):
  kumpi tahansa kertoo huhun (`rumor.heard`, yksi yhteinen), sen jälkeen apajan kerran kuussa
  (yhteinen `emanta.huntTipMoon`). Tervehdys: `greetWounded` (neito haavoittunut), `greet`,
  `greetAgain` (`<npc>.met`), `greetHealer` (jousineidon talo + `archer.healed`); `meetingRules`:
  `npc.talked` → `<npc>.greeted`, `npc.leftBehind` + greeted → `<npc>.met`. **Ruoka (`householdFood`,
  `theftRule`):** varkaus → `<npc>.robbed` (2 jänistä lepyttää); `ask-food-fish` (`moonChance` 50 %) /
  `ask-food-meat` → `offer-hare` → rieskat ja kalat `allowed`. Pöytäesineet roolilla `@archerYard.` /
  `@otherYard.` (`world/instances.ts`). Paikat arvotaan joka käynnillä (`yardLife.ts` `pickSpot`,
  `planYardAnimals`): emäntä pöytä/pata/nuotio/sikolätti/kanakoppi, urho nuotio/pölkky/portti/lätti,
  aiemmin parannettu neito vuode/nuotio/portti/aitta (kesken käynnin parannettu nousee vuoteen viereen);
  koira 55 % emännän, 20 % pöydän luona. `__world.yard` (`people`, `spots`).
- **Ryhmän hyökkäyskatto ja vihun reaktiot (v07.01 + v06.05, `engine/ai.ts`, säännöt `combat.ts`).** Ei vuoroja:
  isku alkaa, jos muita windup/release-tilassa < `maxAttackers` 2; oma viive `attackStartDelay` 0,04–0,22 s,
  `startSpacing` 0,15 s; katon takia odottava `waitBack` + `waitHold`. `hitStaggers`: horjuva ei horjahda
  uudelleen; sankarilla `staggerImmunity` 0,4 s. `graceCovers`: torjunnan sektori ∩ ±40° torjutusta suunnasta.
  Uhattu (`threatenedBy`) torjuu viiveellä `blockReactionDelay`; `rollsAdvance` 45 % etenee noston aikana.
  Mitattu (3 vihua, 90 s): max 2 yhtä aikaa, aloitusväli ≥ 0,17 s. Hiljaiset jaksot = yhtäaikainen uupumus.
- **Metsästysapajat (v06.06, `map/huntGrounds.ts` puhdas).** Apaja = `SiteInstance` `kind: "hunt"` → `wilds`,
  kertakäyttöinen (`enterSite` → `removeHuntGround`). `huntCycle` (20 päivän jakso; −1 = vanha tallennus →
  `ensureHuntGrounds` 3–6 alkuapajaa); `advanceHuntGrounds` lisää jaksoittain, enintään 6 (vanhin pois myös
  `knownSiteIds`ista). `huntCandidates`: Chebyshev ≥ 2 muista paikoista ja sankarista; näkyy vasta 3 × 3 -näössä.
- **Väistöaskel ja kävely (v06.07, `src/sidestep.ts` puhdas).** `dodgeDirection(A, D, S)` (eteenpäin-osa pois),
  `sidestepPose(u)`: johtava jalka 0–0,5, perässä tuleva 0,5–1, ei koskaan molemmat ilmassa. Haara-asentoa ei
  voi kaventaa kesken askeleen ilman liukua. Kävely `GAIT.walkNarrow*`/`standNarrow`. Arvioija hylkäsi
  kävelyn polvikyykyn ja taka-askeleen kyykyn (istuva ilme): älä palauta niitä.
- **Metsästys (v06.04, `src/hunt/` puhdas + `engine/hunt.ts`).** Vain `HUNTING` = erämaa. `bow` (X), vasen
  jännittää, oikea tähtää/poimii. `ARCHERY`, `traceSegment` (maa + `firstProjectileHit` + eläinpallot),
  `SPECIES.hare`, `pickHareSpots` 7–9 jänistä. Viini ja saalis moduulin tilaa; mallit `hunt/models.ts`.
- **Tallennuksen hylkäys (v06.03.01).** Kelvoton tallennus kopioidaan avaimelle `laulun-miekka.campaign.rejected`
  ja kartta näyttää `map.saveRejected`; lataus on tarkoituksella tiukka, jotta vika näkyy.
- **Saapuminen ja aallot (v06.02).** `sceneLayout.entrySpawn` (`ENTRY_INSET` 3,5 m, pihat 6,4) ja
  `approachSpawns` (vastakkaiselta puolelta; `ai.arriveUntil` 12 s ohittaa alueen rajauksen).
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
- **Paperinukke ja inventaario.** Skeema 7 (`laulun-miekka.campaign.v7`): kuusi peruspaikkaa, reppupaikka ja
  repusta 0–12 lisäpaikkaa (`ItemDefinition.storageCapacity`; tuohikontti 6), seitsemän varustepaikkaa.
  Vanhan tallennuksen ylivuoto säilyy. Kartta ja 3D:n pause (`B`) käyttävät `ui/inventoryView.ts`:ää;
  taistelussa vain luku. Ase- ja kilpivaihdot ovat atomisia; pääkättä ei voi jättää tyhjäksi.
- **3D-varusteet ja suoja.** Mies- ja naissankari käyttävät Clauden modulaarisia base/mail/greaves/
  shoes-solmuja ja Taivaanrautamiekka omaa `sword_sky_iron`-malliaan. Rengaspaita kertoo vahingon
  0,85:llä, säärisuojat 0,95:llä. Vain ylälyönti voi irrottaa kypärän; silloin koko isku torjutaan.
  Sama sääntö on pelaajalla ja vihollisilla. Tarkat arvot ovat `combat.ts`in `ARMOUR`-vakiossa.
- **Leirin aallot ja voitto (V7).** `src/waves.ts`: `CAMPAIGN_WAVES` 5 kiinteää aaltoa (9 vihollista),
  **vastustajat perusarvoissa**, vain tekoäly paranee (`aiLevelForWave`). Viimeinen aalto → `battle.won` →
  `campaign.victory` (`recordVictory`). Kaatuminen → `player.deaths`. Debug: `killEnemies()`, `skipTo(1..5)`.
- **Loppuruutu** (`map/ending.ts` puhdas, `map/app.ts` `#mapEnding`): näkyy kartalla voiton jälkeen kerran
  (päivät, tutkittu %, laulut, kukistetut, kaatumiset, luvattomat otot, sivupolut); "Jatka vaellusta"
  asettaa `campaign.endSeen`, asetuksista voi katsoa uudelleen. Päivät ja kartta jäädytetään voittoon.
- **V6 ja leirin arvonta (mergattu).** Leiri on instanssi `camp` (`placement.ts` `CAMP_PLACEMENT`: reunakaista,
  >= 8 ruutua aloituksesta, <= 600 min, lukossa lipulla `louhi.banished`). Jousineito on `archer`-pihassa
  (v07.02 yllä); dialogista `sky_iron_sword` (vahinko 1,3; oma GLB-malli). Tietäjä vain rannalla, nuori urho
  `archer`-vapaassa pihassa.
- **Louhen karkotus (V5, mergattu).** Pohjolan uni <= 6 m (`SONG_AUDIENCE_RANGE`) Louhesta
  kalmistolla: `endSong` lähettää `song.performed` (cast, `nearNpcId`); sääntö `louhi.banished`
  asettaa lipun, `revealSite` ja `removeNpc` (`world.removeNpc`: `vanishVillager`,
  `CollisionWorld.disable`, `removeTalkable`). Pysyvyys: `cairnState.louhiBanished` lipusta.
  Lukitut paikat: `MapSiteDefinition.requiresFlag`, `siteUnlocked`. Esc-oikotie `clearing`iin
  on kehittäjälle auki.
- **Laulun tauot ja säekaaret (v06.08).** `songLogic.songBeats`: ryhmän (`SONG.pairSize`) jälkeen arvottu
  tauko; painallus tauolla on huti (tarkoituksella). `engine/songArcs.ts`: säkeet SVG-kaarille sankarin ylle
  (`revealVerse`, `fadeSongArcs`, `clearSongArcs`); `#verse` vain opetuksessa. `__game.songArcs`.
- **Suon vahinko (v06.09).** `songOutcome.dotPerSec` (> 0, kun onnistunut ja osumia ≥ `SONG.bogDotMinHits` 3)
  → `endSong` asettaa `Actor.bogDot`; `melee.updateCombatant` (tila `rooted`) → `stepBogDot` tikeittäin
  (`bogDotInterval` 1 s, vajaa loppu pienempänä tikkinä), ohi haarniskan ja `rootedDamage`n, `killActor`
  nollassa. `Actor.dotPulse` kasvaa tikistä; `hud.pulseOnDot` välähdyttää `#ehp`:n palkin ja `.foe`-palkin.
- **Laulun opettelu (V4, mergattu).** Laulu **Pohjolan uni** (`SONGS.sleep`, Kalevala runo 42).
  Tietäjän dialogi -> efekti `startSongLesson` (`OutAction`) -> `engine/song.ts` `startLesson`
  (ei hidastusta, säe näkyy etukäteen) -> `song.performed` -> lippu `song.sleep.learned` (raja
  `SONG.minHits` 4/8, epäonnistuminen ei rankaise). `songLogic.songSlots(flags)`: laulu paikkaan F3.
- **Satunnaiset pihapiirit.** `map/siteInstances.ts` tallentaa siemenen ja paikat (`yard`/`yard-b`).
  `yardMeadows.ts` kasvattaa taloruudusta 3–9 sivuttain kiinni olevaa niittyruutua viiden ruudun
  levyisellä alueella. Metsät ja nykyinen niitty käyvät, ranta ja muut paikat rajaavat kasvua.
  `map/app.ts` johtaa saman kartan piirtoon ja liikkeeseen tallennusta avatessa ja matkaa aloittaessa.
  Kartta välittää `?site=<id>` 3D:lle. Jousineito kuuluu `archer`-pihaan.
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
- **Kalmisto `cairnfield`** (friendly; Esc-oikotie, aloitusvalikko, `?scene=cairnfield`, karttapaikka ruutu
  16,16). `world.ts`: `CAIRN`-lippu; `LAKE` = `LAKESIDE || CAIRN` (vesi, kaukoranta, rantakaista). Maasto on
  kallionokka (`terrainHeight`, `shoreZ` z ≈ 21). Sijoittelu vakioina `world.ts`:n alussa (`CUPSTONE`,
  `CAIRNS_AT`, `KARSIKKO`, `LOUHI_AT`, `DARK_SOIL`). Louhi `populateCairnLife`issa, ääni `Sfx.birds`.
  Törmäyksiä vasten kävelyä ja ääntä ei ole tarkistettu.
- **Taisteluvaraukset (Louhi suohon):** kuppikiven ympärillä on noin 5 m:n vapaa alue ja suoloitsun efekti
  (`bog`). Puuttuu vihollistyyppi `louhi`, taistelumalli ja animaatiot sekä `Encounter` kalmiston taisteluun.
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
- **Dev-palvelin työpuusta:** Clauden `preview_start` lukee sen kansion `.claude/launch.json`in, josta sessio
  alkoi. Jos sessio alkoi pääkansiosta, "dev" palvelee pääkansion koodia: tarkista `fetch('/src/…')`illa ja
  lisää tarvittaessa väliaikainen konfiguraatio `bun x vite <työpuun polku> --port …` (palauta tiedosto lopuksi).
  Testipeli: `?scene=clearing` ja aloitusvalikon "Aloita" ennen `__game.tick`iä (muuten `g.running` on false). Piilotettu paneeli hidastaa rAF:n ~3 FPS:iin: aja peliä
  `__game.step(n)`illä ja mittaa piirto `__game.renderBench()`illä. Moduulin tuonti konsolista: käytä
  sivun latausten (`performance.getEntriesByType("resource")`) `?t=`-osoitetta, muuten saat erillisen kopion.
- **Laulun tahmaus heikolla koneella:** CSS-suotimen siirto shaderiin (v05.00.01) on yhä vahvistamatta.
  Säekaarten hehku on CSS `drop-shadow` kahdeksalla tekstillä (v06.08); jos laulu tahmaa, poista ensin
  `verseGlow`-animaatio. Opetuksen (tietäjä) kaaripolkua ei ajettu selaimessa, vain koodina.
- **Sovellusrakenne.** URL ilman `scene`-parametria käynnistää 2D-kartan;
  `?scene=<id>&return=map` lataa dynaamisesti `src/scene3d.ts`:n ja Three.js-
  moottorin. Kartta ei pyydä GLB-tiedostoja eikä aja 3D-silmukkaa.
- **2D-maailmankartta** (`src/map/app.ts`) on Canvas 2D -näkymä: 20 × 20
  ruudun maailma, 48 × 48 px:n tiilet ja 17 × 13 ruudun kamera
  (816 × 624 px). Näkyvyys: ks. Pysyvät päätökset. WASD/nuolet liikuttavat vain
  neljään pääilmansuuntaan.
- **Karttadata ja säännöt** ovat puhtaassa `src/map/domain.ts`:ssä. Kuusi
  aiempaa maastoa (niitty, metsä, umpimetsä, suo, kallio ja vesi) sekä uusi
  joki. Kohderuudun `minuteCost` lisää maailmanaikaa; estynyt liike ei kuluta
  aikaa. Ainoa kuljettava vesiruutu on pohjois–eteläsuuntainen puusilta (13,11),
  joka piirretään jokitiilen päälle `bridgeArt.ts`:ssä. Pohjoisen metsässä on yhden ja
  kolmen ruudun niityt. Keskustan metsikkö pilkkoo perusniittyä.
- **Aika ja kylläisyys.** Erillistä karttavoimaa ei ole. Piilotettu `worldMinutes` sallii päivän
  murto-osat; vanhojen tallennusten jo kertynyt aika, 180 yksikön kuunkierto ja 28 päivää säilyvät.
  Kohderuudun kulku: niitty 1/6 päivää, metsä 1/4, umpimetsä 1/3, kallio 1/2, suo 0,7 ja silta
  0,4 päivää. Kylläisyys vähenee 3,6 pistettä päivässä (niittyliike 0,6); 100 → 0 kestää noin 28
  päivää ilman ruokaa. Arvo ei tapa tai estä liikkumista. Kuun kuva näyttää kahdeksan vaihetta;
  tavallinen liike ei näytä kustannusta. Viisi numerotonta kasvokuvaa 20 pisteen portain.
- **Kampanjatallennus** (`campaign.ts`, `storage.ts`) käyttää skeemaa 7 ja avainta
  `laulun-miekka.campaign.v7`. V1–v6 migroidaan;
  kelvollinen vanha tila palautetaan myös, jos migraation kirjoitus estyy. **Uusi aikakenttä tarkistetaan
  `validWorldTime`illa**, ei kokonaislukuna (kartan aika on murtolukuja).
- **Matkan asetukset.** Esc-dialogissa ovat FI/GB-kieli, sukupuoli, vahvistettava uudelleenaloitus
  ja 3D-oikotiet kohtaustyyppeineen.
- **Paikat.** `sites.ts` omistaa liikkumisen, elinkaaren, sijainnin ja `sceneId`-kytkennän; nykyiset
  ovat `fixed+persistent`, ja kaksi pihainstanssia käyttää samaa 3D-sceneä.
- **2D↔3D-sillat.** `transition.ts` vähentää nälkäisessä taistelussa HP- ja staminakattoa 20,
  nääntyneenä 40; vaikutus on idempotentti eikä koske ystävällisiä kohtauksia. Paluukuorma
  `laulun-miekka.scene-return.v1` kulutetaan kerran; `rewards` on vielä tyhjä varaus.
- **Karttagrafiikka ja sankari.** `kalevala-map-atlas-v2.png` sisältää kaksi terrainvariaatiota
  ja naapureista kierrettävät jokipalat. 48 px:n `lake-shore-edge.png` pyöristää rannat.
  Naisella ovat `paper-doll-hero.png`, `satiety-faces.png` ja nelisuuntainen
  `map-hero-female.png`; sininen viitta erottaa hänet kartalla. Miehellä ovat
  `paper-doll-hero-male.png`, `satiety-faces-male.png` ja atlaksen nykyiset
  neljä sankariruutua. Valinta vaihtaa kaikki kolme 2D-esitystä heti.
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

- Karttavauhti, kylläisyys 3,6 pistettä/päivä ja uudet niityt kaipaavat pidempää pelitestiä.
  Pihaniitty voi liittyä valmiiseen aukeaan, jolloin aukea kokonaisuutena on yli yhdeksän ruutua.
  Tallennetut pihat jäävät paikoilleen myös tulevissa maastomuutoksissa.
- Liikkuvien ja väliaikaisten kohtaamisten luokitus sekä piirron piilotussääntö
  ovat valmiina, mutta niiden instanssilistaa, liikeratoja tai poistumistiloja
  ei ole vielä toteutettu.
- Jokigrafiikka tukee suoria, kaarteita, päitä ja yhtä siltaa, mutta ei
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

Lisää paperinuken alle referenssikuvan mukaiset kolme pitkäkestoisen efektin paikkaa omana
rajattuna työnään. Tässä branchissa ei ole efektien tilamallia, kuvakkeita eikä toimintaa.

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
- Kylä ja markkinat sekä vihollisten pako. Jousi taisteluaseena (vasta metsästyksen palautteen jälkeen),
  uudet riistalajit ja ruoanlaitto.
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
- Metsästysapajat: kertakäyttöisiä (kuluvat sisään mentäessä), uudella matkalla 3–6, 20 päivän välein
  yksi lisää ja enintään 6 (täynnä vanhin väistyy). Eivät koskaan valmiiksi näkyvissä: paljastuvat vasta
  viereisestä ruudusta, myös tutkitulla alueella, tai kun toisen talon emäntä neuvoo yhden (kerran
  kuunkierrossa, 2026-11-22); eivät toisen 3D-paikan viereen. Jäniksiä 7–9, joista 1–3 suolla ja 1–3
  paloaukealla (2026-11-21).
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
