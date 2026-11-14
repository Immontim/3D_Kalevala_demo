# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-14 (Claude, kotikone, Windows)

- **Versio v01.00.00**, branch `claude/engine-split` (tarkista merge-tila
  `git merge-base --is-ancestor`). Mainissa on v00.18.00.
- **Rakenne.** `src/engine/` on kohtaus- ja taistelumoottori, `src/ui/` sivun
  ikkunat (aloitus, tauko, säätö), `src/main.ts` vain käynnistys ja
  `src/debug.ts` savutestien `__game`. Säännöt ja luvut ovat yhä puhtaissa
  moduuleissa (`combat.ts`, `stats.ts`, `songLogic.ts`, `tuning.ts`).
  Moottorin osat: `state.ts` (yhteinen tila `g`, `aim`, `inputs`, `fx`),
  `view.ts` (piirto), `actor.ts`, `hero.ts` (sankari ja ohjaus),
  `enemies.ts`, `ai.ts`, `melee.ts`, `animate.ts`, `camera.ts`, `song.ts`,
  `hud.ts`, `effects.ts`, `input.ts`, `loop.ts` (pääsilmukka, tauko).
  Moduulit eivät tee mitään ladattaessa: `main.ts` kutsuu `init…`-funktiot
  järjestyksessä. Tila on moduulitasolla, eli yksi moottori sivua kohti.
- **Vastustajat ovat lista** `g.enemies` (vain elossa olevat; kaatunut
  siirtyy heti `g.corpses`iin, `enemyDown`). Jokaisella on oma `Actor.ai`,
  `level` ja `name`. `lockTarget()` pitää kohteen `aim.target` ja vaihtaa
  kaatuneen tilalle lähimmän; `focusEnemy()` (lukittu tai lähin) on
  mittarien ja laulun kohde. Sankarin isku osuu yhteen: lukittuun tai
  lähimpään ulottuvilla olevaan (`melee.ts` `strikeTarget`).
- **Kohtaus** (`engine/encounter.ts` `Encounter`: `start`, `update`,
  `onEnemyDown`) päättää, keitä kentälle tuodaan (`addEnemy`). Moottori ei
  tiedä aalloista: aaltotaistelu on `skirmish.ts`, tyhjä kohtaus `peace`.
  Vaihto `startEncounter()`. Tuleva RPG-kerros kutsuu moottoria tätä kautta.
- **Tukiaskel ja osumahetki** (`COMBAT.strikePoint`, `lungeProgress`,
  `strikeLands`; `melee.ts` `updateCombatant`): lyöjä astuu `lunge` metriä
  eteen, ja isku ratkeaa `strikePoint` (0,7) × release kohdalla. Kantama
  mitataan askeleen lähtöpaikasta (`Actor.stepFrom`). Vihollisen terän
  kärjen välähdys (`Fighter.setGlow`) näkyy hahmojen läpi.
- **Sankarin varusteet** valitaan aloitusikkunassa (`hero.ts` `LOADOUTS`).
- **Vapaa kääntyminen** (`aim.yaw`/`aim.pitch`, luvut `controls.ts`):
  hiiri kääntää katsetta, sankari kääntyy sitä kohti nopeudella
  `Stats.turnSpeed`, WASD liikkuu katseen suhteen. Lukitus (Tab /
  keskinappi) on kytkin `aim.lockOn`.
- **Vastustajan kääntyminen** (`updateAi`): kohti `ai.seen`ia, joka seuraa
  pelaajaa `Stats.reaction` jäljessä; iskun aikana kertoimella
  `ENEMY_AI.attackTurnScale`. `pickEnemyAttack` ei aloita iskua, jos
  pelaaja on yli 0,9 × iskun kaaren sivussa.
- **Torjuntasektorit** (`WEAPONS.*.blockArc` π/4 = ±45°,
  `SHIELDS.round.blockArc` π/3 = ±60°; omistajan päätös 2026-11-14).
- **Kaksi taistelupaikkaa** (`src/world.ts`): `ARENA` on tällä latauksella
  käytössä oleva paikka (`"clearing"` = nuotioaukio, `"homestead"` =
  pihapiiri), luettu avaimesta `laulun-miekka.arena.v1`. Maailma
  rakennetaan kerran moduulin latautuessa, joten aloitusikkunan valinta
  (`#arenaPick`, `ui/startMenu.ts`) kutsuu `saveArena()` ja lataa sivun uudelleen.
  Paikkojen erot ovat taulukossa `SITES` (tasaisen alueen säde, puiden
  ja varvikon raja, tallattu maa, nuotion paikka, rakennusten pohjat
  `footprints`, kameran raja `camMaxR`). Metsä, valo ja taistelukehä
  (`ARENA_RADIUS` 11) ovat yhteiset, ja nuotioaukio on ennallaan.
  **Uusi paikka:** lisää `ArenaId`, rivi `ARENAS`iin ja `SITES`iin sekä
  sijoittelu `populate`n loppuun.
- **Pihapiiri** (malli `assets/homestead.glb`, skripti
  `assets-src/blender/homestead.py` → `build_homestead()` tyhjässä
  tiedostossa): `talo`, `kuoppatalo`, `aitta`, `katos`, `aita` (2 m pätkä,
  instansseina kehällä `FENCE_R`), `portinpieli`, `pino`, `polkky`,
  `haasia`, `ruukku`. Rakennukset ovat kehällä taistelukehän ulkopuolella
  (`onRing(kulma, etäisyys, ...)`), etusivu keskelle. Kuoppatalon
  kulkukuilu leikataan maastoon shaderilla (`PIT_HOLE`, `uHole*`), ja
  kuilun pohja ja seinät ovat mallissa; luvut on pidettävä samoina
  skriptissä ja `world.ts`:ssä. Rakennuksiin ei voi törmätä, joten
  kamera pidetään säteen `camMaxR` 12,2 sisällä (`World.clearCamera`).
  Materiaalien sävyt viritetään pelin valoon `prepareMaterials`issa.
  Skripti ajettiin taustalla (`blender --background --factory-startup
  --python`), koska Blender MCP:n taustatyökalu ei löydä Blenderiä
  (`BLENDER_PATH` puuttuu) ja avoimessa Blenderissä oli tallentamaton
  `characters.blend`.
- **Mittarit** (`ui/pauseMenu.ts` `meterOff`, `placeMeters`): tauolla raahattavat,
  siirtymä tallentuu avaimeen `laulun-miekka.meters.v1`.
- **Laulut ja valinta** (`src/songLogic.ts`: `SONGS`, `SONG_SLOTS`; kulku
  `engine/song.ts`): laulunappi täydellä voimalla → `openChoice()`:
  `choosing` pysäyttää maailman (dt = 0), hiiri vapautetaan
  (`g.choiceUnlock` estää automaattisen tauon) ja viisi laulupaikkaa
  asetellaan hahmon ympärille. Valinta pikanäppäimellä (`song1`–`song5`,
  oletus F1–F5) tai napsauttamalla → `startSong(id)`; laulunappi uudestaan
  peruu ja voima säilyy. Vastustajaa tarvitseva laulu (`needsEnemy`) ei
  valikoidu ilman sitä. **Uusi laulu:** `SongId`, rivi `SONGS`iin, paikka
  `SONG_SLOTS`iin, väri `.slot.<id>` ja vaikutus `judge`/`endSong`iin.
  Parannuslaulu antaa `SONG.healPerHit` (5) elämää heti osumasta.
- **Kilven asento** (`src/fighter.ts`): `shieldHang` 0..1 kääntää kilven
  torjunnasta (`SHIELD_FRONT`) roikkumaan kyljelle (`SHIELD_HANG_YAW`).
- **Askellus ja elävyys** (`src/fighter.ts`, taulukko `GAIT`): nopeus
  mitataan `root`in todellisesta siirtymästä, ja `apply` ratkaisee jalkojen
  kulmat jalan paikasta, joten maassa oleva jalka ei liu'u. `animate`n
  `moveSpeed` kertoo, onko liike kävelyä: iskun työntö ja väistö eivät
  askella. Mittari: `__game.feet`.
- **Kaatuminen** (`src/fighter.ts`, taulukko `FALLEN`, `Fighter.fall`,
  `dropGear()`; valinta `engine/melee.ts` `fallDown()`). **Päätös:** kaatuneet
  tehdään luurangolla, ei omina malleina. Savutestissä
  `__game.fallShowcase(n)`.
- **Kaikki pelin luvut ovat parametritaulukoissa**, eikä uusia lukuja
  kovakoodata moottoriin:
  - `src/combat.ts`: `CHARACTERS` (hahmon hp, stamina, staminaRegen, power,
    moveSpeed; vastustajilla aallon 0 arvot), `WAVES` (kasvu per aalto,
    pelaajan lepo, aaltojen väli), `STAMINA` (hinnat), `COMBAT` (ajat ja
    kertoimet, mm. `windupScale`, `recoveryScale`, `parryWindow`, laulun
    voiman kertyminen), `ENEMY_AI` (torjunta- ja lukutodennäköisyydet,
    etäisyydet, lepo, kääntyminen), `STRIKES`, `WEAPONS`, `SHIELDS`.
  - `src/songLogic.ts`: `SONG` (nopeus, välit, alueet, vaaditut osumat,
    suon kesto). Johdetut arvot funktioina `beatGap()`, `songLead()`.
- **Hahmon kyvyt** (`src/stats.ts`, testit `tuning.test.ts`):
  `baseStats(hahmo, aalto)` → `Stats` (maxHp, maxStamina, staminaRegen,
  power, moveSpeed, damageTaken). `Actor.mods` on lista vaikutuksia
  (`Modifier`: id, stat, add/mul, until = pelin aika), ja
  `effectiveStats` laskee `Actor.stats`in joka ruutu. **Ruoka, nälkä,
  loitsut ja esineet tehdään lisäämällä muunnin** (`withModifier`), ei
  muuttamalla taistelukoodia. Pelissä ei vielä ole yhtään muunninta;
  savutestissä `__game.addModifier("player", {...})`.
- **Säätö** (`src/tuning.ts`, käyttöliittymä `ui/pauseMenu.ts` kohdassa
  "Säätövälilehti"): jokainen taulukon luku on säädettävissä polulla
  (esim. `weapons.spear.reach`). `FIELDS` listaa taukoikkunan 31 kenttää
  rajoineen; muut polut voi muuttaa JSON-tekstin kautta. Malli: luonnos →
  "Ota käyttöön ja aloita alusta" → `applyChanges` + `restart()`.
  Tallennus `localStorage`-avaimeen `laulun-miekka.tuning.v1`, ja arvot
  otetaan käyttöön ennen hahmojen luontia. Vientimuoto:
  `{ peli, versio, muutokset: { ...vain poikkeavat arvot puuna } }`.
  **Kun omistaja liittää JSONin keskusteluun, sen arvot kirjoitetaan
  taulukoiden oletuksiksi** ja omistaja palauttaa säätönsä oletuksiin.
- **Laulun rytmipeli** (`src/songLogic.ts`, luvut taulukossa `SONG`; kulku
  `engine/song.ts`): maailma hidastuu (`slowmo` 1/15), `intro` 0,6 s, sitten
  riimu jokaista säettä kohti (8), kunkin alla osuma-alue (`zoneFirst`
  0,24, seuraava aina `zoneShrink` 0,84 × edellinen). Vaikeutta säädetään
  ensisijaisesti nauhan nopeudesta `speed` (1,5). Suolaulu laukeaa
  `minHits` 4 osumalla; kesto on osumat × `rootTimePerHit` 0,75 s.
  Vastustajan osuma katkaisee laulun (`interruptSong()`). Voima nollataan
  laulun alussa. Tauko pysäyttää myös riimut.
- **Keihäsote** (`src/fighter.ts`, `SPEAR_HOLD`, `holdShaft()` + `twoBone()`):
  kädet viedään varrelle käänteiskinematiikalla; otekanava `grip_carve`
  (`char_build.py`, koodissa `GRIP_CHANNEL`). Mittari `fighter.spearGripDebug()`.
- **Suo** (`src/bog.ts`, malli `assets/bog.glb`, skripti
  `assets-src/blender/bog.py`): mutapinta, sammalreunus ja kuplan malli
  tulevat Blenderistä ilman tekstuureja; pinnat tehdään maaston
  tekstuureista (`World.groundTex`) ja heinätupsut metsän malleista
  (`World.proto`). Mudan vellonta, kuplat ja puhkeamisrenkaat lasketaan
  koodissa joka ruutu (529 verteksiä). Luvut taulukossa `BOG`. Suohon
  juuttunutta vastustajaa ei voi enää työntää paikaltaan.
- **Taistelusäännöt ovat parametritaulukoita** tiedostossa `src/combat.ts`
  (puhdasta logiikkaa, testit vieressä):
  - `STRIKES`: iskusuunta (`overhead`, `slash`, `thrust`) × paino (`light`,
    `heavy`): ajoitus, kantama, kaari, vahinkokerroin, askel, kilven kulutus.
  - `WEAPONS`: miekka ja keihäs: vahinkokerroin (laatu), ulottuma,
    minimikantama, hitaus, sallitut iskusuunnat kertoimineen, torjuntakaari.
  - `SHIELDS`: kesto 10, torjuntakaari, loven raja 0,5. `BASH`: kilpityöntö.
  - `makeAttack(ase, suunta, paino)` yhdistää nämä. Vahinko =
    lyöjän voima (`Actor.stats.power`) × ase × isku. Uusi aselaatu on uusi rivi
    `WEAPONS`-taulukkoon; hajontaa ei vielä ole.
- **Säännöt:** kilpi torjuu kaikki iskut ja kuluu (kevyt 1, raskas 2;
  täydellinen torjunta ei kuluta). Aseella torjunta onnistuu vain, jos
  torjunta-asento vastaa iskun suuntaa. Kilpityöntö murtaa asetorjunnan,
  mutta kilpeen se vain osuu. Raskas isku ei enää murra torjuntaa.
- **Kilven hajoaminen** (`src/fighter.ts`): lovi ja sirpaleet tehdään
  shaderilla kilven materiaaliin (`patchShield`, `ShieldDebris`), ei omilla
  malleilla. Pelaaja saa uuden kilven jokaiseen aaltoon.
- **Tekoäly** (`pickEnemyAttack`, `src/engine/ai.ts`): arpoo iskusuunnan ja
  painon varustuksen mukaan, lyö raskaasti kilven takana seisovaa pelaajaa,
  ja aseella torjuessaan arvaa suunnan oikein sitä useammin, mitä pidemmällä
  aalloissa ollaan. Keihäällä voi vain pistää.
- **Blender-putket:** metsä `assets-src/blender/build_all.py`, hahmot
  `char_all.py` → `run_chars()`, suo `bog.py` → `build_bog()`, pihapiiri
  `homestead.py` → `build_homestead()` (kaksi viimeistä tyhjässä
  tiedostossa; suon vienti samassa kutsussa tiedoston avauksen kanssa
  kaatuu). Lähteet: `tools/fetch-polyhaven.ps1`,
  `tools/fetch-characters.ps1` ja `tools/fetch-homestead.ps1`
  (PowerShell-skriptien ajo on kotikoneella estetty: tiedostot haettiin
  samoista osoitteista käsin). `.blend`-tiedostot eivät ole Gitissä, eikä
  lähdemallien tuontia SRC-kokoelmaan ole skriptattu. `homestead.py`
  tarvitsee metsäputken tekemän `assets-src/textures/birch_bark_diff.png`n.
- **Deployattu:** GitHub Pages julkaisee mainin heti mergen jälkeen
  (Actions-ajo "Julkaise GitHub Pagesiin"); v00.10.00 ja v00.11.00 eivät
  ole mainissa. **Omistaja testaa julkaistusta osoitteesta**, ei
  dev-serveriltä.
- **Käsin testattu 2026-11-14** (in-app browser, skriptattu syöte): aallot
  1–3 läpi, laulun valinta, tyhjä kohtaus (`__game.encounter("peace")`:
  kävely, isku ilmaan, lukitus, suolaulu pois käytöstä), kaksi vastustajaa
  (`__game.addEnemy`): molemmat hyökkäävät, lukitus siirtyy, seuraava aalto
  vasta molempien kaaduttua; ei konsolivirheitä. **Ei testattu:** oikea
  hiiri ja näppäimistö jaon jälkeen, tauko- ja säätöikkuna käsin.
  Aiemmista yhä kokeilematta: buildattu versio, hitaampi kone, hiiren
  lukitus laulun valinnassa, kaatuneet kaltevalla maalla.
- **Komennot 2026-11-14:** `bun run test` (69/69), `bun run lint`,
  `bun run build` ok.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- Savutestien apuna `window.__game`: `tick(n, dt)` ajaa peliä askelin
  ruudunpäivityksestä riippumatta, `skipTo(n)`, `showcase(true, "asento")`,
  `poses` (asentojen säätö lennossa), `setCamera(pos, look)`, `state`,
  `events` muodossa `kuka:isku/paino:tulos`, `fillSong()`, `beat()`
  (välilyönti laululle), `nextBeatIn`, `bog([x,0,z])` (suo näkyviin),
  `debrisHeights` (irtokappaleiden korkeus maasta), `root(t)` (vastustaja
  suohon), `setStamina(pelaaja, vastustaja)`, `addModifier(kuka, muunnin)`,
  `stats`, `tuning`, `placePlayer(x, z)`, `showcaseReach` (aseen kärjen etäisyys),
  `look`, `setLook(yaw, pitch)`, `setLock(bool)`. Selainpaneeli pysäyttää
  pelin, kun se menettää fokuksen: kutsu `autoPause(false)` jokaisen
  latauksen jälkeen. `skipTo` rakentaa hahmon vasta seuraavalla
  kierroksella, joten `knockHelmet()` vaatii erillisen kutsun tai odotuksen.

## Tunnetut rajoitteet ja riskit

- **Tasapainoa ei ole pelitestattu.** Kaikki luvut ovat arvauksia.
  Suuntatorjunta ilman kilpeä voi olla liian vaikea: iskun suunta pitää
  lukea vastustajan asennosta tai HUD-vihjeestä noin puolessa sekunnissa.
- **Kestävyyden tasapaino on arvaus.** Palautuminen 1/s on hidas
  suhteessa hintoihin: vastustaja lyö noin 2,5 s välein, joten sen kevyet
  lyönnit lähes maksavat itsensä takaisin, ja kestävyys rajoittaa lähinnä
  raskaita lyöntejä ja torjuntaa. Vastustajan täydellistä torjuntaa ei ole,
  joten pelaaja ei voi kuluttaa sen kestävyyttä muuten kuin lyömällä
  torjuntaan (2 per torjunta).
- **Askellus:** paikallaan kääntyvä hahmo ei ota askelia (jalat kiertyvät
  vartalon mukana). Sivuttaisliike on pelin nopeudella (3,4 m/s) tiheää
  askellusta, koska nopeus on sivulle epärealistisen suuri. Ei
  lentovaihetta juoksussa. Kilpikäsi ja asekäsi eivät heilu askeleen
  tahdissa.
- **Keihäällä on vain pisto**, joten sitä vastaan riittää pistotorjunta.
  Keihään kantama (3,5 m kevyt, 3,6 m raskas) on mitoitettu mallista samalla
  pelivaralla kuin miekan: kärki pistossa 1,9 m + syöksy 0,6 m + 0,95 m.
  Pelivara on iso (osuma ratkeaa iskun alussa, ennen syöksyä), joten
  kantaman reunalla osuma voi näyttää ilmaan osuvalta. Alle 1,3 m:n päässä
  keihäs ei osu lainkaan: iholle juokseva pelaaja on turvassa.
- **Keihäsotteen avoimet viat:** sormet ovat lähdemallissa erillään, joten
  ote harittaa läheltä (ei sormiluita); kämmenen kierto näkyy kyynärvarren
  hihassa; pistossa etukäsi on ulottuvuutensa rajalla, minkä vuoksi vartalo
  kiertyy nyt vasen olka edellä; iskun alussa ranne hypähtää noin 40°.
- **Vapaan kääntymisen avoimet asiat:** tasapaino on arvaus. Kosketusnäytön
  napit ovat yhä koodissa, mutta niitä ei ylläpidetä. Hiiren pystyliike
  vaikuttaa vain kameraan.
- **Usean vastustajan avoimet asiat:** hyökkäysvuoroa ei vielä ole, joten
  kaksi vastustajaa lyö yhtä aikaa (vain `__game.addEnemy`lla kokeiltavissa).
  Vastustajan iskuvihje (`#cue`) näyttää vain mittarin kohteen.
- **Pihapiirin avoimet viat:** rakennuksiin, aitaan ja tuleen ei voi
  törmätä (taistelukehä pitää hahmot pihalla, mutta kaatuneen varusteet
  voivat lentää aidan läpi); kamera on kehän reunalla lähellä pelaajaa;
  punosaita on sileä levy, jonka punos on tekstuuria; sisätilat ovat
  mustia laatikoita; kuoppatalon kuilun reunassa maaston ja mallin raja
  on jyrkkä. Patsasaitta ja luukulliset valoaukot ovat uskottavia mutta
  eivät Suomen varhaisrautakaudelta todistettuja; hirsisalvosta ja
  savupiippua ei ole käytetty, koska ne ovat myöhempiä. Paikan vaihto
  lataa sivun uudelleen eikä onnistu kesken pelin.
- **Asennot on viritetty silmämääräisesti** kuvakaappauksista. Raskaalla
  sivalluksella ja pistolla ei ole omaa asentoa (sama kuin kevyellä).
  Keihäsmiehen torjunta näyttää samalta kaikissa kolmessa asennossa.
- **Hiiren lisänapit:** jos hiiren ajuri on määrittänyt napin omaan
  toimintoonsa (makro, DPI-vaihto), selain ei näe painallusta lainkaan.
  Joissain selaimissa napit 4 ja 5 voivat silti selata historiaa.
- **Kypärän tekstuuri** on sama metallilevy kuin muissa osissa, ja kupu on
  melko sileä; lentävä kypärä voi pudota puun tai kiven läpi (ei törmäyksiä).
- **Laulun hidastus 1/15** tarkoittaa, että koko laulu (noin 5,7 s) on
  vastustajalle noin 0,4 s. Vastustaja ehtii osua lähinnä, jos sen isku oli
  jo nostossa valinnan alkaessa. Arvo on säädettävissä (`song.slowmo`
  JSON-tekstin kautta).
- **Parannuslaulun teho on arvaus:** 8 osumaa = 40 elämää, eikä laulu vaadi
  vastustajaa, joten aaltojen välissä sen voi laulaa rauhassa.
- **Kalevalan säkeet on kirjoitettu muistista** (9. runo, verensulkusanat);
  sanamuoto kannattaa tarkistaa painetusta tekstistä.
- **Suon reunus** on erillinen kumpu maan päällä: sen ulkoreunan ja
  tallatun maan raja näkyy läheltä. Muta ei heijasta hahmoja.
- **Kilven lovi** leikkaa pinnan shaderilla, joten loven reunassa ei ole
  paksuutta, ja kilven varjo pysyy ehjänä.
- **Hahmojen avoimet viat:** kasvot ilman tekstuuria, rengaspanssari varjossa
  lähes musta, tukeva vartalo, hiukset sileä "verho", peukalo ei kierry
  kahvan ympäri, helma voi venyä haara-asennossa.
- Suorituskyky on mitattu vain tehokoneella; LOD-malleja tai
  laatuasetusta ei ole. Metsässä 2 milj. kolmiota, hahmoissa 28 000 / kpl.
- Metsän avoimet viat: kodan oviaukko, ruskea uhrikivi, paperiset
  latvukset vastavalossa, ei tuulta, puihin ei voi törmätä.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`).
- Osumat ratkaistaan etäisyyden ja kulman perusteella, ei terän liikeradasta.

## Seuraava tehtävä

Omistaja kokeilee julkaistusta osoitteesta, että peli toimii jaon jälkeen
kuten ennen (aloitus, tauko, säätö, laulu, uusi peli). Sitten **askel 2**
(v01.01.00): aaltojen kokoonpano taulukkoon (aallot 1–3 yksi, 4–5 kaksi,
6+ kolme), elämän ryhmäkerroin (ehdotus 60 % / 45 %), hyökkäysvuoro (yksi
lyö kerrallaan, seuraava aikaisintaan 0,5 s päästä), asemointi kyljille,
vastustajat väistävät toisiaan. **Askel 3:** lukituksen kohteen vaihto,
pienet palkit päiden päällä, varoitus selän takaa. **Askel 4:** suoja-aika
onnistuneen torjunnan jälkeen (0,6 s, täydellisellä 1,0 s) torjuntasektorin
sisällä; omistajan päätös 2026-11-14: ei 180°:n sektoria.
Lisäksi yhä auki: kaatuneiden ulkonäkö ja
Säätö-välilehden arvot (Kopioi arvot) oletuksiksi kirjattaviksi.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Muut referenssihahmot (tietäjä, emäntä, Louhi, jousineito, isäntä).
- Isojen skannattujen puiden lataus ja kevennys.
- Aseiden laatuerot ja vahingon hajonta: rakenne on valmiina, mutta sisältö
  odottaa omistajan päätöstä.

## Pysyvät päätökset

- Moottori: Three.js selaimessa. Claude/Codex kirjoittavat moottorin,
  fysiikan ja suuren osan animaatiosta koodina.
- Hostaus aluksi GitHub Pagesissa. Lovable on mahdollinen myöhemmin
  GitHub-synkkauksen kautta, mutta koodia ei kirjoiteta Lovablen tekoälyllä
  (kaksi tekoälyä samassa koodissa sotkisi).
- Tyyli: pronssikautinen / varhaisen rautakauden Fennoskandia.
- Ulkopuoliset assetit vain CC0 (Poly Haven); lähteet `assets/CREDITS.md`.
  Puut tehdään itse oksakorteista, koska skannatut puut ovat selaimelle
  liian raskaita (17 milj. polygonia).
- `bun.lock` on muotoa `lockfileVersion: 2`, joten vaaditaan Bun 1.4 tai
  uudempi (1.3 ei osaa lukea sitä). Kotikoneella Bun 1.4.4.
- Hahmojen pohja on Blender Studion Human Base Meshes (CC0); vaatteet
  johdetaan vartalon pinnasta skriptillä, ja animaatio tehdään koodilla
  ilman valmiita animaatioleikkeitä.
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
