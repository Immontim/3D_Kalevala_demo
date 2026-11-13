# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-13 (Claude, kotikone, Windows)

- **Versio v00.10.00**, branch `claude/stamina` (tarkista merge-tila
  `git merge-base --is-ancestor`). Mainissa on v00.09.00.
- **Kestävyys (stamina)**: kaikki luvut taulukossa `STAMINA`
  (`src/combat.ts`, testit vieressä): enimmäismäärä hahmoittain (hero 100,
  urho 60, pohja 80), kevyt lyönti 3, raskas 9, toteutunut torjunta 2,
  torjunta-asento 1/s, palautuminen 1/s, uupuneen vahinkokerroin 0,25,
  pelaajan lepo aaltojen välissä +35. `Actor.stamina` ja
  `Actor.maxStamina` ovat hahmokohtaisia, joten esineet ja loitsut voivat
  myöhemmin muuttaa niitä. Hinta maksetaan, kun lyönti laukeaa
  (`spendOnStrike`): keskeytynyt nosto ei maksa. **Uupunut** = kestävyyttä
  alle kevyen lyönnin hinnan (`exhausted`): ei torjuntaa, lyönnit keveitä,
  ilmaisia ja 25 % vahingosta. Jos voimat eivät riitä raskaaseen, lyönti jää
  kevyeksi. Tekoäly: ei torju uupuneena, ei valitse raskasta ilman varaa, ja
  uupuneena vetäytyy 3,8 m:n päähän, kunnes kestävyyttä on 12
  (`ai.resting`); iholle (alle 2 m) tulevaa pelaajaa se lyö silti.
- **Laulu** (`src/songLogic.ts` puhdas logiikka ja kaikki luvut, kulku
  `src/main.ts`): Q täydellä mittarilla → maailma hidastuu
  (`SONG_SLOWMO` 1/20) → pelaaja ottaa asennon `POSES.sing` reaaliajassa
  (`SONG_INTRO` 1,5 s, painallukset eivät vielä laske) → rytmipeli:
  riimuja on yhtä monta kuin säkeitä listassa `SONG_VERSES` (nyt 8), kunkin
  alla osuma-alue (`ZONE_FIRST` 0,24, jokainen seuraava `ZONE_SHRINK`
  0,84 × edellinen). `SONG_SPEED` 1,25 on nauhan nopeus: nauha näyttää
  samalta, mutta riimujen väli (0,64 s) ja alueiden kesto (±0,19 s … ±0,06 s)
  jaetaan sillä. Vaikeutta säädetään ensisijaisesti tästä yhdestä luvusta. Painallus arvioidaan aina
  seuraavaa riimua vastaan, joten alueen ulkopuolelle osunut painallus on
  huti. Loitsu laukeaa `SONG_MIN_HITS` 4 osumalla; kesto on osumat ×
  `ROOT_TIME_PER_HIT` 0,75 s. Vastustajan osuma kesken laulun kutsuu
  `interruptSong()`: loitsu raukeaa ja aika palaa heti. Voima nollataan
  laulun alussa. Tauko pysäyttää myös riimut.
- **Keihäsote** (`src/fighter.ts`; tehty Opus-ali-agentilla, orkestroija
  arvioi kuvista): käsien verkkoon on Blenderissä kaiverrettu otekanava
  (`grip_carve`, `GRIP_P`/`GRIP_D` tiedostossa `char_build.py`; sama
  kanava koodissa `GRIP_CHANNEL`). Keihäs (2,14 m) kiinnitetään oikean
  käden kanavaan, ja taulukko `SPEAR_HOLD` määrää asennoittain otteen
  paikan, varren suunnan ja etukäden etäisyyden. `holdShaft()` +
  `twoBone()` vievät molemmat kädet varrelle käänteiskinematiikalla.
  Mittari: `fighter.spearGripDebug()` (käden etäisyys varresta, ranteen
  kulmat). Vanha `reachShaft()` on poistettu. `SPEAR_SLIDE` 0,3 m siirtää
  keihästä otteessa eteenpäin (takakäden taakse jää noin 0,3 m vartta).
- **Suohon laulettu vastustaja** ei käänny (`updateAi`). Vapauduttuaan se
  kääntyy pelaajaa kohti nopeudella `REORIENT_TURN` 3,2 rad/s eikä liiku,
  torju tai lyö ennen kuin pelaaja on edessä (`ai.reorient`).
- **Taukoikkuna** on raahattava (`main.ts`, luokka `#pause.moved` poistaa
  tummennuksen); Esc myös jatkaa peliä.
- **Suo** (`src/bog.ts`, malli `assets/bog.glb`, skripti
  `assets-src/blender/bog.py`): mutapinta, sammalreunus ja kuplan malli
  tulevat Blenderistä ilman tekstuureja; pinnat tehdään maaston
  tekstuureista (`World.groundTex`) ja heinätupsut metsän malleista
  (`World.proto`). Mudan vellonta, kuplat ja puhkeamisrenkaat lasketaan
  koodissa joka ruutu (529 verteksiä). Luvut taulukossa `BOG`. Suohon
  juuttunutta vastustajaa ei voi enää työntää paikaltaan.
- **Kypärät** (`helmet_hero`, `helmet_pohja`) ovat `characters.glb`:ssä omia
  kappaleitaan ilman luurankoa. `Fighter.build()` kiinnittää kypärän
  pääluuhun lepoasennossa. `knockHelmet(dir)` irrottaa sen lentämään
  (`FlyingProp`). Pelaajan sivallus tai ylälyönti lennättää vastustajan
  kypärän: kevyt 25 %, raskas 60 %, kaatava isku aina. Ei pelivaikutusta.
  Hiukset ovat nyt kokonaiset myös kypärän alla. Urholla on myssy, ei kypärää.
- **Näppäinsidonnat** (`src/bindings.ts`, testit vieressä): toiminnot
  sivallus, ylälyönti, pisto, torjunta, väistö ja laulu, kullakin kaksi
  paikkaa. Koodit ovat `KeyboardEvent.code`-arvoja tai `Mouse0`…`MouseN`.
  Asetusikkuna on taukoikkunassa (Esc); tallennus `localStorage`-avaimeen
  `laulun-miekka.bindings.v1`. WASD, välilyönti, R ja Esc ovat kiinteitä.
  Hiiren nappien 4 ja 5 oletustoiminto (selaimen takaisin/eteenpäin) on estetty.
- **Taistelusäännöt ovat parametritaulukoita** tiedostossa `src/combat.ts`
  (puhdasta logiikkaa, testit vieressä):
  - `STRIKES`: iskusuunta (`overhead`, `slash`, `thrust`) × paino (`light`,
    `heavy`): ajoitus, kantama, kaari, vahinkokerroin, askel, kilven kulutus.
  - `WEAPONS`: miekka ja keihäs: vahinkokerroin (laatu), ulottuma,
    minimikantama, hitaus, sallitut iskusuunnat kertoimineen, torjuntakaari.
  - `SHIELDS`: kesto 10, torjuntakaari, loven raja 0,5. `BASH`: kilpityöntö.
  - `makeAttack(ase, suunta, paino)` yhdistää nämä. Vahinko =
    lyöjän voima (`Actor.power`) × ase × isku. Uusi aselaatu on uusi rivi
    `WEAPONS`-taulukkoon; hajontaa ei vielä ole.
- **Säännöt:** kilpi torjuu kaikki iskut ja kuluu (kevyt 1, raskas 2;
  täydellinen torjunta ei kuluta). Aseella torjunta onnistuu vain, jos
  torjunta-asento vastaa iskun suuntaa. Kilpityöntö murtaa asetorjunnan,
  mutta kilpeen se vain osuu. Raskas isku ei enää murra torjuntaa.
- **Ohjaus:** sivallus hiiren vasen / J, ylälyönti F / I, pisto E / L.
  Nappi pohjassa virittää: kun raskaan iskun viritysaika täyttyy, isku on
  raskas; vapautus laukaisee. Täyttä viritystä voi pidätellä 0,8 s.
  Torjunnan aikana iskunappi on kilven kanssa kilpityöntö ja ilman kilpeä
  torjunta-asennon vaihto.
- **HUD:** viritysmittari, kilpien kestopalkit, vastustajan tulevan iskun
  suunta nimen alla, oma torjunta-asento.
- **Kilven hajoaminen** (`src/fighter.ts`): lovi ja sirpaleet tehdään
  shaderilla kilven materiaaliin (`patchShield`, `ShieldDebris`), ei omilla
  malleilla. Pelaaja saa uuden kilven jokaiseen aaltoon.
- **Animaatio on yhä kokonaan koodia.** Uudet asennot: `slashWindup/Strike`,
  `thrustWindup/Strike`, `blockSide`, `blockThrust` (`block` on ylätorjunta,
  `windup/strike` ylälyönti). Keihään etukäsi viedään varrelle kahden luun
  käänteiskinematiikalla (`reachShaft`).
- **Tekoäly** (`pickEnemyAttack`, `src/main.ts`): arpoo iskusuunnan ja
  painon varustuksen mukaan, lyö raskaasti kilven takana seisovaa pelaajaa,
  ja aseella torjuessaan arvaa suunnan oikein sitä useammin, mitä pidemmällä
  aalloissa ollaan. Keihäällä voi vain pistää.
- **Blender-putket:** metsä `assets-src/blender/build_all.py`, hahmot
  `char_all.py` → `run_chars()`, suo `bog.py` → `build_bog()` (tyhjässä
  tiedostossa; vienti samassa kutsussa tiedoston avauksen kanssa kaatuu). Lähteet: `tools/fetch-polyhaven.ps1` ja
  `tools/fetch-characters.ps1` (ei Gitissä). `.blend`-tiedostot eivät ole
  Gitissä, eikä lähdemallien tuontia SRC-kokoelmaan ole skriptattu.
- **Deployattu:** GitHub Pages julkaisee mainin heti mergen jälkeen
  (Actions-ajo "Julkaise GitHub Pagesiin"); v00.10.00 ei ole mainissa.
  **Omistaja testaa julkaistusta osoitteesta**, ei dev-serveriltä.
- **Käsin testattu 2026-11-13** (Clauden in-app browser, dev-serveri,
  skriptattu syöte): palautuminen 2 s:ssa +2; kevyt lyönti −3, raskas −9;
  kestävyydellä 6 viritetty lyönti jää kevyeksi ja mittari kertoo syyn;
  uupuneen lyönti tekee 10 vahinkoa, kun kevyt tekee 40; torjunta-asennossa
  kestävyys ei muutu, ja uupuneena suoja laskee; uupunut vastustaja
  vetäytyy noin 3,4 m:n päähän eikä lyö; vastustajan kestävyys kuluu
  lyönneistä; palkit näkyvät ja uupuneen kehys hehkuu.
  **Ei testattu:** ihmisen pelaamana, kosketusnäyttö, buildattu versio
  selaimessa. FPS 60 (suuntaa antava; muutos ei koske renderöintiä).
- **Komennot 2026-11-13:** `bun run test` (46/46), `bun run lint`,
  `bun run build` ok.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- Savutestien apuna `window.__game`: `tick(n, dt)` ajaa peliä askelin
  ruudunpäivityksestä riippumatta, `skipTo(n)`, `showcase(true, "asento")`,
  `poses` (asentojen säätö lennossa), `setCamera(pos, look)`, `state`,
  `events` muodossa `kuka:isku/paino:tulos`, `fillSong()`, `beat()`
  (välilyönti laululle), `nextBeatIn`, `bog([x,0,z])` (suo näkyviin),
  `debrisHeights` (irtokappaleiden korkeus maasta), `root(t)` (vastustaja
  suohon), `setStamina(pelaaja, vastustaja)`, `placePlayer(x, z)`, `showcaseReach` (aseen kärjen etäisyys). Selainpaneeli pysäyttää
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
- **Kosketusnäytöllä** on vain sivallus; ylälyönnille, pistolle ja
  torjunta-asennon vaihdolle ei ole nappeja.
- **Asennot on viritetty silmämääräisesti** kuvakaappauksista. Raskaalla
  sivalluksella ja pistolla ei ole omaa asentoa (sama kuin kevyellä).
  Keihäsmiehen torjunta näyttää samalta kaikissa kolmessa asennossa.
- **Hiiren lisänapit:** jos hiiren ajuri on määrittänyt napin omaan
  toimintoonsa (makro, DPI-vaihto), selain ei näe painallusta lainkaan.
  Joissain selaimissa napit 4 ja 5 voivat silti selata historiaa.
- **Kypärän tekstuuri** on sama metallilevy kuin muissa osissa, ja kupu on
  melko sileä; lentävä kypärä voi pudota puun tai kiven läpi (ei törmäyksiä).
- **Laulun hidastus 1/20** tarkoittaa, että koko laulu (noin 5,7 s) on
  vastustajalle noin 0,3 s. Vastustaja ehtii osua vain, jos sen isku oli
  jo nostossa laulun alkaessa. Jos keskeytyksen halutaan olevan todellinen
  uhka, `SONG_SLOWMO` pitää nostaa (esim. 1/8).
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

Omistaja pelaa v00.10.00:n julkaistusta osoitteesta mergen jälkeen ja kertoo
tuntuman (kestävyyden hinnat ja palautuminen, uupuneen vastustajan
vetäytyminen, laulun vaikeus, keihäsmies). Sen perusteella säädetään
`STAMINA`-taulukon ja muiden taulukoiden luvut.

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
