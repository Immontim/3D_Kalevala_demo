# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-15 (Codex, Windows)

- **Pelin koodiversio mainissa on v01.05.01** (`src/version.ts`, mainin
  lähtöcommit `c48b27e`). Mainissa ovat yhteinen maailmantörmäys,
  kilvettömän miekkamiehen vapaan käden animaatio sekä assetteina
  talousesineet, tietäjä, jousineito ja emäntä. Assetit eivät yksin nosta
  pelin versionumeroa, eikä talousesineitä tai kyläläisiä vielä ladata peliin.
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
- **Rauhallinen pihakohtaus** (omistaja hyväksyi 2026-11-14) on seuraava
  integraatiotyö: uusi paikka, talousesineiden ja pysyvien hahmojen
  sijoittelu, pysyvien hahmojen tyyppi (seisovat aluksi paikallaan) ja
  tekijäluettelo peliin. Peli ei vielä lataa talousesineitä
  (`household.glb`) eikä kyläläisiä (`villagers.glb`, `villagers_f.glb`);
  pöydän ja penkin törmäysmuodot ovat jo `PROP_COLLIDERS`issa.
  `prepareMaterials`iin pitää lisätä materiaalit `M_HH_*` ja `F_Weave`.
  Naishahmo skaalataan noin 0,95:een, eikä miehen kädestä mitattu
  `GRIP_CHANNEL` käy hänelle. Eläimet (`assets/animals/*.glb`, branch
  `claude/animals`) tuovat mukanaan animaatioleikkeet, joten ne tarvitsevat
  `THREE.AnimationMixer`in; tämä on poikkeus päätöksestä animoida koodilla
  ja odottaa omistajan vahvistusta. Mallien sisältö, nimet ja viat:
  `docs/BLENDER_HANDOFF.md`.
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
- **Askellus ja elävyys** (`src/fighter.ts`, taulukko `GAIT`): nopeus
  mitataan `root`in todellisesta siirtymästä, ja `apply` ratkaisee jalkojen
  kulmat jalan paikasta, joten maassa oleva jalka ei liu'u. `animate`n
  `moveSpeed` kertoo, onko liike kävelyä: iskun työntö ja väistö eivät
  askella. Mittari: `__game.feet`.
- **Kilvetön miekkamies** (`src/fighter.ts`, `SWORD_FREE_ARM`) käyttää
  vartiossa, lyönneissä ja torjunnoissa omia vasemman käden asentoja.
  Vapaa käsi toimii lyöntien vastapainona ja saa kävelystä sekä hengityksestä
  pienen lisäliikkeen. Kilpi- ja keihäsasennot eivät muutu.
- **Kaikki pelin luvut ovat parametritaulukoissa**, eikä uusia lukuja
  kovakoodata moottoriin: `src/combat.ts` (`CHARACTERS`, `WAVES`,
  `STAMINA`, `COMBAT`, `ENEMY_AI` sekä alla kuvatut `STRIKES`, `WEAPONS`,
  `SHIELDS`, `BASH`) ja `src/songLogic.ts` (`SONG`; johdetut arvot
  funktioina `beatGap()`, `songLead()`).
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
- **Kilpityöntö** (`BASH`, `shouldShieldBash`, `melee.ts`): vain kilvellinen
  Pohjan soturi osaa käyttää sitä; lähietäisyydellä satunnainen valinta on
  12 % AI:n päätöksistä, ja pitkään torjuvaa vastaan valinta on
  varma (hyökkäysvuoro ja `attackChance` ratkaisevat vielä aloituksen).
  Nuori urho ei käytä liikettä. Osuma tekee 0,25 × voima vahinkoa myös
  murtaessaan ase- tai kilpitorjunnan, pysäyttää jo alkaneen iskun ja
  yrittää siirtää puolustajaa 0,65 m taakse nopeudella 2,6 m/s (areenaraja
  tai toinen hahmo voi lyhentää nettosiirtymää). Suohon juuttunut ottaa
  vahingon mutta ei siirry.
- **2,5D-törmäykset** (`src/collision.ts`, rekisteri `World.collision`):
  hahmot ovat XZ-tason ympyröitä (säde 0,5 m); sama `DiscBody`-rajapinta
  sopii eläimille. Kävely liukuu staattista estettä pitkin, mutta väistö,
  tukiaskel ja kilpityönnön horjahdus pysähtyvät. Dynaamiset vartalot
  erotetaan yhdessä staattisten esteiden kanssa, joten vastustajan voi
  sulkea seinää tai aitaa vasten. `world.ts`-tiedoston `PROP_COLLIDERS`
  määrittää mallityypin muodon kerran; jokainen `put()`-instanssi rekisteröi
  sen automaattisesti. Mukana ovat kivet, puunrungot, kota, rakennusten
  pohjat, aita sekä pihan ja tulevan rauhallisen kohtauksen suuret tavarat
  (`pukkipoyta`, `penkki`). Nuotiossa on kiinteä ydin ja lämpökehä (10
  vahinkoa/s). Iskujen nykyinen etäisyys-/kulmamalli säilyy, mutta
  `blocksMelee`-este ennen kohdetta pysäyttää iskun. Myös ilman vastustajaa
  esteeseen lyöminen tuottaa `environment`-tapahtuman ja erilliset
  kylmänväriset kipinät (`ImpactKind`); tämä on laajennuspiste eri
  pintamateriaaleille. Debug: `__game.collision`, latauksen tilasto
  `__world.collision`.
- **Tekoäly** (`pickEnemyAttack`, `src/engine/ai.ts`): arpoo iskusuunnan ja
  painon varustuksen mukaan, lyö raskaasti kilven takana seisovaa pelaajaa,
  ja aseella torjuessaan arvaa suunnan oikein sitä useammin, mitä pidemmällä
  aalloissa ollaan. Keihäällä voi vain pistää.
- **Koodi valmis ja mainissa:** v01.05.01. GitHub Pagesin deploy-tilaa ei
  tarkistettu tässä dokumenttisiivouksessa; omistajan pelitesti tehdään
  julkaistusta osoitteesta.
- **Käsin testattu 2026-11-14** in-app browserissa: kilvettömän miekkamiehen
  vartioasento, ylälyönnin vastapainoliike ja palautuminen; maailma ja hahmot
  piirtyivät, 60 FPS, ei konsolivirheitä. Kilpi- ja keihäsasentoja ei muutettu.
- **Komennot 2026-11-14:** `bun run test` 168/168, `bun run lint`,
  `bun run build` ja `git diff --check` ok. Build varoittaa ennestään yli
  500 kt:n JS-palasta.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- Savutestien apuna on `window.__game`; koko lista ja käyttö ovat
  `src/debug.ts`:ssä. Selainpaneelin fokus voi pysäyttää pelin.

## Tunnetut rajoitteet ja riskit

- **Tasapainoa ei ole pelitestattu.** Kaikki luvut ovat arvauksia.
  Suuntatorjunta ilman kilpeä voi olla liian vaikea: iskun suunta pitää
  lukea vastustajan asennosta tai HUD-vihjeestä noin puolessa sekunnissa.
- **Kestävyyden tasapaino on arvaus.** Palautuminen 1/s on hidas suhteessa
  hintoihin, ja kestävyys rajoittaa lähinnä raskaita lyöntejä ja torjuntaa.
  Vastustajalla ei ole täydellistä torjuntaa.
- **Askellus:** paikallaan kääntyvä hahmo ei ota askelia. Sivuttaisliike
  on tiheää askellusta (3,4 m/s on sivulle epärealistisen nopea). Ei
  lentovaihetta juoksussa, eivätkä kädet heilu askeleen tahdissa.
- **Keihäällä on vain pisto**, joten sitä vastaan riittää pistotorjunta.
  Kantaman (3,5 m) reunalla osuma voi näyttää ilmaan osuvalta, ja alle
  1,3 m:n päässä keihäs ei osu lainkaan.
- **Keihäsotteen avoimet viat:** sormet ovat lähdemallissa erillään, joten
  ote harittaa läheltä (ei sormiluita); kämmenen kierto näkyy kyynärvarren
  hihassa; pistossa etukäsi on ulottuvuutensa rajalla, minkä vuoksi vartalo
  kiertyy nyt vasen olka edellä; iskun alussa ranne hypähtää noin 40°.
- **Vapaan kääntymisen avoimet asiat:** tasapaino on arvaus. Kosketusnäytön
  napit ovat yhä koodissa, mutta niitä ei ylläpidetä. Hiiren pystyliike
  vaikuttaa vain kameraan.
- **Usean vastustajan avoimet asiat:** tasapaino on arvaus. Suoja-aika ei
  oletusarvoilla käytännössä laukea (ks. yllä): pidennä sitä tai lyhennä
  `enemyAi.attackGap`ia, jos sen halutaan tuntuvan. Hajaantuminen on
  pehmeää, joten vastustajat voivat ajautua metrin päähän toisistaan.
  Sankarin isku osuu aina vain yhteen (myös leveä sivallus).
- **Törmäysten avoimet riskit:** proxy-muotojen mitat on arvioitu
  Blender-skriptien mitoista eikä jokaista mallia ole käsin kokeiltu.
  Pienet esineet, kasvillisuus, ruumiit ja lentävät varusteet eivät törmää.
  Tekoäly osaa liukua esteen reunaa pitkin mutta ei vielä suunnitella reittiä
  pöydän tai rakennuksen ympäri; eläinten liikkuessa tarvitaan mahdollisesti
  harva navigointiruudukko. Kamera käyttää yhä pihapiirin säderajaa.
  Ympäristöosuma on suora jana, ei terän tai keihään todellinen liikerata.
  Nuotion 10 vahinkoa/s ja lämpökehän leveys ovat testaamattomia arvauksia.
- **Pihapiirin avoimet viat:** kamera on kehän reunalla lähellä pelaajaa;
  kaatuneen varusteet voivat lentää aidan läpi; punosaita on sileä levy;
  sisätilat ovat mustia laatikoita; kuoppatalon kuilun reunassa maaston ja
  mallin raja on jyrkkä. Patsasaitta ja luukulliset valoaukot ovat
  uskottavia mutta eivät Suomen varhaisrautakaudelta todistettuja. Paikan
  vaihto lataa sivun uudelleen.
- **Asennot on viritetty silmämääräisesti** kuvakaappauksista. Kilvettömän
  miekkamiehen vapaa käsi on nyt dynaamisempi, mutta kaikkien iskujen
  luonnollisuus pitää vielä arvioida tavallisessa pelissä. Raskaalla
  sivalluksella ja pistolla ei ole omaa asentoa (sama kuin kevyellä), ja
  keihäsmiehen torjunta näyttää samalta kaikissa kolmessa asennossa.
- Lentävä kypärä voi pudota puun tai kiven läpi.
- **Suon reunus** on erillinen kumpu maan päällä ja näkyy läheltä; muta ei
  heijasta hahmoja.
- Suorituskyky on mitattu vain tehokoneella; LOD-malleja tai
  laatuasetusta ei ole. Metsässä 2 milj. kolmiota, hahmoissa 28 000 / kpl.
- Metsän avoimet viat: kodan oviaukko, ruskea uhrikivi, paperiset
  latvukset vastavalossa ja tuulen puute.
- Osumat ratkaistaan etäisyyden ja kulman perusteella, ei terän liikeradasta.

## Seuraava tehtävä

Omistaja kokeilee julkaistusta v01.05.01-versiosta kilvettömän miekkamiehen
vasemman käden luonnollisuuden vartiossa, liikkeessä ja eri iskuissa.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Dialogijärjestelmä (ensin assetit ja rauhallinen kohtaus pystyyn).
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
- Ulkopuoliset assetit CC0 tai CC-BY (ei NC/ND/SA); CC-BY vaatii tekijän
  nimen `assets/CREDITS.md`:hen ja pelissä näkyvän tekijäluettelon.
  Puut tehdään itse oksakorteista, koska skannatut puut ovat selaimelle
  liian raskaita (17 milj. polygonia).
- `bun.lock` on muotoa `lockfileVersion: 2`, joten vaaditaan Bun 1.4 tai
  uudempi (1.3 ei osaa lukea sitä). Kotikoneella Bun 1.4.4.
- Hahmojen pohja on Blender Studion Human Base Meshes (CC0); vaatteet
  johdetaan vartalon pinnasta skriptillä, ja animaatio tehdään koodilla
  ilman valmiita animaatioleikkeitä.
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
