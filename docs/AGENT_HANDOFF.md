# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-10 (Claude, kotikone, Windows)

- **Versio v00.02.00**, branch `claude/forest-clearing` (tarkista merge-tila
  `git merge-base --is-ancestor`). Edelliset branchit on mergetty mainiin.
- **Koodi valmis:** taisteluprototyyppi (lyönti, torjunta, väistö, aallot,
  laululoitsu) ja uusi metsäaukio Blender-putkella. `src/world.ts` lataa
  `assets/forest.glb`:n (30 prototyyppimallia, 5 Mt) ja sijoittelee ne
  instansseina: 423 puuta (mänty, kuusi, koivu), varvikko, heinät, saniaiset,
  kivet, kelot, kota, nuotio. Maasto sekoittaa kolmea skannattua pintaa
  shaderissa. Nuotio: shader-liekki, kipinät, savu, lepattava valo.
  Jälkikäsittely `main.ts`:ssä (hehku, sävytys, vinjetti, MSAA säilyy).
- **Blender-putki:** skriptit `assets-src/blender/`; koko ajo
  `build_all.py` → `run()` (atlas → puut → propit → vienti). Lähdeassetit
  haetaan `tools/fetch-polyhaven.ps1`:llä (140 Mt, ei Gitissä).
  `forest_clearing.blend` (83 Mt) ei ole Gitissä: uudella koneella aja
  haku, tuo glTF:t SRC-kokoelmaan (ks. Blender MCP -historia / `props.py`:n
  odottamat objektinimet) ja aja `build_all.py`. **Tuontivaihetta ei ole
  skriptattu** — se on aukko, jos .blend katoaa.
- **Deployattu:** GitHub Pages https://immontim.github.io/3D_Kalevala_demo/
  julkaisee mainin. v00.02.00 ei ole vielä mainissa.
- **Käsin testattu 2026-11-10** (Clauden in-app browser, dev-serveri):
  renderöinti, taistelun käynnistys, ei konsolivirheitä. **60 FPS, hitain
  ruutu 17 ms, 1280×720, noin 2,0 milj. kolmiota, RTX 4080 Super.**
  Koko näytön tarkkuutta, keskitason konetta ja mobiilia ei ole mitattu.
  Huom: piilotettu selainpaneeli kuristaa ruudut ~1 FPS:ään.
- **Komennot 2026-11-10:** `bun run test` (12/12), `bun run lint`,
  `bun run build` ok. Bundle 709 kt + assetit 7,8 Mt.
- **Riippuvuustarkistus:** 2026-11-10, ei mitään odottamassa.
- **Arviointi (ali-agentti, kuvakaappauksista):** kierros 1 noin 30–35 %
  Chivalry 2 -tasosta, kierros 2 noin 50 %; arvioijan mukaan selaimen katto
  on noin 65–70 %. Kolmatta korjausta (nuotion hehku, utu, varvikon
  kirkkaus, kiven sävy) ei ole arvioitu uudelleen.
- Savutestien apuna `window.__game` (tila, `fillSong()`,
  `setCamera([x,y,z],[x,y,z])` vapaa kamera, `setCamera(null)` takaisin)
  ja `window.__world` (puiden ja kolmioiden määrä).

## Tunnetut rajoitteet ja riskit

- **Suorituskyky on mitattu vain tehokoneella.** 2 milj. kolmiota, 4096²
  varjokartta ja jälkikäsittely voivat olla liikaa integroidulle
  näytönohjaimelle. LOD-malleja ja laatuasetusta ei ole.
- Hahmot ovat yhä primitiivejä ja näyttävät vierailta uudessa metsässä.
- Avoimet grafiikkaviat (arvioijan lista): kodassa ei näkyvää oviaukkoa
  aukiolle päin ja reuna on liian siisti; uhrikivi on ruskea eikä harmaa
  graniitti; latvukset näyttävät vastavalossa paperisilta; varvikon
  alfa-reunat voivat väreillä liikkeessä (ei varmistettu); nuotion valo ei
  näy päivänvalossa ympäristössä; ei tuulta (kasvit eivät liiku).
- Puiden runkoihin ja kiviin ei voi törmätä; aukion raja on yhä ympyrä.
- Blender-skriptien polut on kovakoodattu (`C:DataD Kalevala`).
- Osumat ratkaistaan etäisyyden ja kulman perusteella, ei terän liikeradasta.
- Vihollinen ei tee täydellisiä torjuntoja eikä harhautuksia.
- Kosketusnapit ovat alkeelliset, eikä liikkumista ole kosketuksella.
- Pelin aika etenee enintään 0,05 s / ruutu: hitaalla koneella peli hidastuu.

## Seuraava tehtävä

Omistaja pelaa uuden metsäaukion (mieluiten koko näytöllä ja myös
läppärillä) ja kertoo tuntuman ja FPS:n. Sen perusteella joko grafiikan
seuraava kierros (avoimet viat yllä, tuuli, LOD/laatuasetus) tai hahmojen
mallinnus Blenderissä.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Git LFS (omistajan päätös 2026-11-10: ei vielä; GLB:t pidetään pieninä ja
  .blend poissa Gitistä).
- Isojen skannattujen puiden (Poly Haven, 0,5 Gt/kpl) lataus ja kevennys.

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
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
