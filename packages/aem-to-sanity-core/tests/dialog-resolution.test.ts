import { describe, expect, it, vi } from "vitest";
import { AemFetchError } from "../src/aem/fetcher.ts";
import { resolveDialogViaSuperType } from "../src/aem/dialog-resolution.ts";
import type { DialogNode } from "../src/aem/dialog-types.ts";

/**
 * Builds a stub fetcher backed by an in-memory map. Each key is a JCR path;
 * the value is what the fetcher returns (a DialogNode) or `undefined` for
 * 404. Anything not in the map throws a non-404 AemFetchError so we can
 * verify "treat unknown errors as failures, not as missing-dialog signals".
 */
function buildFetcher(table: Record<string, DialogNode | undefined>) {
  return vi.fn(async (jcrPath: string): Promise<DialogNode> => {
    if (!(jcrPath in table)) {
      throw new AemFetchError(
        "network",
        `Unexpected fetch in test: ${jcrPath}`,
        { status: 500 },
      );
    }
    const v = table[jcrPath];
    if (v === undefined) {
      throw new AemFetchError(
        "network",
        `Authentication failed (404) for ${jcrPath}`,
        { status: 404 },
      );
    }
    return v;
  });
}

const SAMPLE_DIALOG: DialogNode = {
  "jcr:title": "Sample",
  "sling:resourceType": "cq/gui/components/authoring/dialog",
};

describe("resolveDialogViaSuperType", () => {
  it("returns directly when the component owns a cq:dialog", async () => {
    const fetcher = buildFetcher({
      "/apps/site/components/promo/_cq_dialog": SAMPLE_DIALOG,
    });
    const out = await resolveDialogViaSuperType(
      "/apps/site/components/promo",
      fetcher,
    );
    expect(out.dialog).toBe(SAMPLE_DIALOG);
    expect(out.resolvedPath).toBe("/apps/site/components/promo");
    expect(out.chain).toEqual(["/apps/site/components/promo"]);
    // No supertype lookup needed → only one call.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("follows sling:resourceSuperType via /apps when component is dialogless", async () => {
    const fetcher = buildFetcher({
      // Proxy has no dialog → 404
      "/apps/site/components/proxy/pageinfo/_cq_dialog": undefined,
      // But declares a supertype.
      "/apps/site/components/proxy/pageinfo": {
        "sling:resourceSuperType": "site/components/content/pageinfo/v1/pageinfo",
      },
      // The supertype exists under /apps.
      "/apps/site/components/content/pageinfo/v1/pageinfo": {
        "sling:resourceType": "cq:Component",
      },
      "/apps/site/components/content/pageinfo/v1/pageinfo/_cq_dialog": SAMPLE_DIALOG,
    });
    const out = await resolveDialogViaSuperType(
      "/apps/site/components/proxy/pageinfo",
      fetcher,
    );
    expect(out.dialog).toBe(SAMPLE_DIALOG);
    expect(out.resolvedPath).toBe(
      "/apps/site/components/content/pageinfo/v1/pageinfo",
    );
    expect(out.chain).toEqual([
      "/apps/site/components/proxy/pageinfo",
      "/apps/site/components/content/pageinfo/v1/pageinfo",
    ]);
  });

  it("falls back to /libs when the supertype isn't under /apps", async () => {
    const fetcher = buildFetcher({
      "/apps/site/components/text/_cq_dialog": undefined,
      "/apps/site/components/text": {
        "sling:resourceSuperType": "foundation/components/text",
      },
      // /apps/foundation/components/text does NOT exist.
      "/apps/foundation/components/text": undefined,
      // …but /libs does.
      "/libs/foundation/components/text": { "sling:resourceType": "cq:Component" },
      "/libs/foundation/components/text/_cq_dialog": SAMPLE_DIALOG,
    });
    const out = await resolveDialogViaSuperType(
      "/apps/site/components/text",
      fetcher,
    );
    expect(out.resolvedPath).toBe("/libs/foundation/components/text");
    expect(out.chain).toEqual([
      "/apps/site/components/text",
      "/libs/foundation/components/text",
    ]);
  });

  it("respects absolute supertype paths", async () => {
    const fetcher = buildFetcher({
      "/apps/site/components/quote/_cq_dialog": undefined,
      "/apps/site/components/quote": {
        // Absolute path — should NOT be re-rooted under /apps or /libs.
        "sling:resourceSuperType": "/apps/another/components/quote/v2/quote",
      },
      "/apps/another/components/quote/v2/quote": { "sling:resourceType": "cq:Component" },
      "/apps/another/components/quote/v2/quote/_cq_dialog": SAMPLE_DIALOG,
    });
    const out = await resolveDialogViaSuperType(
      "/apps/site/components/quote",
      fetcher,
    );
    expect(out.resolvedPath).toBe("/apps/another/components/quote/v2/quote");
  });

  it("walks multi-hop chains until a dialog is found", async () => {
    // proxy → base v1 → base (no version) — three hops total.
    const fetcher = buildFetcher({
      "/apps/site/components/foo/_cq_dialog": undefined,
      "/apps/site/components/foo": {
        "sling:resourceSuperType": "site/components/foo/v1/foo",
      },
      "/apps/site/components/foo/v1/foo": {
        "sling:resourceSuperType": "site/components/base/foo",
      },
      "/apps/site/components/foo/v1/foo/_cq_dialog": undefined,
      "/apps/site/components/base/foo": {
        "sling:resourceType": "cq:Component",
      },
      "/apps/site/components/base/foo/_cq_dialog": SAMPLE_DIALOG,
    });
    const out = await resolveDialogViaSuperType(
      "/apps/site/components/foo",
      fetcher,
    );
    expect(out.resolvedPath).toBe("/apps/site/components/base/foo");
    expect(out.chain).toHaveLength(3);
  });

  it("throws a clear error when the chain dead-ends with no supertype", async () => {
    const fetcher = buildFetcher({
      "/apps/site/components/structural/_cq_dialog": undefined,
      "/apps/site/components/structural": {
        // No sling:resourceSuperType — dialogless leaf.
        "jcr:title": "Structural component",
      },
    });
    await expect(
      resolveDialogViaSuperType("/apps/site/components/structural", fetcher),
    ).rejects.toThrow(/no `sling:resourceSuperType` to follow/);
  });

  it("throws when a supertype is declared but doesn't resolve under /apps or /libs", async () => {
    const fetcher = buildFetcher({
      "/apps/site/components/orphan/_cq_dialog": undefined,
      "/apps/site/components/orphan": {
        "sling:resourceSuperType": "does/not/exist/anywhere",
      },
      "/apps/does/not/exist/anywhere": undefined,
      "/libs/does/not/exist/anywhere": undefined,
    });
    await expect(
      resolveDialogViaSuperType("/apps/site/components/orphan", fetcher),
    ).rejects.toThrow(/couldn't resolve it under \/apps\/ or \/libs\//);
  });

  it("detects supertype cycles", async () => {
    const fetcher = buildFetcher({
      "/apps/a/_cq_dialog": undefined,
      "/apps/a": { "sling:resourceSuperType": "b" },
      "/apps/b": { "sling:resourceSuperType": "a" },
      "/apps/b/_cq_dialog": undefined,
    });
    await expect(
      resolveDialogViaSuperType("/apps/a", fetcher),
    ).rejects.toThrow(/Cycle in sling:resourceSuperType chain/);
  });

  it("aborts when hop budget is exhausted", async () => {
    // Build a chain that always points one hop deeper.
    const table: Record<string, DialogNode | undefined> = {};
    for (let i = 0; i < 15; i++) {
      table[`/apps/c${i}/_cq_dialog`] = undefined;
      table[`/apps/c${i}`] = {
        "sling:resourceSuperType": `c${i + 1}`,
      };
    }
    const fetcher = buildFetcher(table);
    await expect(
      resolveDialogViaSuperType("/apps/c0", fetcher, { maxHops: 5 }),
    ).rejects.toThrow(/Aborting after 5 supertype hops/);
  });

  it("propagates auth errors instead of treating them as missing dialogs", async () => {
    const fetcher = vi.fn(async (jcrPath: string): Promise<DialogNode> => {
      throw new AemFetchError("auth", `Authentication failed (401) for ${jcrPath}`, {
        status: 401,
      });
    });
    await expect(
      resolveDialogViaSuperType("/apps/site/components/x", fetcher),
    ).rejects.toThrow(/Authentication failed/);
  });
});
