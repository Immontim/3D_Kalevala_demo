# AGENTS.md — 3D Kalevala

Tämä on projektin **ainoa sääntötiedosto**. Se koskee Claudea, Codexia ja
muita agentteja. `CLAUDE.md` vain viittaa tänne; älä kopioi sääntöjä sinne.

## Mikä tämä projekti on

Selaimessa pyörivä 3D-roolipeli Kalevalan aihepiiristä, ja ennen muuta
**hands-on harjoitus AI-avusteisesta 3D-kehityksestä** (Claude, Codex,
Blender MCP).

- Pelimaailma on kartta, jolla liikutaan. Tietyissä paikoissa siirrytään
  3D-tilaan, jossa toimitaan.
- Keskeinen toiminta on ajoitukseen ja taitoon perustuva lähitaistelu.
- Loitsut **lauletaan**: laulu tapahtuu taistelun lomassa bullet time
  -tyyppisesti hidastettuna aikana.
- Visuaalinen maailma on pronssikautinen tai varhaisen rautakauden
  Fennoskandia, ei keskieurooppalainen ritarikeskiaika.
- **PC-peli hiirelle ja näppäimistölle.** Kosketusnäyttöjä ei tueta eikä
  niitä varten suunnitella ohjausta (omistajan päätös 2026-11-14).
  Liikkuminen on vapaata, koska kaikki pelissä ei tule olemaan taistelua
  (RPG-osuudet).
- Tekninen pohja (suunniteltu): Three.js + TypeScript + Vite, paketinhallinta
  Bun, testit Vitest. Hostaus staattisena sivuna (GitHub Pages).

Tavoite on kunnianhimoinen, mutta rehellisyys on tärkeämpää kuin myötäily:
jos jokin ei ole realistista (selaimen suorituskyky, työmäärä,
tokenkiintiö), sano se ja perustele.

## Tiimi ja työtapa

- **Timo (Immontim)** — omistaja ja suunnittelija. Ei koodari eikä
  3D-mallintaja. Ymmärtää koodia jonkin verran, mutta **ei lue diffejä eikä
  tee koodikatselmointia.**
- Selitä muutokset aina proosana: mitä pelissä muuttui ja miksi. Älä pyydä
  katsomaan diffiä.
- Kerro riskit ja epävarmuudet itse, koska kukaan muu ei huomaa niitä koodista.
- **Vastaan saa ja pitää sanoa.** Arvioi ideat kahdesta näkökulmasta:
  1. **Koodimielessä** — onko idea työläs tai hauras nykyiseen koodipohjaan.
  2. **Pelimielessä** — toimiiko se pelattavana 3D-taisteluna, ja jaksaako
     selain sen (FPS, muisti, latausaika).

## Gauntlet-loop (alitöiden jako)

Isommat kokonaisuudet tehdään gauntlet-looppina:

1. Pääagentti (orkestroija) pilkkoo työn rajattuihin alitöihin, joilla on
   selkeä hyväksymiskriteeri (esim. "hahmon lyöntianimaatio, 0,4 s,
   osumaikkuna 0,15–0,25 s").
2. Alityöt annetaan ali-agenteille, ja rutiinityöt halvemmille malleille.
3. Orkestroija tarkistaa jokaisen tuloksen itse (testit, ajo selaimessa,
   kuvakaappaus) ja palauttaa korjattavaksi, kunnes kriteeri täyttyy.
4. Kirjaa handoffiin, mitä loopissa hylättiin ja miksi, jos se ohjaa
   seuraavaa työtä.

Seuraa kulutusta: jos työ uhkaa syödä tokenkiintiön, pysähdy ja kerro
omistajalle ennen jatkamista.

## 3D-assetit

- Mallit tehdään Blenderissä (myös Blender MCP:n kautta) ja viedään
  **glTF/GLB**-muodossa kansioon `assets/`.
- Blenderin lähdetiedostot (`.blend`) kansioon `assets-src/`.
- Isot binäärit (`.glb`, `.blend`, tekstuurit) Git LFS:ään, kun LFS on otettu
  käyttöön. Älä committaa yli 50 Mt:n tiedostoja tavalliseen Gitiin.
- Kirjaa ulkopuolisten assettien lähde ja lisenssi tiedostoon
  `assets/CREDITS.md` (esim. Poly Haven CC0, Mixamo).
- **Suorituskykybudjetti:** tavoite 60 FPS tavallisella pelikoneella.
  Raportoi FPS muutoksen yhteydessä, jos muutos vaikuttaa renderöintiin.

## Versiokäytäntö

Aina kun koodi muuttuu, nostetaan versionumeroa (muoto `vNN.NN.NN`, näkyy
pelissä):

- **Iso muutos** (moottorin rakenne, datamalli, iso refaktorointi) →
  ensimmäinen segmentti
- **Feature** → toinen segmentti
- **Fiksi tai pieni viilaus** → kolmas segmentti

Päivitä versionumero koodiin ja rivi `docs/VERSION.md`-taulukkoon. Pelkät
dokumenttimuutokset eivät nosta versiota.

## Handoff: kontekstiin mahtuva, ei hautausmaa

`docs/AGENT_HANDOFF.md` on kanoninen **nykytila**. Lue se ennen suunnittelua.
Se siirtää työn koneiden (kotikone, läppäri), Clauden ja Codexin välillä.

**Handoffin pitää mahtua agentin kontekstiin ja sisältää vain olennaiset,
ajankohtaiset asiat.** Se ei ole versiohistoria.

- Kokoraja: **noin 300 riviä / 20 kt**. Jos raja ylittyy, karsi ennen kuin
  lisäät uutta.
- Osio "Nykytila" **kirjoitetaan uudelleen** jokaisessa päivityksessä, eikä
  sen perään lisätä uutta osiota.
- Versiokohtaiset muutoskuvaukset menevät `docs/VERSION.md`:hen, ei
  handoffiin.
- Valmis ja vahvistettu asia poistetaan handoffista. Se jää jäljelle vain,
  jos siitä seuraa voimassa oleva rajoite tai päätös.
- Pysyvät päätökset ja rajoitteet pidetään omassa lyhyessä osiossaan.
  Vanhentunut päätös poistetaan, ei yliviivata.

Jokainen agentti, joka saa valmiiksi olennaisen toteutustyön, päivittää
handoffin samassa muutoksessa: päivämäärä, branch ja commit; erikseen
"koodi valmis", "deployattu" ja "käsin testattu"; ajetut komennot ja
tulokset; avoimet riskit; **yksi seuraava tehtävä** ja lista asioista, joita
ei vielä saa aloittaa.

## Uudella koneella

Älä luota olemassa olevaan `node_modules`-kansioon, kun toisen koneen työ
on vedetty.

1. Tarkista branch ja `git status`.
2. Varmista, että Bun on asennettu.
3. `bun install --frozen-lockfile`
4. `bun run test`, `bun run lint`, `bun run build`
5. Kirjaa komento, jota ei voitu ajaa, ja syy. "Ei ajettu" ei ole "meni läpi".

## Riippuvuuksien ylläpito

Projekti käyttää Bunia ja versionhallittua `bun.lock`-tiedostoa. Älä sekoita
mukaan npm-, pnpm- tai Yarn-komentoja.

Ennen olennaista toteutustyötä tarkista handoffista viimeisin
riippuvuustarkistus. Jos se on yli 7 päivää vanha tai puuttuu, aja
`bun outdated --no-cache` ja `bun audit`. Raja on aktiivisuuspohjainen:
levossa oleva projekti ei vaadi viikoittaista ajoa.

Tarkistus päättyy aina yhteen kolmesta lopputuloksesta, joka **sanotaan
omistajalle selkokielellä** ennen kuin työ jatkuu:

- **Ei mitään odottamassa.** Kirjaa päivämäärä ja jatka.
- **Jotain odottaa** (audit-löydös tai rajojen sisäinen päivitys).
  **Ehdota päivitysajoa** omana branchinaan, kerro pahimman löydöksen
  käytännön merkitys ja odota lupaa. Älä aloita hiljaa äläkä ohita hiljaa.
- **Vain rajojen ulkopuolisia majoreita.** Nimeä ne ja jatka.

"Siirretty" tarkoittaa vain rajojen ulkopuolista majoria, jolla on nimetty
syy odottaa. Rajojen sisäinen päivitys joko otetaan tai omistaja kieltäytyy
siitä perustellusti.

Bun-huomiot: `bun update` ratkoo uudelleen vain suorat riippuvuudet, joten
puhdas `bun outdated` ei tarkoita puhdasta `bun audit`ia. Apupaketin
löydös vaatii `bun.lock`-tiedoston poiston ja `bun install`in.
**Älä aja `bun update <apupaketti>`** — se lisää paketin suoraksi
riippuvuudeksi.

Päivityksen jälkeen aja `bun ci`, `bun audit`, `bun run test`,
`bunx tsc --noEmit`, `bun run lint`, `bun run build`, ja avaa buildattu peli
selaimessa (`bun run preview`). Onnistunut build ei yksin riitä.

## Savutestit

Oletustapa on käynnistää paikallinen dev-serveri ja avata peli
`localhost`-osoitteessa agentin sisäisessä selaimessa (Codexin tai Clauden
in-app browser). Tarkista renderöinti, ohjaus, konsolivirheet ja FPS.
Ulkoista selainta käytetään vain, jos testi sitä erikseen vaatii; kirjaa syy.

## Olemassa olevien tiedostojen formatointi

Älä aja Prettieriä tai muuta koko tiedoston formatoijaa olemassa oleviin
tiedostoihin osana muuta muutosta. Formatoi vain lisäämäsi tai olennaisesti
muokkaamasi rivit.

## Git-työnkulku

- Claude työskentelee `claude/`-alkuisissa brancheissa, Codex
  `codex/`-alkuisissa. Ei suoria committeja `main`iin ilman nimenomaista
  pyyntöä.
- Valtuutetun toteutustehtävän jälkeen agentti tarkistaa statuksen ja
  diffin, stageaa **vain tehtävän omat tiedostot** (ei sokeaa `git add -A`),
  committaa ja pushaa branchin itse. Ilmoita branch ja commit lyhyesti.
- Lukeva tutkiminen, suunnittelu ja katselmointi eivät valtuuta committeja.
- Force push, rebase/amend/squash julkaistuun historiaan, PR:n avaaminen ja
  mergeäminen, branchin poisto ja julkaisu vaativat omistajan nimenomaisen
  ohjeen.
- **Omistaja avaa ja mergeää PR:n.** Agentti kirjoittaa kuvauksen: yhden
  commitin branchissa commit-viesti on PR:n kuvaus (ongelma, lopputulos,
  olennaiset toteutusyksityiskohdat, ajetut tarkistukset). Usean commitin
  branchissa anna valmis otsikko ja kuvaus kopioitavana lohkona.
- Älä tulosta rutiininomaisia git-komentoja jo tehdyn työn vahvistukseksi.
  Kopioitavat komennot vain fallbackina, jos agentti ei pysty tekemään
  vaihetta turvallisesti itse.

### Onko branch jo mergattu? Tarkista, älä päättele

Omistaja mergeää usein heti pushin jälkeen mainitsematta siitä. Paikallinen
`main`, handoffin merkinnät tai avoimien PR:ien lista eivät kerro
merge-tilaa.

1. `git fetch origin`
2. `git merge-base --is-ancestor <branch> origin/main` — exit 0 tarkoittaa
   mergattua.
3. Mergattua branchia ei jatketa: uusi työ uuteen branchiin `origin/main`in
   päältä.

Handoffiin ei kirjoiteta "odottaa mergeä", vaan branchin nimi ja muistutus
tarkistaa tila näin.
