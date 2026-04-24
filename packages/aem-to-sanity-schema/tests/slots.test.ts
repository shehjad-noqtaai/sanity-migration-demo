import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { discoverSlots } from "../src/slots.ts";

/**
 * Slot discovery is run over raw extracted AEM trees. We don't want to
 * re-download content for tests, so the scanner takes plain JSON trees
 * directly and is asserted on the resulting `parent → slotKey → childTypes`
 * map.
 */
describe("slots: discoverSlots", () => {
  it("captures named slots on a non-container parent", () => {
    // Minimal media-paragraph shape from David's Bridal: the dialog-less
    // `content` child is a nested `aem-integration/components/content` block.
    const root = {
      "sling:resourceType": "aem-integration/components/page",
      root: {
        "sling:resourceType": "wcm/foundation/components/responsivegrid",
        media_paragraph_copy: {
          "sling:resourceType": "aem-integration/components/media-paragraph",
          headline1: "title",
          content: {
            "sling:resourceType": "aem-integration/components/content",
            text: "<p>hi</p>",
          },
        },
      },
    };

    const slots = discoverSlots([root]);
    const mpSlots = slots.get("aem-integration/components/media-paragraph");
    assert.ok(mpSlots, "media-paragraph should have slots");
    const contentSlot = mpSlots!.get("content");
    assert.ok(contentSlot, "content slot should be discovered");
    assert.equal(contentSlot!.childTypes.size, 1);
    assert.ok(
      contentSlot!.childTypes.has("aem-integration/components/content"),
    );
  });

  it("records slot entries even on structural passthroughs' descendants", () => {
    // The page + responsivegrid wrappers are structural (no slot tracking
    // for their children), but real components inside them still track
    // their own slots. Regression guard against over-pruning.
    const root = {
      "sling:resourceType": "aem-integration/components/page",
      container: {
        "sling:resourceType": "aem-integration/components/box",
        body: {
          "sling:resourceType": "aem-integration/components/content",
          text: "hi",
        },
      },
    };
    const slots = discoverSlots([root]);
    const boxSlots = slots.get("aem-integration/components/box");
    assert.ok(boxSlots);
    assert.ok(boxSlots!.has("body"));
  });

  it("collects multiple child types at the same slot key when they exist", () => {
    // Two pages both nest a `main` child on the same parent type, but one
    // page uses `content` as the child type and the other uses `quote`.
    // Scanner must report both types — the emitter is responsible for
    // deciding what to do with multi-type slots.
    const pageA = {
      parent: {
        "sling:resourceType": "aem-integration/components/section",
        main: { "sling:resourceType": "aem-integration/components/content" },
      },
    };
    const pageB = {
      parent: {
        "sling:resourceType": "aem-integration/components/section",
        main: { "sling:resourceType": "aem-integration/components/quote" },
      },
    };
    const slots = discoverSlots([pageA, pageB]);
    const sectionSlots = slots.get("aem-integration/components/section");
    assert.ok(sectionSlots);
    const mainSlot = sectionSlots!.get("main");
    assert.ok(mainSlot);
    assert.equal(mainSlot!.childTypes.size, 2);
  });

  it("ignores children without a sling:resourceType", () => {
    // Multifield rows and dialog sub-objects don't carry sling:resourceType
    // — scanner shouldn't treat them as slots.
    const root = {
      parent: {
        "sling:resourceType": "aem-integration/components/promo",
        buttons: {
          item0: { text: "Click", link: "/x" },
        },
      },
    };
    const slots = discoverSlots([root]);
    assert.equal(slots.size, 0);
  });
});
