# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-11 (Claude, kotikone, Windows)

- **Versio v00.04.00**, branch `claude/loadout-combat` (tarkista merge-tila
  `git merge-base --is-ancestor`). Metsäaukio (v00.02.00) ja Blender-hahmot
  (v00.03.00) ovat mainissa.
- **Koodi valmis: varustuskohtainen taistelu.** Säännöt ovat puhtaana
  logiikkana tiedostossa `src/combat.ts` (taulukko `ATTACKS`, `resolveHit`,
  `strikeDamage`, `attackFor`, `enemyAttackTiming`), testit vieressä.
  - **Sivallus** (`slash`): perusisku, kantama 2,3 m.
  - **Raskas isku** (`heavy`): iskunappi pohjassa yli 0,24 s. Hidas nosto,
    vahinko 1,8×, murtaa miekalla tai keihäällä tehdyn torjunnan (puolet
    vahingosta läpi ja horjahdus). Kilpi kestää sen.
  - **Pisto** (`thrust`): keihään ainoa isku. Kantama 3,3 m, kapea kaari
    (sivuaskel väistää), ei osu alle 1,3 m:n päähän.
  - **Kilpityöntö** (`bash`): isku torjunnan aikana, vain kilven kanssa.
    Nopea ja lyhyt, vahinko 0,25×, murtaa minkä tahansa torjunnan, ei
    keskeytä jo alkanutta iskua.
  - Kilpi torjuu leveämmältä (120° puolikulma) kuin ase (82°). Täydellinen
    torjunta pysäyttää kaikki iskut. Suojan murtanut toipuu 0,25 s nopeammin,
    murrettu horjuu 0,9 s.
- **Tekoäly varustuksen mukaan** (`pickEnemyAttack` tiedostossa
  `src/main.ts`): keihäsmies pitää 2,7 m välimatkaa ja perääntyy, kilpimies
  torjuu useammin ja työntää kilvellä, jos pelaaja seisoo torjunnassa yli
  0,7 s, pelkkä miekkamies lyö raskaasti 35 % iskuista.
- **Animaatio on yhä kokonaan koodia** (`src/fighter.ts`): `Pose`-nivelkulmat
  muunnetaan luiden kierroiksi "virtuaalisen rangan" kautta. Uutta:
  `stride` (haara-asento, vasen jalka edessä), asennot `heavyWindup`,
  `heavyStrike`, `bashWindup`, `bashStrike`, ja isku siirtää hahmoa askeleen
  eteen (`AttackDef.lunge`).
- Pelaaja on sankari (miekka ja kilpi). Vastustajat kiertävät urho/pohja ×
  miekka, miekka+kilpi, keihäs.
- **Blender-putket:** metsä `assets-src/blender/build_all.py`, hahmot
  `char_all.py` → `run_chars()`. Lähteet: `tools/fetch-polyhaven.ps1` ja
  `tools/fetch-characters.ps1` (ei Gitissä). `.blend`-tiedostot eivät ole
  Gitissä, eikä lähdemallien tuontia SRC-kokoelmaan ole skriptattu.
- **Deployattu:** GitHub Pages julkaisee mainin; v00.04.00 ei ole mainissa.
- **Käsin testattu 2026-11-11** (Clauden in-app browser, dev-serveri,
  näppäinsyöte skriptillä): sivallus, raskas isku ja kilpityöntö lähtevät
  oikeista syötteistä; keihäsmies pistää 2,7 m päästä; kilpimies murtaa
  pelaajan pitkän torjunnan ja lyö perään; ei konsolivirheitä.
  **60 FPS** / 800×710 / RTX 4080 Super hahmojen kanssa.
  **Ei testattu:** ihmisen pelaamana (tuntuma, tasapaino), kosketusnäyttö,
  buildattu versio selaimessa.
- **Komennot 2026-11-11:** `bun run test` (21/21), `bun run lint`,
  `bun run build` ok.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- Savutestien apuna `window.__game`: `skipTo(n)` vaihtaa vastustajan aallon
  n vastustajaan (3 = keihäs, 4 = kilpi), `showcase(true, "heavyStrike")`
  asettaa hahmorivin annettuun asentoon, `setCamera(pos, look)` vapaa
  kamera, `events` listaa iskut muodossa `kuka:isku:tulos`.

## Tunnetut rajoitteet ja riskit

- **Tasapainoa ei ole pelitestattu.** Luvut (kantamat, ajoitukset, vahingot)
  ovat ensimmäinen arvaus. Epäilyt: keihäsmies on avuton, jos pelaaja pysyy
  iholla; kilpivastustaja voi olla sitkeä, koska pelaajan raskas isku ei
  murra kilpeä (keinot: kilpityöntö, sivusta kiertäminen, täydellinen
  torjunta, laulu).
- **Raskas isku tulee nappia pitämällä**, joten nopea näpäytys on sivallus.
  Jos se tuntuu epätarkalta, vaihtoehto on oma nappi.
- Vihollisen isku ei näytä tyyppiään muuten kuin asennolla ja noston
  pituudella; terän hehku on kaikissa sama.
- **Hahmojen avoimet viat:** kasvot ilman tekstuuria, rengaspanssari varjossa
  lähes musta, tukeva vartalo, hiukset sileä "verho", peukalo ei kierry
  kahvan ympäri, keihään etukäsi ei osu varteen (ei IK:ta), helma voi venyä
  haara-asennossa.
- Suorituskyky on mitattu vain tehokoneella; LOD-malleja tai
  laatuasetusta ei ole. Metsässä 2 milj. kolmiota, hahmoissa 28 000 / kpl.
- Metsän avoimet viat: kodan oviaukko, ruskea uhrikivi, paperiset
  latvukset vastavalossa, ei tuulta, puihin ei voi törmätä.
- Blender-skriptien polut on kovakoodattu (`C:\Data\3D Kalevala`).
- Osumat ratkaistaan etäisyyden ja kulman perusteella, ei terän liikeradasta.
- Kosketusnapit ovat alkeelliset, eikä liikkumista ole kosketuksella.

## Seuraava tehtävä

Omistaja pelaa v00.04.00:n ja kertoo tuntuman. Sen perusteella säädetään
iskujen luvut (`ATTACKS` ja tekoälyn todennäköisyydet) ja päätetään, hiotaanko
seuraavaksi hahmojen ulkoasua vai lisätäänkö taisteluun iskusuunnat.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Git LFS (omistajan päätös 2026-11-10: ei vielä).
- Muut referenssihahmot (tietäjä, emäntä, Louhi, jousineito, isäntä).
- Isojen skannattujen puiden lataus ja kevennys.
- Suuntatorjunta ja iskusuunnat (vasen/oikea/ylä) ennen kuin nykyiset neljä
  iskua on pelitestattu.

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
