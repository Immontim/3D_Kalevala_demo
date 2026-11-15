import { afterEach, describe, expect, it } from "vitest";
import { getLanguage, setLanguage, t, verbatim } from "./i18n";

afterEach(() => setLanguage("fi"));

describe("kielitekstit", () => {
  it("vaihtaa suomen ja englannin välillä", () => {
    setLanguage("fi");
    expect(t("start.begin")).toBe("Aloita");
    setLanguage("en");
    expect(t("start.begin")).toBe("Begin");
    expect(getLanguage()).toBe("en");
  });

  it("sijoittaa parametrit tekstiin", () => {
    setLanguage("en");
    expect(t("wave.title", { wave: 4 })).toBe("Wave 4");
  });

  it("merkitsee alkuperäiskielisen tekstin erikseen", () => {
    expect(verbatim("Lauloi vanha Väinämöinen:", "fi", "Kalevala 3")).toEqual({
      kind: "verbatim", text: "Lauloi vanha Väinämöinen:", lang: "fi", source: "Kalevala 3",
    });
  });
});
