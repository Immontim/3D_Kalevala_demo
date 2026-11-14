// Hahmon kyvyt: perusarvot taulukoista ja niiden päälle ajonaikaiset muuntimet.
// Puhdasta logiikkaa, ei Three.js-riippuvuuksia.
//
// Perusarvot tulevat hahmon rivistä (CHARACTERS) ja aallosta (WAVES). Kaikki, mikä muuttaa
// kykyjä pelin aikana (ruoka, nälkä, loitsut, esineet), lisätään muuntimena: peli lukee aina
// lopulliset arvot funktiolla effectiveStats, joten uusi vaikutus ei vaadi muutoksia taisteluun.

import { CHARACTERS, WAVES } from "./combat";

export interface Stats {
  maxHp: number;
  maxStamina: number;
  /** Kestävyyden palautuminen sekunnissa. */
  staminaRegen: number;
  /** Lyöjän voima: vahingon perusarvo ennen aseen ja iskun kertoimia. */
  power: number;
  /** Kävelynopeus, m/s. */
  moveSpeed: number;
  /** Otetun vahingon kerroin (1 = normaali, alle 1 = suojaa). */
  damageTaken: number;
  /** Suurin kääntymisnopeus, astetta sekunnissa. */
  turnSpeed: number;
  /** Reaktioviive sekunteina (vastustajan tekoäly). */
  reaction: number;
}
export type StatName = keyof Stats;

/**
 * Yksi vaikutus yhteen kykyyn. Ensin lasketaan kaikki lisäykset (add), sitten kertoimet (mul).
 * `until` on pelin aika, jolloin vaikutus loppuu; ilman sitä vaikutus on pysyvä, kunnes se poistetaan.
 */
export interface Modifier {
  /** Tunniste, jolla vaikutus korvataan tai poistetaan (esim. "ruoka:leipä"). */
  id: string;
  stat: StatName;
  add?: number;
  mul?: number;
  until?: number;
}

/** Hahmon perusarvot. Vastustajilla aalto kasvattaa elämää ja voimaa; pelaajalla aalto on 0. */
export function baseStats(character: string, wave = 0): Stats {
  const c = CHARACTERS[character] ?? CHARACTERS.pohja;
  return {
    maxHp: c.hp + WAVES.hpPerWave * wave,
    maxStamina: c.stamina,
    staminaRegen: c.staminaRegen,
    power: c.power + WAVES.powerPerWave * wave,
    moveSpeed: c.moveSpeed,
    damageTaken: 1,
    turnSpeed: c.turnSpeed,
    reaction: c.reaction,
  };
}

export function activeModifiers(mods: readonly Modifier[], now: number): Modifier[] {
  return mods.filter((m) => m.until === undefined || m.until > now);
}

/** Lopulliset arvot: perusarvot ja voimassa olevat muuntimet. Mikään arvo ei mene alle nollan. */
export function effectiveStats(base: Stats, mods: readonly Modifier[], now: number): Stats {
  const out = { ...base };
  const live = activeModifiers(mods, now);
  for (const m of live) if (m.add) out[m.stat] += m.add;
  for (const m of live) if (m.mul !== undefined) out[m.stat] *= m.mul;
  for (const k of Object.keys(out) as StatName[]) out[k] = Math.max(0, out[k]);
  return out;
}

/** Lisää muuntimen tai korvaa samalla tunnisteella olevan. */
export function withModifier(mods: readonly Modifier[], mod: Modifier): Modifier[] {
  return [...mods.filter((m) => m.id !== mod.id), mod];
}
