# Agent handoff — 3D Kalevala

Kanoninen pelikoodin ja integraation nykytila. Pidä tämä alle noin
400 rivin / 30 kt:n. Blender- ja asset-tila on `docs/BLENDER_HANDOFF.md`:ssä.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-15 (Claude, Windows)

- **Branchin `claude/peaceful-yard` koodiversio on v01.07.00** (pohjana
  `origin/main` `46ff4b9`, v01.06.00). Tarkista merge-tila
  `git merge-base --is-ancestor claude/peaceful-yard origin/main`.
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
- **Kielituki** (`src/i18n.ts`): suomi ja englanti ovat tyypitettyjä
  sanakirjoja, ja suomen avaimet määrittävät `TextKey`-tyypin, joten puuttuva
  EN-käännö pysäyttää tyyppitarkistuksen. Aloitusikkunan FI/EN-valinta
  tallentuu avaimeen `laulun-miekka.language.v1` ja vaihtaa kielen sivun
  uudelleenlatauksella; oletus on suomi. `data-i18n` kääntää staattisen
  HTML:n ja `t()` dynaamiset tekstit. **Uusi näkyvä teksti lisätään aina
  sanakirjaan.** Kalevalan säkeet ovat `VerbatimText`-olioita (`verbatim()`),
  ja `renderVerbatim()` asettaa `lang="fi"`, `translate="no"` sekä
  `notranslate`-luokan. Samaa merkintää käytetään tulevissa dialogeissa
  teksteille, joita ei tarkoiteta käännettäviksi.
- **Vastustajat ovat lista** `g.enemies` (vain elossa olevat; kaatunut
  siirtyy heti `g.corpses`iin, `enemyDown`). Jokaisella on oma `Actor.ai`,
  `level` ja `name`. `lockTarget()` pitää kohteen `aim.target` ja vaihtaa
  kaatuneen tilalle lähimmän; `focusEnemy()` (lukittu tai lähin) on
  mittarien ja laulun kohde. Sankarin isku osuu yhteen: lukittuun tai
  lähimpään ulottuvilla olevaan (`melee.ts` `strikeTarget`).
- **Kohtaus** (`engine/encounter.ts` `Encounter`: `start`, `update`,
  `onEnemyDown`) päättää, keitä kentälle tuodaan (`addEnemy`). Moottori ei
  tiedä aalloista: aaltotaistelu on `skirmish.ts`, tyhjä kohtaus `peace`
  ja rauhallisen pihan `visit` (kuin `peace`, mutta kertoo alussa paikan).
  `main.ts` valitsee kohtauksen: `ARENA_PEACEFUL ? visit : skirmish`.
  Vaihto `startEncounter()`. Tuleva RPG-kerros kutsuu moottoria tätä kautta.
- **Kolme paikkaa** (`src/world.ts`): `ARENA` on tällä latauksella
  käytössä oleva paikka (`"clearing"` = nuotioaukio, `"homestead"` =
  pihapiiri, `"yard"` = rauhallinen piha), luettu avaimesta `laulun-miekka.arena.v1`. Maailma
  rakennetaan kerran moduulin latautuessa, joten aloitusikkunan valinta
  (`#arenaPick`, `ui/startMenu.ts`) kutsuu `saveArena()` ja lataa sivun uudelleen.
  Paikkojen erot ovat taulukossa `SITES` (tasaisen alueen säde, puiden
  ja varvikon raja, tallattu maa, nuotion paikka, rakennusten pohjat
  `footprints`, kameran raja `camMaxR`). Metsä, valo ja taistelukehä
  (`ARENA_RADIUS` 11) ovat yhteiset, ja nuotioaukio on ennallaan.
  **Uusi paikka:** lisää `ArenaId`, rivi `ARENAS`iin ja `SITES`iin sekä
  sijoittelu `populate`n loppuun.
- **Rauhallinen piha** (`ARENA === "yard"`, `ARENA_PEACEFUL`). Sama talo,
  aitta, katos, haasia, aita ja portti kuin pihapiirissä (`HAS_YARD`), mutta
  kuoppatalon paikalla on sikolätti (`STY`, pohja `footprints`issa, koko
  aitaus on törmäyslaatikko), länsilaidalla kanakoppi (`COOP`) ja talon
  edessä katettu pöytä (`TABLE`). Peli lataa lisäksi `household.glb`n ja
  `yard.glb`n; sijoittelu on `populate`n lopussa ja törmäysmuodot
  `PROP_COLLIDERS`issa. Väki tulee funktiosta `populateYardLife`
  (`world.ts`), joka käyttää moduulia `src/folk.ts`:
  - `spawnVillager`: kevyt paikallaan seisova hahmo, ei `Fighter` eikä
    `Actor`. Klooni tiedostosta `villagers*.glb`, kädet käännetään
    lepoasennosta annettuihin suuntiin (`ArmPose`, `aimBone`), pää kääntyy
    alle 7 metrin päässä edessä olevan kulkijan perään ja rintakehä
    hengittää. Naiset skaalataan 0,95:een. Esine (`sauva`, `jousi`) seisoo
    maassa käden kohdalla.
  - `spawnAnimal`: `AnimationMixer` ja käytös `idle` (yksi leike), `dog`
    (`seisoo` ja `istuu` vuorotellen 9–18 s välein) tai `circle` (possu
    kiertää ympyrää). Kukko ja `kana_b` ovat liikkumattomia.
  - `world.update(t, dt, camera, focus)` päivittää väen; `focus` on sankarin
    paikka. Kyläläiset, koira ja kanat ovat pyöreitä esteitä
    (`folk:*`, `blocksMelee: false`).
  **Vihamieliseksi muuttuminen ei vaatinut refaktorointia:** vastustajat
  tuo kohtaus, ei paikka. `startEncounter(skirmish)` tai yksittäinen
  `addEnemy` toimii rauhallisella pihalla, ja vastustajan mittarit, lukitus
  ja aaltonumero tulevat näkyviin itsestään (savutestattu:
  `__game.addEnemy(0, 0, 5)`, `__game.encounter("skirmish")` ja takaisin
  `"peace"`). Tekemättä: väen reaktio taisteluun ja kyläläisen muuttuminen
  vastustajaksi. Jälkimmäinen vaatisi, että `Fighter` osaa ladata hahmon
  myös tiedostoista `villagers*.glb` (sama luuranko ja luiden nimet;
  naisilla eri lepoasento ja oma otekanava). Tekijäluettelo on
  aloitusikkunan `#credits` (`credits.*`-tekstit); uusi CC BY -asset
  lisätään sinne ja `assets/CREDITS.md`:hen.
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
- **Koodi valmis:** v01.07.00 branchissa `claude/peaceful-yard`. Ei
  deployattu.
- **Savutestattu 2026-11-15** in-app browserissa (`localhost:5174`,
  työpuun dev-palvelin): rauhallinen piha latautuu, kaikki kolme
  kyläläistä, koira, kanat, kukko ja possu näkyvät oikeilla paikoillaan,
  aloitusviesti näkyy, aaltonumero ja vastustajan mittari ovat poissa,
  ja ne palaavat, kun pihalle tuodaan vastustaja. Kolme paikkaa ja
  tekijäluettelo näkyvät aloitusikkunassa. Konsolissa ei virheitä.
  **FPS:ää ei saatu mitattua:** selainpaneeli oli piilossa, jolloin selain
  kuristaa ruudunpäivityksen. Pakotettu piirto vei rauhallisella pihalla
  noin 2,6 ms ja taistelupihalla noin 1–2 ms ruutua kohti tehokoneella.
  Omistaja ei ole vielä kävellyt pihalla itse.
- **Komennot 2026-11-15:** `bun run test` 88/88, `bunx tsc --noEmit`,
  `bun run lint` ja `bun run build` ok. Build varoittaa ennestään yli
  500 kt:n JS-palasta.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- **Esikatselutyökalu ja työpuut:** Clauden `preview_start` lukee
  `.claude/launch.json`in pääkansiosta ja käynnistää palvelimen siellä, ei
  työpuussa. Työpuun savutesti: `bun run dev --port 5174 --strictPort`
  työpuusta ja selain osoitteeseen `localhost:5174`; sulje palvelin lopuksi.
- Savutestien apuna on `window.__game`; koko lista ja käyttö ovat
  `src/debug.ts`:ssä. Selainpaneelin fokus voi pysäyttää pelin.

## Tunnetut rajoitteet ja riskit

- **Tasapainoa ei ole pelitestattu.** Kaikki luvut ovat arvauksia.
  Suuntatorjunta ilman kilpeä voi olla liian vaikea: iskun suunta pitää
  lukea vastustajan asennosta tai HUD-vihjeestä noin puolessa sekunnissa.
- **Englanninkielinen sanasto on agentin kääntämä**, ei äidinkielisen
  tarkistama. Tekninen kattavuus on testattu, mutta sävyä ja termejä voi
  vielä hioa pelitestissä. Uusi kieli vaatii sanakirjan lisäksi uuden
  `Language`-arvon ja valintapainikkeen lipputyyleineen.
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
- **Rauhallisen pihan avoimet asiat:** kyläläisten käsien asennot ja
  esineiden paikat on katsottu vain kuvakaappauksista. Jousi ja sauva
  seisovat maassa käden kohdalla, eivät ole kiinni kädessä, joten ne eivät
  seuraa, jos hahmo joskus liikkuu. Possun kävelynopeutta (0,3 m/s) ei ole
  sovitettu leikkeen askeleeseen, joten sorkat voivat liukua; lepoleikettä
  ei ole, joten possu kävelee tauotta. Koiran `tassu`-leike ei ole
  käytössä. Kanakopin lautaseinän syykuvio on aaltoileva ja varjossa tumma.
  Väki on este mutta ei reagoi taisteluun: jos pihalle tuodaan vastustaja,
  kyläläiset ja eläimet jatkavat kuin mitään ei tapahtuisi, eivätkä iskut
  osu heihin (`blocksMelee: false`). Kolme kyläläistä tuo noin 84 000
  kolmiota ja koira 191 luuta; FPS on mittaamatta (ks. Nykytila).
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

Omistaja kävelee rauhallisella pihalla julkaistussa pelissä ja antaa
palautteen (sijoittelu, asennot, eläimet, FPS). Sen perusteella korjataan
näkyvät viat. Uudet näkyvät tekstit lisätään `src/i18n.ts`:n FI- ja
EN-sanakirjoihin; alkuperäiskielisiksi jätettävät runo- tai
dialogikatkelmat merkitään `verbatim()`-rakenteella.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Dialogijärjestelmä ja kyläläisten liikkuminen (ensin omistajan palaute
  rauhallisesta pihasta).
- Kyläläisen muuttuminen vastustajaksi (suunnitellaan erikseen; ks.
  Rauhallinen piha).
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
  ilman valmiita animaatioleikkeitä. Poikkeus (omistaja 2026-11-15):
  eläimet käyttävät lähdemalliensa valmiita leikkeitä.
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
