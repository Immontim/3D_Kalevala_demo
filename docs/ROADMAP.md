# Roadmap — 3D Kalevala

Päivitetty: 2026-11-17 (Claude; pohja `origin/main` `809398a`, koodiversio v04.03.00 branchilla `claude/song-learning`).

Tämä on **suunta ja päätökset**, ei tehtävälista. Nykytila ja yksi seuraava
tehtävä ovat `docs/AGENT_HANDOFF.md`:ssä, mallien ja assettien tila
`docs/BLENDER_HANDOFF.md`:ssä. Älä toista niitä täällä. Päivitä tämä vain, kun
omistaja päättää suunnasta jotain uutta; valmis vaihe poistetaan tai tiivistetään
yhteen riviin.

Prosessi: kyseessä on keskeneräinen harjoitus- ja kokeiluprojekti, ja se pysyy
sellaisena pitkään. **Tärkeintä on aito pelattava MVP**, ei koko pääjuonen,
sivutehtävien tai moottorin täydellinen toteutus.

## MVP

Pelattava kaari (noin 30–45 min), jonka voi pelata alusta loppuun yhdellä
tallennuksella:

1. **Huhu.** Pohjan akan lähettämät vainolaiset ovat liikkeellä. Sankari lähtee
   etsimään heidän leiriään.
2. **Tietäjä järven rannalla opettaa laulun** (`lakeside`).
3. **Louhetar karkotetaan** kalmistolla (`cairnfield`) laulamalla juuri tuo laulu
   onnistuneesti. Taistelua Louhea vastaan ei MVP:ssä ole.
4. **Vainolaisten leiri paljastuu** kartalle.
5. **Aaltotaistelu leirillä** (`clearing`, olemassa oleva `skirmish.ts`).
6. **Voitto ja loppuruutu.**

**Vaihtoehtopolku (valinnainen):** kaksi rauhallista pihapiiriä, jotka sankari
voi löytää. Molemmista saa ruokaa. Toisessa (satunnaisesti valitussa) on
jousineito, joka antaa **taivaanrautamiekan**, kun hänelle laulaa parannuslaulun
onnistuneesti. Polun voi jättää väliin, mutta miekka helpottaa loppuaaltoja.

Pääjuonen suuri kaari (omistajan suunnittelema, ei muutu ilman häntä): Pohjan
akka on lähettänyt vainolaisia Kalevalan väen kiusaksi, juuri kun sankarit ovat
hakemassa taivaasta pudonnutta rautaa (omistajan taustamyytti, Saarenmaan
meteoriitti; historiallista paikkansapitävyyttä ei ole tarkistettu, pelille
riittää myytti). Yksi iso talon urho lähtee etsimään vainolaisia. Leirissä ei
pärjää ilman koulutusta: laulujen taikaa tietäjiltä ja parempia varusteita.
Täysi kaari sisältää useamman tietäjän, sepän, kanteleen veistäjän ja bossin;
ne ovat MVP:n jälkeen.

## Mitä on jo olemassa

| Tarve | Tila |
|---|---|
| Piha (`yard`), emäntä, tietäjä, jousineito, eläimet | Valmis kohtaus, kartalla kahtena satunnaisena instanssina (V3); puhe näyttää vain nimen (dialogi vain rannan tietäjällä) |
| Järven ranta (`lakeside`), tietäjä, laituri | Valmis kohtaus, kartalla; tietäjällä dialogi ja tuohikontin lupa/varkaus (V1–V2) |
| Hävitetty ranta (`lakeruin`) | Valmis, ei vielä käytössä seurauksena |
| Kalmisto (`cairnfield`), Louhi NPC:nä, suoloitsun efekti | Valmis kohtaus, kartalla |
| Aaltotaistelu (`clearing`, `skirmish.ts`) | Valmis |
| Laulut `bog`, `heal`, viisi laulupaikkaa, rytmimekaniikka | Valmis; kolmas laulu puuttuu |
| Esineet, inventaario, otto 3D-kohtauksesta, varkausloki | Valmis (PR #56) |
| Kylläisyys, kuukalenteri, 2D→3D→2D-silta | Valmis |
| `CampaignStore`, maailmamoottori v0, dialogi v0 | Valmis (V1–V2, v04.00.00): liput, laskurit, ehdot, efektit, tapahtumat, `__world` |

Puuttuu: laulun opettelu, Louhen karkotus, leirin päätös ja loppuruutu,
satunnaiset pihapiirit, taivaanrautamiekka, laulu- ja paikkatapahtumat moottoriin.

## Vaiheet

Järjestys on riippuvuusjärjestys. Jokaisella vaiheella on hyväksymiskriteeri;
orkestroija tarkistaa sen itse (testit, selain) ennen seuraavaa (gauntlet-loop).

**V1–V2 (valmis, v04.00.00).** `CampaignStore` on 3D:n yksi tilan omistaja
(`update(fn)`), ja maailmamoottori v0 (`src/world/`: liput, laskurit, ehdot, efektit,
tapahtumat `item.taken`/`npc.talked`/`scene.entered`, suomenkielinen yhteenveto,
`intent`-lause jokaiselle säännölle, konsoli `__world`, salliva moottorilohko) ja
dialogi v0 ovat käytössä; pelisisältö on tietäjä + tuohikontti. Moottoriin puuttuu
vielä efektit "avaa laulu" ja "paljasta paikka" sekä tapahtuma `song.performed`:
lisätään V5:ssä, kun sille on käyttäjä (`song.performed` on jo olemassa). Tilannetiedot: `AGENT_HANDOFF.md`.

**V3 (valmis, v04.02.00).** Kampanjassa on `worldSeed` ja konkretisoidut `siteInstances`;
kaksi pihaa arvotaan säännöillä ja validaattorilla, ja jousineito on vain toisessa.
Sama `yard`-kohtaus ajetaan kahtena instanssina (`yard`, `yard-b`), esine-ID:t
saavat instanssin nimen. Vanha tallennus säilyttää pihansa tunnisteella `yard`.
Tilannetiedot: `AGENT_HANDOFF.md`. Löydettävyys ja etäisyydet säädetään V8:ssa.

**V4 (valmis, v04.03.00).** Tietäjä opettaa laulun **Pohjolan uni** (Kalevala runo 42);
harjoitus käyttää olemassa olevaa rytmimekaniikkaa, onnistuminen asettaa lipun
`song.sleep.learned`, ja laulu ilmestyy laulupaikkaan (F3). Moottoriin tuli tapahtuma
`song.performed` ja efekti `startSongLesson`. Laulun vaikutus tulee V5:ssä.

**V5. Louhen karkotus laululla.** Laulun onnistunut suoritus kalmistolla
Louhen läheisyydessä asettaa lipun, Louhi poistuu kohtauksesta ja leirin
karttapaikka paljastuu (`knownSiteIds`). Epäonnistuminen ei estä uutta yritystä
eikä rankaise. Valmis, kun karkotus toimii kerran ja pysyy tallennettuna sivun
uudelleenlatauksen yli.

**V6. Jousineidon haara.** Song-järjestelmään tarvitaan laulun kohteeksi
rauhallinen NPC (`heal` on nyt itseen vaikuttava ja `needsEnemy: false`).
Jousineito on loukkaantunut (istuu tai makaa olemassa olevalla asennolla);
onnistuneesta parannuslaulusta hän antaa uuden esineen `sky_iron_sword`.
Mukaan: esinedefinitio, aseen arvot `tuning.ts`:ssä, `combatLoadout`-kartoitus,
taivaanrautamiekan malli (Blender). Valmis, kun miekka voidaan ottaa vain
laulamalla, se näkyy kädessä 3D:ssä ja sillä on mitattava ero perusmiekkaan.

**V7. Leiri ja loppu.** Leiri on kartalla vasta V5:n jälkeen. Aaltotaistelun
voitto päättää kampanjan: loppuruutu ja "jatka / aloita alusta". Valmis, kun
koko peli pelataan alusta loppuun yhdellä tallennuksella ja uuden matkan voi
aloittaa.

**V8. Pelitestaus ja julkaisu.** Omistaja pelaa, me säädämme (stamina,
vaikeus, ruoan määrä, kuinka löydettävissä pihat ovat). Mukaan tallennuksen
vienti ja tuonti tiedostona, jotta virheellisen tilan voi antaa
toistettavaksi, ja abstrakti läpipeluutesti (liput ja tapahtumat, ei 3D):
pääpolku on aina läpäistävissä, valinnaiset polut eivät lukitse peliä.
Deployaus GitHub Pagesiin.

**Rinnakkainen Blender-raide** (ei estä koodia): taivaanrautamiekka,
loukkaantuneen jousineidon asento, leirin propit, laulun opetusanimaatio.
Sepän paja ja kanteleen veistäjä vasta MVP:n jälkeen.

## MVP:n jälkeen (ehdotettu järjestys)

1. Seppä ja parempi miekka seppänä (toinen tapa hankkia varuste).
2. Ajastimet ja `unless`-peruutus: esim. rannan tuho (`lakeruin`) seurauksena,
   jos vainolaiset ehtivät ensin. Aika kuluu vain 2D-kartan liikkeestä.
3. Tietäjän kala-apajan vesihaltia (Ahti, Vellamo tai vetehinen) ja kanteleen
   veistäjä (hauenleuka ja koivu) lisätietäjän tehtävinä.
4. Jousi tai heittokeihäs (avaa hirvenpyynnin), sitten hiiviskely.
5. Louhi-taistelu mallina ja animaatioina, bossi leirissä.
6. Proseduraaliset alijuonet: mallipohjat, joissa on paikat (antaja, paikka,
   esine, vastustaja, käänne) ja rajoitteet. Seikkailun alussa siemen sitoo ne,
   ja tulos konkretisoituu tavallisiksi säännöiksi. Tarvitsee dialogin ja
   riittävästi verbejä. Mukana suomen taivutus (nimille tallennetaan sijamuodot
   tai tekstit kirjoitetaan taivutusta välttäen), ei ajonaikaista tekoälyä.
7. Tarvittaessa pidempi tallennus (useita paikkoja, IndexedDB); pilvitallennus
   vasta, kun siihen on konkreettinen syy.

## Pysyvät päätökset (tämän roadmapin)

- **3D-kohtaukset eivät kuluta maailma-aikaa.** Aika kertyy 2D-kartan liikkeestä;
  kohtauksessa vietetty aika voi edistää maailmaa vain nimetyllä efektillä.
- Karttageneraattoria ei tehdä. Kartta on Codexin kerralla luoma ja saa elää
  käsin muokaten; satunnaistetaan vain pihapiirien paikat ja jousineidon talo.
- Louhi karkotetaan MVP:ssä tietäjän opettamalla laululla, ei taistelulla.
- MVP:ssä on yksi tietäjä.
- Tallennus pysyy selaimessa (`localStorage`) siihen asti, kunnes jokin
  konkreettinen tarve (laitteiden välinen tallennus, jaettu maailma) ilmaantuu.
  Tietokantaa tai ulkoista palvelua ei hankita ennakolta.
- Tapahtumat ja juonen säännöt ovat tyypitettyä dataa (ei omaa skriptikieltä,
  ei `eval`ia). Omistaja ei kirjoita eikä lue niitä: hän kertoo toiveen,
  agentit kirjoittavat säännöt ja moottori tulostaa ne proosana hyväksyttäväksi.
- Jokaiselle pakolliselle juonikäänteelle on oltava toinen reitti tai se ei saa
  voida menettää pysyvästi. Validaattori tarkistaa tämän.
- Satunnaisuudelle varataan erilliset satunnaisvirrat (sijoitus, alijuonet,
  tapahtumien arvonta), ja arvonnan tulos tallennetaan tilaan eikä sitä arvota
  uudelleen latauksessa.

## Riskit ja avoimet kysymykset

- **Tallennuksen lukitseminen.** `parseCampaign` hylkää koko tallennuksen yhden
  virheen takia, ja `loadCampaign` aloittaa silloin hiljaa uuden pelin. Moottorin
  lohko luetaan sallivasti, ja rikkinäinen tallenne kopioidaan talteen
  ennen korvaamista.
- **Skeemamuutosten päällekkäisyys.** Kampanjan kentät (`campaign.ts`, `storage.ts`,
  `sites.ts`) muuttuvat usein; tee ne yksi kerrallaan mergen jälkeen, älä rinnakkain.
  V1–V3 lisäsivät kenttiä ilman skeemanumeron nostoa (sallivasti luettuina).
- **Laulun kohteeksi rauhallinen NPC (V6)** on pienehkö mutta oikea
  muutos laulujärjestelmään (nyt vain vihollinen tai itse).
- **Löydettävyys.** Satunnaiset pihat voivat jäädä löytämättä tai olla liian
  kaukana. Validaattori rajaa etäisyyden, mutta vain pelitestaus kertoo, onko
  se hauskaa. Ruoan määrä ja kylläisyyden kuluminen (0,05/yksikkö) säädetään
  V8:ssa.
- **Huhun kulku.** Pihojen paikat vaihtelevat, joten huhu tietäjästä ei voi
  tulla pihalta. Ehdotus: alkuteksti kertoo huhun ja merkitsee tietäjän rannan
  tunnetuksi alusta; pihat löytyvät tutkimalla. **Omistaja vahvistaa.**
- **Tietäjän ehto.** Ehdotus: laulun saa opettelemalla (rytmiharjoitus),
  ei lisätehtävällä. Uhraus Ahdille tai muu tehtävä lisätään MVP:n jälkeen.
  **Omistaja vahvistaa.**
- **Louhi-taistelu on suurin yksittäinen työ** (malli, animaatiot,
  Encounter). Tästä syystä se on tarkoituksella MVP:n ulkopuolella.
- **Bundle-koko.** 3D-chunk on noin 803 kt ja varoittaa buildissa. Uudet
  mallit (miekka, leirin propit) kasvattavat sitä; seuraa koko ja kolmiomäärä
  jokaisessa vaiheessa.
