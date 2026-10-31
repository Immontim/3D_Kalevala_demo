# Agent handoff — 3D Kalevala

Kanoninen nykytila. Pidä tämä alle noin 300 rivin / 20 kt:n.
Säännöt: `AGENTS.md`, kohta "Handoff: kontekstiin mahtuva, ei hautausmaa".

## Nykytila

Päivitetty: 2026-10-31

- Repo luotu, ja siinä on vain README sekä agenttiohjeet (AGENTS.md,
  CLAUDE.md, tämä tiedosto, .gitignore). Ei vielä koodia eikä
  `package.json`-tiedostoa.
- Versio: ei vielä versioitua buildia.
- Hostaus: ei vielä. Suunnitelma on GitHub Pages.
- Riippuvuustarkistus: ei vielä tehty (ei riippuvuuksia).
- Blender ja Blender MCP: ei asennettu omistajan koneelle (Windows).

## Seuraava tehtävä

Vaihe 1: pieni selainprototyyppi (Three.js + TypeScript + Vite, Bun).
Metsäaukio, kaksi paikkamerkkihahmoa, ajoitukseen perustuva lyönti ja
torjunta, ja laululoitsu, joka hidastaa aikaa. Versio v00.01.00.

## Ei vielä aloiteta

- Karttanäkymä ja siirtymät karttaan/3D-paikkoihin.
- Oikeat 3D-mallit ja Git LFS (vasta kun Blender-putki on testattu).
- Gauntlet-loop ali-agentteineen (vasta kun prototyyppi pyörii).

## Pysyvät päätökset

- Moottori: Three.js selaimessa. Claude/Codex kirjoittavat moottorin,
  fysiikan ja suuren osan animaatiosta koodina.
- Hostaus aluksi GitHub Pagesissa. Lovable on mahdollinen myöhemmin
  GitHub-synkkauksen kautta, mutta koodia ei kirjoiteta Lovablen tekoälyllä
  (kaksi tekoälyä samassa koodissa sotkisi).
- Tyyli: pronssikautinen / varhaisen rautakauden Fennoskandia.
