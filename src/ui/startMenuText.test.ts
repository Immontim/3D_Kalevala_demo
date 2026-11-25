import { describe, expect, it } from "vitest";
import { friendlySceneSubtitleKey } from "./startMenuText";

describe("rauhallisen kohtauksen aloitusruudun alaotsikko", () => {
  it("käyttää sepän pajan omaa tekstiä eikä yleistä pihatekstiä", () => {
    expect(friendlySceneSubtitleKey("smithy")).toBe("smithy.sub");
  });

  it("säilyttää muiden rauhallisten kohtausten avaimet", () => {
    expect(friendlySceneSubtitleKey("yard")).toBe("yard.sub");
    expect(friendlySceneSubtitleKey("lakeside")).toBe("lakeside.sub");
    expect(friendlySceneSubtitleKey("lakeruin")).toBe("lakeruin.sub");
    expect(friendlySceneSubtitleKey("cairnfield")).toBe("cairnfield.sub");
    expect(friendlySceneSubtitleKey("wilds")).toBe("wilds.sub");
  });
});
