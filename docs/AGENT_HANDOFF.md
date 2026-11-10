# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-11-10 (Claude, kotikone, Windows)

- **Versio v00.01.01**, taisteluprototyyppi "Laulun miekka". Sen branchit
  (`claude/agent-docs`, `claude/combat-prototype`) on mergetty mainiin.
- **Viimeisin branch:** `claude/deps-update` (vite 8.3.7, vitest 5.1.0,
  `.claude/launch.json`, tämä handoff). Ei pelikoodimuutosta, ei
  versionnostoa. Tarkista merge-tila `git merge-base --is-ancestor`.
- **Koodi valmis:** Three.js + TypeScript + Vite + Bun. Metsäaukio (kuusikko,
  koivut, kivet, kota, nuotio), primitiiveistä koottu hahmo, proseduraaliset
  asennot, lyönti/torjunta/täydellinen torjunta/väistö, vastustajan
  tekoäly aalloittain, laululoitsu (rytmipeli, aika hidastuu 0,12x:ään,
  onnistunut laulu laulaa vastustajan suohon).
- **Deployattu:** GitHub Pagesissa https://immontim.github.io/3D_Kalevala_demo/
  (repo julkinen; ensimmäinen onnistunut ajo 2026-11-10, käsin käynnistetty).
  Jokainen push mainiin julkaisee uudelleen `.github/workflows/pages.yml`:n
  kautta. Vanha Claude-artifact-esikatselu (yksityinen):
  https://claude.ai/artifact/ThGhwtEyDkif1jTjBucwQg
- **Käsin testattu:** pilvessä Playwright + headless Chromium (taistelu,
  täydellinen torjunta, laulu → suo, hiiren lukitus ja tauko).
  2026-11-10 kotikoneella Clauden in-app browserissa: dev- ja
  preview-build renderöityvät, taistelu käynnistyy, ei konsolivirheitä.
- **Ensimmäinen oikea FPS:** 60 FPS (vsync-katto, hitain ruutu 17 ms)
  taistelun aikana, RTX 4080 Super, ikkuna 800×600. Koko näytön
  tarkkuutta ja keskitason konetta ei ole mitattu. Huom: jos selainpaneeli
  on piilossa, selain kuristaa ruudut ~1 FPS:ään — mittaa vain näkyvänä.
- **Komennot 2026-11-10 (`claude/deps-update`):** `bun ci`, `bun audit`
  (puhdas), `bun run test` (12/12), `bunx tsc --noEmit`, `bun run lint`,
  `bun run build` — kaikki ok. Buildi varoittaa ~600 kt:n chunkista.
- **Riippuvuustarkistus:** 2026-11-10, rajojen sisäiset päivitykset
  otettu, `bun outdated` tyhjä, audit puhdas.
- `.claude/launch.json`: konfiguraatiot `dev` (5173) ja `preview` (4173)
  in-app browserin `preview_start`ia varten.
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
- `bun.lock` on muotoa `lockfileVersion: 2`, joten vaaditaan Bun 1.4 tai
  uudempi (1.3 ei osaa lukea sitä). Kotikoneella Bun 1.4.4.
- Laulun säkeet otetaan Kalevalasta (1849, vapaa käyttää).
