import { describe, expect, it } from "vitest";
import {
  turnToward,
  WAVES,
  groupHpScale,
  groupSize,
  graceAfter,
  graceCovers,
  mayStartAttack,
  attackStartDelay,
  hitStaggers,
  lungeProgress,
  strikeLands,
  BASH,
  SHIELDS,
  STRIKES,
  STYLES,
  WEAPONS,
  CHARACTERS,
  COMBAT,
  angleBetween,
  attackPhase,
  chargeLevel,
  damageFor,
  enemyAttackTiming,
  makeAttack,
  resolveHit,
  shieldWear,
  strikeDamage,
  styleFor,
  weaponOf,
  exhausted,
  staminaAfterBlock,
  staminaTick,
  strikeCost,
  strikeTier,
  shouldShieldBash,
  bashPushStep,
  weakened,
  ARMOUR,
  damageAfterArmour,
  helmetAbsorbsOverhead,
  BLOCK_RAISE,
  BLOCK_RAISE_DONE,
  ENEMY_AI,
  advancesInWindup,
  blockPoseRate,
  blockReactionDelay,
  rollsAdvance,
  threatenedBy,
  timeToImpact,
} from "./combat";

const sword = WEAPONS.sword;
const spear = WEAPONS.spear;
const slash = makeAttack(sword, "slash", "light");
const heavySlash = makeAttack(sword, "slash", "heavy");
const overhead = makeAttack(sword, "overhead", "light");
const swordThrust = makeAttack(sword, "thrust", "light");
const spearThrust = makeAttack(spear, "thrust", "light");
const shield = SHIELDS.round;

const inFront = { distance: 1.5, angleToDefender: 0 };
const idle = { state: "idle" as const, blockStart: 0, angleToAttacker: 0 };

describe("yleiset kertoimet", () => {
  it("noston ja palautumisen kerroin skaalaa kaikki lyönnit", () => {
    const before = makeAttack(WEAPONS.sword, "slash", "light").timing;
    COMBAT.recoveryScale = 2;
    COMBAT.windupScale = 0.5;
    const after = makeAttack(WEAPONS.sword, "slash", "light").timing;
    COMBAT.recoveryScale = 1;
    COMBAT.windupScale = 1;
    expect(after.recovery).toBeCloseTo(before.recovery * 2);
    expect(after.windup).toBeCloseTo(before.windup * 0.5);
    expect(after.release).toBe(before.release);
  });
});

describe("kestävyys", () => {
  it("hahmoilla on eri määrä kestävyyttä", () => {
    expect(CHARACTERS.hero.stamina).toBe(100);
    expect(CHARACTERS.urho.stamina).toBe(60);
    expect(CHARACTERS.pohja.stamina).toBe(80);
  });
  it("kevyt lyönti maksaa 6 ja raskas 12", () => {
    expect(strikeCost(strikeTier(50, "light"))).toBe(6);
    expect(strikeCost(strikeTier(50, "heavy"))).toBe(12);
  });
  it("raskas lyönti jää kevyeksi, jos voimat eivät riitä siihen", () => {
    expect(strikeTier(11.9, "heavy")).toBe("light");
    expect(strikeTier(12, "heavy")).toBe("heavy");
  });
  it("uupunut lyö heikosti ja ilmaiseksi: neljännes vahingosta", () => {
    expect(exhausted(5.9)).toBe(true);
    expect(exhausted(6)).toBe(false);
    expect(strikeTier(5.9, "heavy")).toBe("weak");
    expect(strikeCost("weak")).toBe(0);
    const heavy = makeAttack(WEAPONS.sword, "slash", "heavy");
    const light = makeAttack(WEAPONS.sword, "slash", "light");
    expect(weakened(light).damage).toBeCloseTo(light.damage * 0.25);
    expect(weakened(heavy).weight).toBe("light");
  });
  it("palautuu 1/s, mutta torjunta-asento kuluttaa nettomääräisesti 0,5/s", () => {
    expect(staminaTick(10, 100, 1, false, 2)).toBeCloseTo(12);
    expect(staminaTick(10, 100, 1, true, 2)).toBeCloseTo(9);
    expect(staminaTick(99.5, 100, 1, false, 2)).toBe(100);
  });
  it("hahmon oma palautumisnopeus ratkaisee", () => {
    expect(staminaTick(10, 100, 3, false, 2)).toBeCloseTo(16);
    expect(staminaTick(10, 100, 0.5, true, 2)).toBeCloseTo(8);
  });
  it("toteutunut torjunta vie 4 eikä mene alle nollan", () => {
    expect(staminaAfterBlock(10)).toBe(6);
    expect(staminaAfterBlock(1)).toBe(0);
  });
  it("keihään vahinkokerroin on 1,1", () => {
    expect(WEAPONS.spear.damage).toBe(1.1);
  });
});

describe("resolveHit", () => {
  it("osuu suojaamattomaan", () => {
    expect(resolveHit(inFront, idle, 5)).toBe("hit");
  });
  it("ohi, jos liian kaukana tai sivulla", () => {
    expect(resolveHit({ distance: slash.range + 0.1, angleToDefender: 0 }, idle, 5)).toBe("miss");
    expect(resolveHit({ distance: 1, angleToDefender: Math.PI / 2 }, idle, 5)).toBe("miss");
  });
  it("myöhään aloitettu torjunta on täydellinen torjunta", () => {
    expect(resolveHit(inFront, { state: "block", blockStart: 4.9, angleToAttacker: 0 }, 5)).toBe("parried");
  });
  it("aikaisin aloitettu torjunta on tavallinen torjunta", () => {
    expect(resolveHit(inFront, { state: "block", blockStart: 3, angleToAttacker: 0 }, 5)).toBe("blocked");
  });
  it("selän takaa tulevaa iskua ei voi torjua", () => {
    expect(resolveHit(inFront, { state: "block", blockStart: 4.95, angleToAttacker: Math.PI }, 5)).toBe("hit");
  });
  it("väistö väistää", () => {
    expect(resolveHit(inFront, { state: "dodge", blockStart: 0, angleToAttacker: 0 }, 5)).toBe("dodged");
  });
});

describe("iskusuunnat ja suuntatorjunta", () => {
  const block = (stance: "overhead" | "slash" | "thrust") => ({ state: "block" as const, blockStart: 0, angleToAttacker: 0, stance });
  it("aseella torjunta onnistuu vain oikealla asennolla", () => {
    for (const style of STYLES) {
      const a = makeAttack(sword, style, "light");
      for (const stance of STYLES) {
        expect(resolveHit(inFront, block(stance), 5, a)).toBe(stance === style ? "blocked" : "hit");
      }
    }
  });
  it("väärä asento ei anna täydellistä torjuntaakaan", () => {
    expect(resolveHit(inFront, { ...block("slash"), blockStart: 4.95 }, 5, overhead)).toBe("hit");
    expect(resolveHit(inFront, { ...block("overhead"), blockStart: 4.95 }, 5, overhead)).toBe("parried");
  });
  it("kilpi torjuu kaikki suunnat, myös raskaat", () => {
    for (const style of STYLES) {
      for (const weight of ["light", "heavy"] as const) {
        expect(resolveHit(inFront, { ...block("slash"), shield }, 5, makeAttack(sword, style, weight))).toBe("blocked");
      }
    }
  });
  it("kilpi suojaa leveämmältä kuin miekka", () => {
    // 50° sivulta: miekan sektorin (±45°) ulkopuolella, kilven (±60°) sisällä.
    const side = { ...block("slash"), angleToAttacker: (50 * Math.PI) / 180 };
    expect(resolveHit(inFront, side, 5)).toBe("hit");
    expect(resolveHit(inFront, { ...side, shield }, 5)).toBe("blocked");
  });
  it("torjunta suojaa vain edestä: kylkeen ja selkään isku osuu kilvestäkin huolimatta", () => {
    expect(sword.blockArc).toBeCloseTo(Math.PI / 4);
    expect(shield.blockArc).toBeCloseTo(Math.PI / 3);
    for (const deg of [70, 90, 180]) {
      expect(resolveHit(inFront, { ...block("slash"), shield, angleToAttacker: (deg * Math.PI) / 180 }, 5)).toBe("hit");
    }
  });
  it("kilpityöntö murtaa torjunnan asennosta ja kilvestä riippumatta", () => {
    for (const stance of STYLES) expect(resolveHit(inFront, block(stance), 5, BASH)).toBe("guardbreak");
    expect(resolveHit(inFront, { ...block("slash"), shield }, 5, BASH)).toBe("guardbreak");
    expect(resolveHit(inFront, { ...block("slash"), blockStart: 4.95 }, 5, BASH)).toBe("guardbreak");
  });
});

describe("aseet ja iskut parametreina", () => {
  it("jokaisella suunnalla on kevyt ja raskas isku: raskas on hitaampi ja kovempi", () => {
    for (const style of STYLES) {
      const l = STRIKES[style].light, h = STRIKES[style].heavy;
      expect(h.timing.windup).toBeGreaterThan(l.timing.windup);
      expect(h.damage).toBeGreaterThan(l.damage);
      expect(h.shieldDamage).toBeGreaterThan(l.shieldDamage);
    }
  });
  it("keihäs ylettää pidemmälle kuin miekka, mutta ei osu aivan lähelle", () => {
    expect(resolveHit({ distance: 3.0, angleToDefender: 0 }, idle, 5, swordThrust)).toBe("miss");
    expect(resolveHit({ distance: 3.0, angleToDefender: 0 }, idle, 5, spearThrust)).toBe("hit");
    expect(resolveHit({ distance: 1.1, angleToDefender: 0 }, idle, 5, spearThrust)).toBe("miss");
    // Kantama ja syöksy on mitoitettu mallin mukaan: 3,5 m ja 0,3 m miekkaa pidempi askel.
    expect(spearThrust.range).toBeCloseTo(3.5);
    expect(resolveHit({ distance: 3.4, angleToDefender: 0 }, idle, 5, spearThrust)).toBe("hit");
    expect(spearThrust.lunge).toBeCloseTo(swordThrust.lunge + 0.3);
  });
  it("isku osuu vasta, kun tukiaskel on otettu", () => {
    const r = swordThrust.timing.release;
    expect(strikeLands(0, r)).toBe(false);
    expect(lungeProgress(0, r)).toBe(0);
    expect(strikeLands(r * COMBAT.strikePoint - 0.001, r)).toBe(false);
    expect(lungeProgress(r * COMBAT.strikePoint - 0.001, r)).toBeLessThan(1);
    expect(strikeLands(r * COMBAT.strikePoint, r)).toBe(true);
    expect(lungeProgress(r * COMBAT.strikePoint, r)).toBeCloseTo(1);
    expect(lungeProgress(r, r)).toBe(1);
  });
  it("piston kaari on kapea: sivuaskel riittää", () => {
    expect(resolveHit({ distance: 2.2, angleToDefender: 0.6 }, idle, 5, swordThrust)).toBe("miss");
    expect(resolveHit({ distance: 2.0, angleToDefender: 0.6 }, idle, 5, slash)).toBe("hit");
  });
  it("keihäällä voi vain pistää", () => {
    expect(styleFor(spear, "slash")).toBe("thrust");
    expect(styleFor(spear, "overhead")).toBe("thrust");
    expect(styleFor(sword, "overhead")).toBe("overhead");
    expect(weaponOf("spear")).toBe(spear);
    expect(weaponOf("sword_shield")).toBe(sword);
  });
  it("kirves: lyhyempi, hitaampi ja raskaampi kuin miekka, ei pistoa, kuluttaa kilpeä enemmän", () => {
    const axe = WEAPONS.axe;
    expect(weaponOf("sword", false, true)).toBe(axe);
    expect(weaponOf("sword_shield", true, true)).toBe(axe);
    expect(weaponOf("spear", false, true)).toBe(spear);
    expect(axe.styles.thrust).toBeUndefined();
    expect(styleFor(axe, "thrust")).not.toBe("thrust");
    for (const style of ["overhead", "slash"] as const) {
      for (const weight of ["light", "heavy"] as const) {
        const a = makeAttack(axe, style, weight), s = makeAttack(sword, style, weight);
        expect(a.range).toBeLessThan(s.range);
        expect(a.timing.windup).toBeGreaterThan(s.timing.windup);
        expect(a.timing.recovery).toBeGreaterThan(s.timing.recovery);
        expect(a.damage).toBeGreaterThan(s.damage);
        expect(a.shieldDamage).toBeCloseTo(s.shieldDamage * 1.5);
      }
    }
  });
  it("vahinko on lyöjän voima × ase × isku", () => {
    expect(strikeDamage(20, slash, "hit", "idle")).toBeCloseTo(20);
    expect(strikeDamage(20, heavySlash, "hit", "idle")).toBeCloseTo(34);
    expect(strikeDamage(20, slash, "hit", "rooted")).toBeCloseTo(40);
    expect(strikeDamage(20, slash, "blocked", "block")).toBe(0);
    expect(strikeDamage(20, BASH, "guardbreak", "block")).toBeCloseTo(5);
    const fine = makeAttack({ ...sword, damage: 1.5 }, "slash", "light");
    expect(strikeDamage(20, fine, "hit", "idle")).toBeCloseTo(30);
  });
  it("hitaampi ase nostaa ja palautuu hitaammin", () => {
    expect(spearThrust.timing.windup).toBeGreaterThan(swordThrust.timing.windup);
    expect(spearThrust.timing.recovery).toBeGreaterThan(swordThrust.timing.recovery);
  });
});

describe("Pohjan soturin kilpityöntö", () => {
  it("vain kilvellinen Pohjan soturi valitsee satunnaisen kilpityönnön", () => {
    expect(shouldShieldBash(true, true, 1.2, 0, false, false, 0.11)).toBe(true);
    expect(shouldShieldBash(true, true, 1.2, 0, false, false, 0.12)).toBe(false);
    expect(shouldShieldBash(false, true, 1.2, 0, false, false, 0)).toBe(false);
    expect(shouldShieldBash(true, false, 1.2, 0, false, false, 0)).toBe(false);
  });

  it("pitkä torjunta laukaisee liikkeen, mutta ei pikavastaiskuna, sivulle tai kantaman ulkopuolelle", () => {
    expect(shouldShieldBash(true, true, 1.2, 0, true, false, 1)).toBe(true);
    expect(shouldShieldBash(true, true, 1.2, 0, true, true, 0)).toBe(false);
    expect(shouldShieldBash(true, true, BASH.range, 0, true, false, 0)).toBe(false);
    expect(shouldShieldBash(true, true, 1.2, BASH.arc, true, false, 0)).toBe(false);
  });

  it("taaksehorjahdus etenee tasaisesti eikä ylitä jäljellä olevaa matkaa", () => {
    expect(bashPushStep(0.65, 0.1)).toBeCloseTo(0.26);
    expect(bashPushStep(0.1, 0.1)).toBeCloseTo(0.1);
    expect(bashPushStep(0.65, 0)).toBe(0);
    expect(bashPushStep(0.65, 0.1, true)).toBe(0);
  });
});

describe("kilven kesto", () => {
  const blocking = { state: "block" as const, blockStart: 0, angleToAttacker: 0, shield };
  it("kestää 10 kevyttä tai 5 raskasta iskua", () => {
    expect(shield.durability / shieldWear(slash, "blocked", blocking)).toBe(10);
    expect(shield.durability / shieldWear(heavySlash, "blocked", blocking)).toBe(5);
  });
  it("täydellinen torjunta ja ohi mennyt isku eivät kuluta kilpeä", () => {
    expect(shieldWear(heavySlash, "parried", blocking)).toBe(0);
    expect(shieldWear(heavySlash, "miss", blocking)).toBe(0);
    expect(shieldWear(slash, "blocked", { ...blocking, shield: null })).toBe(0);
  });
});

describe("kääntyminen", () => {
  it("kääntyy enintään askeleen verran lyhyempää kautta", () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(turnToward(0, -1, 0.25)).toBeCloseTo(-0.25);
    expect(turnToward(0, 0.1, 0.25)).toBeCloseTo(0.1);
    // 3,0 rad -> -3,0 rad: lyhin tie kulkee PI:n yli, ei nollan kautta.
    expect(turnToward(3.0, -3.0, 0.1)).toBeCloseTo(3.1);
  });
});

describe("ajoitukset", () => {
  it("iskun vaiheet etenevät järjestyksessä", () => {
    const t = slash.timing;
    expect(attackPhase(0, t)).toBe("windup");
    expect(attackPhase(t.windup + 0.01, t)).toBe("release");
    expect(attackPhase(t.windup + t.release + 0.01, t)).toBe("recovery");
    expect(attackPhase(10, t)).toBe("done");
  });
  it("vihollisen nosto lyhenee aalloittain mutta ei juuri alle pelaajan noston", () => {
    expect(enemyAttackTiming(slash, 2).windup).toBeLessThan(enemyAttackTiming(slash, 1).windup);
    expect(enemyAttackTiming(slash, 50).windup).toBeCloseTo(slash.timing.windup - 0.02);
  });
  it("viritysmittari täyttyy raskaan iskun viritysajassa", () => {
    expect(chargeLevel(0, heavySlash)).toBe(0);
    expect(chargeLevel(heavySlash.timing.windup / 2, heavySlash)).toBeCloseTo(0.5);
    expect(chargeLevel(5, heavySlash)).toBe(1);
  });
  it("suohon laulettu ottaa tuplavahingon", () => {
    expect(damageFor(20, "rooted")).toBe(40);
    expect(damageFor(20, "rooted", 1)).toBe(20); // Louhen suo ei tuplaa vartijoiden iskuja
    expect(damageFor(20, "idle")).toBe(20);
  });
  it("kulmaero kiertyy välille -PI..PI", () => {
    expect(angleBetween(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
  });
});

describe("usea vastustaja", () => {
  it("aallon koko kasvaa: 1, sitten 2, sitten 3", () => {
    expect(groupSize(1)).toBe(1);
    expect(groupSize(WAVES.twoFrom - 1)).toBe(1);
    expect(groupSize(WAVES.twoFrom)).toBe(2);
    expect(groupSize(WAVES.threeFrom - 1)).toBe(2);
    expect(groupSize(WAVES.threeFrom)).toBe(3);
    expect(groupSize(40)).toBe(3);
  });
  it("ryhmässä yksittäisen vastustajan elämä on pienempi, mutta ryhmän yhteensä suurempi", () => {
    expect(groupHpScale(1)).toBe(1);
    expect(groupHpScale(2)).toBeLessThan(1);
    expect(groupHpScale(3)).toBeLessThan(groupHpScale(2));
    expect(2 * groupHpScale(2)).toBeGreaterThan(1);
    expect(3 * groupHpScale(3)).toBeGreaterThan(2 * groupHpScale(2));
  });
  it("torjunta antaa suoja-ajan, täydellinen torjunta pidemmän", () => {
    expect(graceAfter("blocked")).toBe(COMBAT.graceBlock);
    expect(graceAfter("parried")).toBe(COMBAT.graceParry);
    expect(graceAfter("parried")).toBeGreaterThan(graceAfter("blocked"));
    expect(graceAfter("hit")).toBe(0);
    expect(graceAfter("guardbreak")).toBe(0);
  });
  it("suoja-aika pysäyttää muiden iskut torjutusta suunnasta, ei saman lyöjän eikä sivulta tai takaa tulevia", () => {
    const arc = Math.PI / 3;
    const deg = Math.PI / 180;
    expect(graceCovers(10, 10.5, false, 0, arc, 0)).toBe(true);
    expect(graceCovers(10, 10.5, false, 0, arc, -(COMBAT.graceArc - 1) * deg)).toBe(true);
    // Toisesta suunnasta tuleva osuu, vaikka olisi katseen edessä.
    expect(graceCovers(10, 10.5, false, 0, arc, (COMBAT.graceArc + 1) * deg)).toBe(false);
    // Torjunnan oman sektorin ulkopuolelta tuleva osuu, vaikka suunta täsmäisi.
    expect(graceCovers(10, 10.5, false, arc + deg, arc, 0)).toBe(false);
    expect(graceCovers(10, 10.5, false, Math.PI, arc, 0)).toBe(false);
    expect(graceCovers(10, 10.5, true, 0, arc, 0)).toBe(false);
    expect(graceCovers(10.6, 10.5, false, 0, arc, 0)).toBe(false);
  });
  it("hyökkäyskatto: paikan saa kuka tahansa, kun lyöjiä on alle katon", () => {
    expect(ENEMY_AI.maxAttackers).toBe(2);
    expect(mayStartAttack(0)).toBe(true);
    expect(mayStartAttack(1)).toBe(true);
    expect(mayStartAttack(2)).toBe(false);
    expect(mayStartAttack(1, 1)).toBe(false);
    expect(mayStartAttack(2, 3)).toBe(true);
    // Katto ei voi estää kaikkia: yksi saa aina lyödä.
    expect(mayStartAttack(0, 0)).toBe(true);
  });
  it("iskun aloitusviive arvotaan rajojen sisältä", () => {
    expect(attackStartDelay(0)).toBeCloseTo(ENEMY_AI.attackDelayMin);
    expect(attackStartDelay(1)).toBeCloseTo(ENEMY_AI.attackDelayMax);
    expect(attackStartDelay(0.5)).toBeGreaterThan(attackStartDelay(0.1));
    expect(ENEMY_AI.attackDelayMax).toBeGreaterThan(ENEMY_AI.attackDelayMin);
  });
  it("horjuva ei horjahda uudelleen: jatko-osuma tekee vain vahingon", () => {
    expect(hitStaggers("slash", "hit", "idle", 10, -1)).toBe(true);
    expect(hitStaggers("slash", "hit", "windup", 10, -1)).toBe(true);
    expect(hitStaggers("slash", "hit", "recovery", 10, -1)).toBe(false);
    expect(hitStaggers("slash", "hit", "stagger", 10, -1)).toBe(false);
    expect(hitStaggers("bash", "hit", "stagger", 10, -1)).toBe(false);
    expect(hitStaggers("bash", "hit", "recovery", 10, -1)).toBe(true);
    expect(hitStaggers("bash", "guardbreak", "block", 10, -1)).toBe(true);
    expect(hitStaggers("bash", "hit", "rooted", 10, -1)).toBe(false);
    expect(hitStaggers("slash", "blocked", "block", 10, -1)).toBe(false);
  });
  it("horjahduksen jälkeen hetki, jolloin osumat eivät horjuta", () => {
    expect(hitStaggers("slash", "hit", "idle", 10, 10.3)).toBe(false);
    expect(hitStaggers("bash", "guardbreak", "block", 10, 10.3)).toBe(false);
    expect(hitStaggers("slash", "hit", "idle", 10.3, 10.3)).toBe(true);
  });
});

describe("vastustajan torjuntareaktio ja etenevä nosto", () => {
  const deg = Math.PI / 180;
  it("torjunta-asennon animaatio valmistuu BLOCK_RAISE-ajassa (sama tahti kuin ennen, nopeus ~22)", () => {
    for (const l of ["sword", "sword_shield", "spear"] as const) {
      expect(blockPoseRate(l)).toBeCloseTo(22, 0);
      expect(1 - Math.exp(-blockPoseRate(l) * BLOCK_RAISE[l])).toBeCloseTo(BLOCK_RAISE_DONE, 5);
    }
  });
  it("osumahetki lasketaan noston jäljellä olevasta ajasta ja iskun osumakohdasta", () => {
    const t = swordThrust.timing;
    expect(timeToImpact(0, t)).toBeCloseTo(t.windup + t.release * COMBAT.strikePoint);
    expect(timeToImpact(t.windup + 1, t)).toBeCloseTo(t.release * COMBAT.strikePoint);
  });
  it("jokainen arpa antaa eri viiveen, ja asento ehtii aina nousta ennen nopeinta iskua", () => {
    const impact = timeToImpact(0, swordThrust.timing);
    const raise = BLOCK_RAISE.sword;
    const a = blockReactionDelay(impact, raise, 0)!, b = blockReactionDelay(impact, raise, 1)!;
    expect(a).toBeCloseTo(ENEMY_AI.blockDelayMin);
    expect(b).toBeCloseTo(ENEMY_AI.blockDelayMax);
    expect(b + raise).toBeLessThanOrEqual(impact);
  });
  it("viiveen yläraja lyhenee myöhään, ja liian myöhään (tai liian hitaalla asennolla) ei torjuta", () => {
    expect(blockReactionDelay(0.2, 0.086, 1)).toBeCloseTo(0.2 - 0.086);
    expect(blockReactionDelay(0.1, 0.086, 0.5)).toBeNull();
    // Tuleva hidas keihästorjunta: sama isku ei enää ehdi.
    expect(blockReactionDelay(0.3, 0.29, 0)).toBeNull();
  });
  it("vain iskun edessä oleva harkitsee torjuntaa", () => {
    expect(threatenedBy(0, overhead.arc)).toBe(true);
    expect(threatenedBy(overhead.arc + (ENEMY_AI.threatMargin - 1) * deg, overhead.arc)).toBe(true);
    expect(threatenedBy(-(overhead.arc + (ENEMY_AI.threatMargin + 1) * deg), overhead.arc)).toBe(false);
    expect(threatenedBy(Math.PI / 2 + 0.1, slash.arc)).toBe(false);
  });
  it("etenevä nosto arvotaan iskukohtaisesti, ei kilpityönnölle", () => {
    expect(rollsAdvance("slash", ENEMY_AI.advanceChance - 0.01)).toBe(true);
    expect(rollsAdvance("thrust", ENEMY_AI.advanceChance)).toBe(false);
    expect(rollsAdvance("bash", 0)).toBe(false);
  });
  it("eteneminen vain kantaman reunalla ja pelaajan ollessa edessä", () => {
    const r = spearThrust.range;
    expect(advancesInWindup(true, r, r, 0)).toBe(true);
    expect(advancesInWindup(false, r, r, 0)).toBe(false);
    expect(advancesInWindup(true, r - ENEMY_AI.advanceKeep - 0.01, r, 0)).toBe(false);
    expect(advancesInWindup(true, r, r, (ENEMY_AI.advanceArc + 1) * deg)).toBe(false);
    // Keihäsmies pysähtyy kauas: ei koskaan alle oman minimietäisyytensä.
    expect(r - ENEMY_AI.advanceKeep).toBeGreaterThan(spearThrust.minRange);
  });
});

describe("taivaanrautamiekka (V6)", () => {
  it("on sama miekka mutta mitattavasti tehokkaampi: 30 % enemmän vahinkoa jokaisella iskulla", () => {
    expect(weaponOf("sword")).toBe(WEAPONS.sword);
    expect(weaponOf("sword_shield", false)).toBe(WEAPONS.sword);
    expect(weaponOf("sword", true)).toBe(WEAPONS.sky_iron_sword);
    expect(weaponOf("sword_shield", true)).toBe(WEAPONS.sky_iron_sword);
    expect(weaponOf("spear", true)).toBe(WEAPONS.spear);                // keihäs ei muutu
    const base = WEAPONS.sword, sky = WEAPONS.sky_iron_sword;
    expect(sky.damage / base.damage).toBeCloseTo(1.3, 5);
    for (const style of STYLES) {
      for (const weight of ["light", "heavy"] as const) {
        const a = makeAttack(base, style, weight), b = makeAttack(sky, style, weight);
        expect(b.damage / a.damage).toBeCloseTo(1.3, 5);
        // Ajoitus, kantama ja kulma ovat samat: ero on vain vahingossa.
        expect(b.timing).toEqual(a.timing);
        expect(b.range).toBe(a.range);
        expect(b.arc).toBe(a.arc);
      }
    }
    expect(sky.blockArc).toBe(base.blockArc);
    expect(sky.styles).toEqual(base.styles);
  });
});

describe("puettavat suojavarusteet", () => {
  it("rengaspaita ja säärisuojat vähentävät vahinkoa erikseen ja yhdessä", () => {
    expect(damageAfterArmour(100, false, false)).toBe(100);
    expect(damageAfterArmour(100, true, false)).toBeCloseTo(100 * ARMOUR.ringMailDamage);
    expect(damageAfterArmour(100, false, true)).toBeCloseTo(100 * ARMOUR.greavesDamage);
    expect(damageAfterArmour(100, true, true)).toBeCloseTo(80.75);
  });

  it("vain ylälyönti voi irrottaa kypärän ja irtoamistodennäköisyys riippuu painosta", () => {
    expect(helmetAbsorbsOverhead("slash", "heavy", true, true, 0)).toBe(false);
    expect(helmetAbsorbsOverhead("overhead", "heavy", false, true, 0)).toBe(false);
    expect(helmetAbsorbsOverhead("overhead", "light", true, false, 0.24)).toBe(true);
    expect(helmetAbsorbsOverhead("overhead", "light", true, false, 0.25)).toBe(false);
    expect(helmetAbsorbsOverhead("overhead", "heavy", true, false, 0.59)).toBe(true);
    expect(helmetAbsorbsOverhead("overhead", "heavy", true, false, 0.6)).toBe(false);
  });

  it("muuten kuolettava ylälyönti irrottaa kypärän varmasti", () => {
    expect(helmetAbsorbsOverhead("overhead", "light", true, true, 0.999999)).toBe(true);
  });
});
