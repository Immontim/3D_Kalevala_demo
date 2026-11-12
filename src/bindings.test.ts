import { describe, expect, it } from "vitest";
import { DEFAULT_BINDINGS, actionFor, assign, clearSlot, codeLabel, mouseCode, parseBindings } from "./bindings";

describe("näppäinsidonnat", () => {
  it("oletukset: hiiren vasen on sivallus ja oikea torjunta", () => {
    expect(actionFor(DEFAULT_BINDINGS, mouseCode(0))).toBe("slash");
    expect(actionFor(DEFAULT_BINDINGS, mouseCode(2))).toBe("block");
    expect(actionFor(DEFAULT_BINDINGS, "KeyF")).toBe("overhead");
    expect(actionFor(DEFAULT_BINDINGS, "KeyZ")).toBeNull();
    expect(actionFor(DEFAULT_BINDINGS, "")).toBeNull();
  });
  it("hiiren lisänapit 4 ja 5 voi sitoa suoraan", () => {
    let b = assign(DEFAULT_BINDINGS, "overhead", 0, mouseCode(3));
    b = assign(b, "thrust", 0, mouseCode(4));
    expect(actionFor(b, "Mouse3")).toBe("overhead");
    expect(actionFor(b, "Mouse4")).toBe("thrust");
    expect(actionFor(b, "KeyF")).toBeNull();
  });
  it("sama nappi ei jää kahdelle toiminnolle", () => {
    const b = assign(DEFAULT_BINDINGS, "thrust", 1, "KeyJ");
    expect(actionFor(b, "KeyJ")).toBe("thrust");
    expect(b.slash).toEqual(["Mouse0", ""]);
  });
  it("sidonta ei muuta alkuperäistä", () => {
    assign(DEFAULT_BINDINGS, "song", 1, "KeyT");
    expect(DEFAULT_BINDINGS.song).toEqual(["KeyQ", ""]);
  });
  it("varattuja näppäimiä ei voi sitoa", () => {
    for (const c of ["KeyW", "Space", "Escape", "KeyR"]) expect(assign(DEFAULT_BINDINGS, "slash", 0, c)).toBe(DEFAULT_BINDINGS);
  });
  it("paikan voi tyhjentää", () => {
    expect(clearSlot(DEFAULT_BINDINGS, "block", 1).block).toEqual(["Mouse2", ""]);
  });
  it("tallennettu asetus luetaan ja rikkinäinen korjataan", () => {
    const saved = JSON.parse(JSON.stringify(assign(DEFAULT_BINDINGS, "overhead", 0, "Mouse3")));
    expect(parseBindings(saved).overhead).toEqual(["Mouse3", "KeyI"]);
    expect(parseBindings(null)).toEqual(DEFAULT_BINDINGS);
    expect(parseBindings("roskaa")).toEqual(DEFAULT_BINDINGS);
    const broken = parseBindings({ slash: ["KeyW", 5], block: "x", thrust: ["KeyP", "KeyP"] });
    expect(broken.slash).toEqual(["", ""]);
    expect(broken.block).toEqual(DEFAULT_BINDINGS.block);
    expect(broken.thrust).toEqual(["KeyP", ""]);
  });
  it("osittain tallennettu asetus ei jätä samaa nappia kahdelle", () => {
    const b = parseBindings({ song: ["KeyJ", ""] });
    expect(actionFor(b, "KeyJ")).toBe("song");
    expect(b.slash).toEqual(["Mouse0", ""]);
  });
  it("napeilla on luettavat nimet", () => {
    expect(codeLabel("Mouse0")).toBe("Hiiren vasen");
    expect(codeLabel("Mouse3")).toBe("Hiiren nappi 4");
    expect(codeLabel("Mouse7")).toBe("Hiiren nappi 8");
    expect(codeLabel("KeyJ")).toBe("J");
    expect(codeLabel("F13")).toBe("F13");
    expect(codeLabel("")).toBe("–");
  });
});
