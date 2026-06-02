import { describe, expect, it } from "vitest";
import { normalizeSlotBase } from "../src/aem/slot-naming.ts";

describe("normalizeSlotBase", () => {
  it("leaves clean, hand-named keys untouched", () => {
    expect(normalizeSlotBase("content")).toBe("content");
    expect(normalizeSlotBase("media")).toBe("media");
    expect(normalizeSlotBase("fileReference")).toBe("fileReference");
  });

  it("strips creation-timestamp suffixes", () => {
    expect(normalizeSlotBase("content1732069919")).toBe("content");
    expect(normalizeSlotBase("content_1793623844")).toBe("content");
    expect(normalizeSlotBase("item_1657754806454")).toBe("item");
  });

  it("strips copy markers + paste ids (underscore forms)", () => {
    expect(normalizeSlotBase("content_1793623844_c")).toBe("content");
    expect(normalizeSlotBase("content_1893078103_c_100046160")).toBe("content");
    expect(normalizeSlotBase("content_202924930_co")).toBe("content");
    expect(normalizeSlotBase("content_202924930_co_1141959053")).toBe("content");
    expect(normalizeSlotBase("title_1967938466_cop")).toBe("title");
    expect(normalizeSlotBase("title_1967938466_cop_1581547696")).toBe("title");
    expect(normalizeSlotBase("title_copy")).toBe("title");
    expect(normalizeSlotBase("title_copy_copy_copy_576180305")).toBe("title");
    expect(normalizeSlotBase("title_copy_44665454_")).toBe("title");
  });

  it("strips copy markers (already-camelCased forms)", () => {
    expect(normalizeSlotBase("content1732069919C1240033211")).toBe("content");
    expect(normalizeSlotBase("content1732069919C")).toBe("content");
    expect(normalizeSlotBase("titleCopy")).toBe("title");
    expect(normalizeSlotBase("titleCopyCopy")).toBe("title");
    expect(normalizeSlotBase("title1967938466Cop")).toBe("title");
    expect(normalizeSlotBase("hrCopy")).toBe("hr");
    expect(normalizeSlotBase("image_copy")).toBe("image");
    expect(normalizeSlotBase("image_copy_copy")).toBe("image");
  });

  it("collapses every observed sibling to the same base", () => {
    const keys = [
      "content",
      "content_1793623844",
      "content_1793623844_c",
      "content_1893078103_c_100046160",
      "content_1006122976",
      "content1732069919C1240033211",
    ];
    const bases = new Set(keys.map(normalizeSlotBase));
    expect([...bases]).toEqual(["content"]);
  });

  it("does not over-strip real words that merely end in copy-like letters", () => {
    // The copy-marker rules are anchored to genuine trailing suffix tokens
    // (a separator/digit boundary), so words ending in `co`/`copy` survive.
    expect(normalizeSlotBase("hero_company")).toBe("hero_company");
    expect(normalizeSlotBase("disco")).toBe("disco");
    expect(normalizeSlotBase("heroCard")).toBe("heroCard");
  });

  it("never returns an empty string", () => {
    expect(normalizeSlotBase("1732069919")).not.toBe("");
    expect(normalizeSlotBase("C1240033211")).not.toBe("");
  });
});
