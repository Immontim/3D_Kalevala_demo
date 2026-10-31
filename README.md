# 3D Kalevala demo

Selaimessa pyörivä 3D-roolipeli Kalevalan aihepiiristä ja AI-avusteisen
3D-kehityksen harjoitus. Ensimmäinen prototyyppi on "Laulun miekka":
miekkataistelu metsäaukiolla ja laululoitsu, joka hidastaa ajan.

## Ajaminen

Tarvitset [Bunin](https://bun.sh).

```
bun install
bun run dev
```

Avaa selaimessa osoite, jonka komento tulostaa (yleensä http://localhost:5173).

Muut komennot: `bun run test`, `bun run build`, `bun run preview`.

## Ohjaus

- WASD: liiku ja kierrä vastustajaa
- Hiiren vasen tai J: isku
- Hiiren oikea tai K pohjassa: torjunta (juuri ennen osumaa = täydellinen torjunta)
- Shift: väistö
- Q: laula, kun laulun voima on täynnä; paina välilyöntiä tahdissa

Agenttien säännöt: `AGENTS.md`. Nykytila: `docs/AGENT_HANDOFF.md`.
