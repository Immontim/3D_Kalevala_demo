# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-14 (Claude, kotikone, Windows)

- **Versio v00.17.00**, branch `claude/free-turn` (tarkista merge-tila
  `git merge-base --is-ancestor`). Mainissa on v00.16.00.
- **Vapaa kääntyminen** (`src/main.ts` kohta "Katse ja lukitus",
  luvut `src/controls.ts` `CONTROLS`): hiiren liike (vain hiiren ollessa
  lukittuna peliin) muuttaa `camYaw`/`camPitch`. Sankari kääntyy kohti
  `camYaw`ta nopeudella `Stats.turnSpeed` (°/s), ja WASD liikkuu `camYaw`n
  suhteen. Lukitus (toiminto `lock`, oletus Tab / hiiren keskinappi) on
  kytkin `lockOn`: lukittuna `camYaw` seuraa vastustajaa (`lockTarget()`)
  eikä hiiren sivuliike käännä; lukitus jää päälle seuraavaan aaltoon.
  Kamera on `camYaw`n suunnassa sankarin takana; vapaana se katsoo eteen,
  lukittuna kohti vastustajaa.
- **Vastustajan kääntyminen** (`updateAi`): vastustaja kääntyy kohti
  pelaajan paikkaa `ai.seen`, joka seuraa oikeaa paikkaa reaktioviiveen
  (`Stats.reaction`) verran jäljessä, nopeudella `Stats.turnSpeed`, iskun,
  horjahduksen ja väistön aikana kertoimella `ENEMY_AI.attackTurnScale`.
  `pickEnemyAttack` ei aloita iskua, jos pelaaja on yli 0,9 × iskun kaaren
  sivussa. Mitattu: täydellä nopeudella 2 m:n säteellä kiertävä pelaaja
  jää nuoren urhon suunnasta noin 80° sivuun, torjunta-asennon nopeudella
  noin 37°. Kiertäjän on siis juostava ja ajoitettava isku.
- **Torjuntasektorit** (`WEAPONS.*.blockArc` π/4 = ±45°,
  `SHIELDS.round.blockArc` π/3 = ±60°; omistajan päätös 2026-11-14).
- **Kaksi taistelupaikkaa** (`src/world.ts`): `ARENA` on tällä latauksella
  käytössä oleva paikka (`"clearing"` = nuotioaukio, `"homestead"` =
  pihapiiri), luettu avaimesta `laulun-miekka.arena.v1`. Maailma
  rakennetaan kerran moduulin latautuessa, joten aloitusikkunan valinta
  (`#arenaPick`, `main.ts`) kutsuu `saveArena()` ja lataa sivun uudelleen.
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
- **Mittarit** (`main.ts` `meterOff`, `placeMeters`): tauolla raahattavat,
  siirtymä tallentuu avaimeen `laulun-miekka.meters.v1`.
- **Laulut ja valinta** (`src/songLogic.ts`: `SONGS`, `SONG_SLOTS`,
  `HEAL_VERSES`, `healOnHit`, `slotPositions`; kulku `main.ts` kohdassa
  "Laulun valinta"): laulunappi täydellä voimalla → `openChoice()`:
  `choosing` pysäyttää maailman kokonaan (dt = 0), hiiren lukitus
  vapautetaan (`choiceUnlock` estää automaattisen tauon) ja viisi
  laulupaikkaa (`#choice .slot`, HTML) asetellaan joka ruutu kaarelle
  hahmon ympärille. Valinta pikanäppäimellä (toiminnot `song1`–`song5`,
  oletus F1–F5, `bindings.ts`) tai napsauttamalla → `startSong(id)`;
  laulunappi uudestaan peruu ja voima säilyy. Laulu, joka tarvitsee elävän
  vastustajan (`needsEnemy`), näkyy himmeänä eikä valikoidu ilman sitä.
  **Uusi laulu:** lisää `SongId`, rivi `SONGS`iin, paikka `SONG_SLOTS`iin,
  väri `.slot.<id>` (style.css) ja vaikutus `judge`/`endSong`iin.
  Parannuslaulu antaa `SONG.healPerHit` (5) elämää heti osumasta, joten
  katkennutkin laulu auttaa, eikä sillä ole osumarajaa.
- **Kilven asento** (`src/fighter.ts`): `shieldHang` 0..1 kääntää kilven
  torjunnasta (`SHIELD_FRONT`) roikkumaan kyljelle (`SHIELD_HANG_YAW`).
- **Askellus ja elävyys** (`src/fighter.ts`, taulukko `GAIT`): hahmon
  nopeus mitataan `root`in todellisesta siirtymästä hahmon omassa
  koordinaatistossa (`animate`), ja `apply` laskee kummallekin jalalle
  paikan (asennon mukainen paikka + askel) ja ratkaisee siitä reiden ja
  polven kulmat. Maassa olon aikana jalka kulkee vartaloon nähden hahmon
  nopeudella taaksepäin, joten se ei liu'u. `animate`n `moveSpeed` kertoo
  vain, onko liike kävelyä: iskun työntö ja väistö eivät askella.
  Lantio, hartiat, painonsiirto ja hengitys lasketaan samassa kohdassa.
  Mittari: `__game.feet`.
- **Kaatuminen** (`src/fighter.ts`, taulukko `FALLEN`, `Fighter.fall`,
  `dropGear()`; valinta `main.ts` `fallDown()`). **Päätös:** kaatuneet
  tehdään luurangolla, ei omina malleina. Savutestissä
  `__game.fallShowcase(n)`.
- **Kaikki pelin luvut ovat parametritaulukoissa**, eikä uusia lukuja
  kovakoodata `main.ts`:ään:
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
- **Säätö** (`src/tuning.ts`, käyttöliittymä `main.ts` kohdassa
  "Säätövälilehti"): jokainen taulukon luku on säädettävissä polulla
  (esim. `weapons.spear.reach`). `FIELDS` listaa taukoikkunan 31 kenttää
  rajoineen; muut polut voi muuttaa JSON-tekstin kautta. Malli: luonnos →
  "Ota käyttöön ja aloita alusta" → `applyChanges` + `restart()`.
  Tallennus `localStorage`-avaimeen `laulun-miekka.tuning.v1`, ja arvot
  otetaan käyttöön ennen hahmojen luontia. Vientimuoto:
  `{ peli, versio, muutokset: { ...vain poikkeavat arvot puuna } }`.
  **Kun omistaja liittää JSONin keskusteluun, sen arvot kirjoitetaan
  taulukoiden oletuksiksi** ja omistaja palauttaa säätönsä oletuksiin.
- **Laulun rytmipeli** (`src/songLogic.ts` puhdas logiikka ja kaikki luvut
  taulukossa `SONG`, kulku `src/main.ts`): valinnan jälkeen maailma
  hidastuu (`slowmo` 1/15), `intro` 0,6 s (lauluasento `POSES.sing` on
  otettu jo valinnan aikana), sitten riimuja yhtä monta kuin laulussa on
  säkeitä (8), kunkin alla osuma-alue (`zoneFirst` 0,24, jokainen seuraava
  `zoneShrink` 0,84 × edellinen). `speed` 1,5 on nauhan nopeus: riimujen
  väli (0,53 s) ja alueiden kesto jaetaan sillä; vaikeutta säädetään
  ensisijaisesti siitä. Painallus arvioidaan aina seuraavaa riimua
  vastaan. Suolaulu laukeaa `minHits` 4 osumalla; kesto on osumat ×
  `rootTimePerHit` 0,75 s. Vastustajan osuma kesken laulun kutsuu
  `interruptSong()`. Voima nollataan laulun alussa. Tauko pysäyttää myös
  riimut.
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
- **Tekoäly** (`pickEnemyAttack`, `src/main.ts`): arpoo iskusuunnan ja
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
- **Käsin testattu 2026-11-14** (in-app browser, skriptattu syöte
  `__game.setLook`, `setLock`, `look`): selän kääntäminen vastustajaan,
  lukitus kääntää katseen ja sankarin kohti vastustajaa, lukitusmerkki,
  kiertomittaus yllä; ei konsolivirheitä. **Ei testattu:** oikea hiiren
  liike (selainpaneelin skripti ei saa hiirtä lukittua), herkkyyden
  tuntuma, Tab-näppäin oikeassa selaimessa, nuotioaukio uudella
  ohjauksella. **2026-11-13:** pihapiiri, paikan vaihto ja
  kamera pihalla, 60 FPS / RTX 4080.
  **Ei testattu:** ihmisen pelaamana; buildattu versio selaimessa;
  hitaampi kone. Aiemmista yhä kokeilematta: mittarien
  raahaus oikealla hiirellä, hiiren lukitus laulun valinnassa, F1–F5
  oikeassa selaimessa, askellus ihmisen silmin, kaatuneet kaltevalla
  maalla, suossa kuoleva vastustaja.
- **Komennot 2026-11-14:** `bun run test` (68/68), `bun run lint`,
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
- **Vapaan kääntymisen avoimet asiat:** tasapaino on arvaus (urho voi olla
  liian helppo kiertää). Kosketusnäytön napit ovat yhä koodissa, mutta
  niillä ei voi kääntyä; niitä ei ylläpidetä. Hiiren pystyliike ei vaikuta
  iskuihin, vain kameraan. Lukitus kohdistuu ainoaan vastustajaan; usean
  vastustajan kohteen valinta tehdään vaiheessa 2.
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

Omistaja pelaa vapaalla kääntymisellä julkaistusta osoitteesta mergen
jälkeen ja kertoo hiiren herkkyyden, lukituksen ja kiertämisen tuntumasta.
Sen jälkeen vaihe 2: 2 vastustajaa aalloissa 4–5 ja 3 aallosta 6 alkaen,
hyökkäysvuoro (vain yksi lyö kerrallaan), ryhmäkerroin elämälle
(ehdotus 60 % / 45 %), lukituksen kohteen valinta ja pienet palkit pään
päällä. Versio v01.00.00 (datamallin muutos: `enemy` → lista). Lisäksi yhä auki: kaatuneiden ulkonäkö ja
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
