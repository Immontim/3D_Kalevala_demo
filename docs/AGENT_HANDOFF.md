# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-10-31

- **Versio v00.01.00**, taisteluprototyyppi "Laulun miekka". Branch
  `claude/combat-prototype`, haarautettu `claude/agent-docs`-branchista.
  Tarkista kummankin merge-tila `git merge-base --is-ancestor` -komennolla.
- **Koodi valmis:** Three.js + TypeScript + Vite + Bun. Metsäaukio (kuusikko,
  koivut, kivet, kota, nuotio), primitiiveistä koottu hahmo, proseduraaliset
  asennot, lyönti/torjunta/täydellinen torjunta/väistö, vastustajan
  tekoäly aalloittain, laululoitsu (rytmipeli, aika hidastuu 0,12x:ään,
  onnistunut laulu laulaa vastustajan suohon).
- **Deployattu:** ei GitHub Pagesiin vielä. Työnkulku
  `.github/workflows/pages.yml` on valmis, mutta omistajan pitää kytkeä
  Pages päälle (Settings → Pages → Source: GitHub Actions). Pelattava
  esikatselu on julkaistu Claude-artifactina (yksityinen):
  https://claude.ai/artifact/ThGhwtEyDkif1jTjBucwQg
- **Käsin testattu:** Playwright + headless Chromium (ohjelmistorenderöinti,
  2–20 FPS, ei kerro oikeasta suorituskyvystä). Varmistettu: peli
  käynnistyy, vastustaja lähestyy ja hyökkää, täydellinen torjunta
  rekisteröityy, osumat vähentävät HP:ta, laulu neljällä ajoitetulla
  painalluksella → vastustaja "rooted" ja suo näkyy. Ei konsolivirheitä.
  Oikeaa FPS:ää näytönohjaimella ei ole mitattu.
- **Komennot:** `bun run test` (12 testiä ok), `bunx tsc --noEmit` ok,
  `bun run build` ok, `bun audit` puhdas, `bun outdated` tyhjä.
- **Riippuvuustarkistus:** 2026-10-31, ei mitään odottamassa.
- Savutestien apuna `window.__game` (tila, tapahtumaloki, `fillSong()`,
  `nextBeatIn`, `enemyStrikeIn`).

## Tunnetut rajoitteet ja riskit

- Osumat ratkaistaan etäisyyden ja kulman perusteella iskun lauetessa, ei
  terän todellisesta liikeradasta. Chivalry-tyyppinen terän jäljitys on
  myöhempää työtä.
- Vihollinen ei tee täydellisiä torjuntoja eikä harhautuksia.
- Kosketusnapit ovat alkeelliset, eikä liikkumista ole kosketuksella.
- Pelin aika etenee enintään 0,05 s / ruutu, joten hyvin hitaalla
  koneella koko peli hidastuu (myös laulun rytmi).
- Bundle on noin 600 kt (Three.js mukana). Ei haittaa vielä.

## Seuraava tehtävä

Omistaja pelaa esikatselua ja kertoo tuntumasta (ajoitukset, kamera,
laulun vaikeus). Sen jälkeen joko taistelun syventäminen (iskusuunnat,
terän jäljitys) tai Blender MCP -asennusharjoitus.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Oikeat 3D-mallit ja Git LFS (vasta kun Blender-putki on testattu).
- Gauntlet-loop ali-agenteilla (vasta kun suunta on lyöty lukkoon).

## Pysyvät päätökset

- Moottori: Three.js selaimessa. Claude/Codex kirjoittavat moottorin,
  fysiikan ja suuren osan animaatiosta koodina.
- Hostaus aluksi GitHub Pagesissa. Lovable on mahdollinen myöhemmin
  GitHub-synkkauksen kautta, mutta koodia ei kirjoiteta Lovablen tekoälyllä
  (kaksi tekoälyä samassa koodissa sotkisi).
- Tyyli: pronssikautinen / varhaisen rautakauden Fennoskandia.
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
