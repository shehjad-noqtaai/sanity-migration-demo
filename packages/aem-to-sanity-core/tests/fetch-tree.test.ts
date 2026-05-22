import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AemFetchError,
  buildFixturesFetch,
  detectTruncations,
  fetchInfinityTree,
  type FetchDeps,
} from "../src/aem/index.ts";
import type { Config } from "../src/config/schema.ts";

const FIXTURES_DIR = resolve(
  fileURLToPath(import.meta.url),
  "../../../../tenants/davids-bridal/output/cache/fixtures/aem",
);

const testConfig: Config = {
  env: "author",
  baseUrl: "https://author-aem-dev.davidsbridal.com",
  auth: { kind: "basic", username: "u", password: "p" },
  componentPathsFile: "",
  contentRootsFile: "",
  outputDir: "",
  concurrency: 4,
};

function makeDeps(fetchImpl: typeof globalThis.fetch): FetchDeps {
  return { config: testConfig, fetch: fetchImpl };
}

/**
 * Spy wrapper over a fetch impl so tests can assert which URLs were called
 * and in what order.
 */
function spyFetch(inner: typeof globalThis.fetch): {
  fetch: typeof globalThis.fetch;
  calls: string[];
  inFlight: () => number;
  peakInFlight: () => number;
} {
  const calls: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    calls.push(url);
    inFlight++;
    peak = Math.max(peak, inFlight);
    try {
      return await inner(input, init);
    } finally {
      inFlight--;
    }
  };
  return {
    fetch: fetchImpl,
    calls,
    inFlight: () => inFlight,
    peakInFlight: () => peak,
  };
}

/**
 * Build a fake fetch from a URL → response table. Each response is either a
 * status+body pair or a 200 JSON object. URLs not in the table return 404.
 */
function fakeFetch(
  table: Record<string, unknown | { status: number; body: string }>,
): typeof globalThis.fetch {
  return async (input) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    if (!(url in table)) {
      return new Response("not found", {
        status: 404,
        statusText: "Not Found",
        headers: { "content-type": "text/plain" },
      });
    }
    const entry = table[url]!;
    if (
      typeof entry === "object" &&
      entry !== null &&
      "status" in entry &&
      typeof (entry as { status: unknown }).status === "number"
    ) {
      const e = entry as { status: number; body: string };
      return new Response(e.body, {
        status: e.status,
        statusText: String(e.status),
        headers: {
          "content-type":
            e.status === 300 ? "text/html" : "application/json",
        },
      });
    }
    return new Response(JSON.stringify(entry), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

/** Slow-down helper: wraps a fetch so every call takes N ms. */
function delayed(
  fetchImpl: typeof globalThis.fetch,
  ms: number,
): typeof globalThis.fetch {
  return async (input, init) => {
    await new Promise((r) => setTimeout(r, ms));
    return fetchImpl(input, init);
  };
}

describe("fetchInfinityTree — synthetic trees", () => {
  it("passthrough when tree has no markers", async () => {
    const tree = {
      "jcr:primaryType": "cq:Page",
      "jcr:content": {
        "jcr:primaryType": "cq:PageContent",
        title: "Hello",
        nested: { "jcr:primaryType": "nt:unstructured", body: "world" },
      },
    };
    const { fetch: f } = spyFetch(
      fakeFetch({
        "https://author-aem-dev.davidsbridal.com/content/site.infinity.json":
          tree,
      }),
    );
    const result = await fetchInfinityTree(makeDeps(f), "/content/site");
    expect(result.tree).toEqual(tree);
    expect(result.stats).toEqual({
      markersFound: 0,
      markersResolved: 0,
      expansionsUsed: 0,
      markersTruncated: 0,
      markersFailed: 0,
    });
  });

  it("resolves a single one-level marker and splices the subtree", async () => {
    const rootPath = "/content/site";
    const markerPath = "/content/site/jcr:content/deep/image";
    const rootTree = {
      "jcr:primaryType": "cq:Page",
      "jcr:content": {
        "jcr:primaryType": "cq:PageContent",
        title: "Top",
        deep: {
          "jcr:primaryType": "nt:unstructured",
          // AEM serialized the `image` child as a string marker at depth-5.
          image: markerPath,
        },
      },
    };
    const imageSubtree = {
      "jcr:primaryType": "nt:unstructured",
      src: "/content/dam/x.png",
      width: 640,
    };
    const spy = spyFetch(
      fakeFetch({
        [`https://author-aem-dev.davidsbridal.com${rootPath}.infinity.json`]:
          rootTree,
        [`https://author-aem-dev.davidsbridal.com${markerPath}.infinity.json`]:
          imageSubtree,
      }),
    );
    const result = await fetchInfinityTree(makeDeps(spy.fetch), rootPath);
    // The marker string should have been replaced by the resolved subtree.
    expect(
      (result.tree as any)["jcr:content"].deep.image,
    ).toEqual(imageSubtree);
    expect(result.stats.markersFound).toBe(1);
    expect(result.stats.markersResolved).toBe(1);
    expect(result.stats.markersTruncated).toBe(0);
    expect(result.stats.expansionsUsed).toBe(1);
    // After the fix, no string marker remains.
    expect(detectTruncations(result.tree, rootPath)).toEqual([]);
    // Exactly 2 HTTP calls: root + follow-up.
    expect(spy.calls).toHaveLength(2);
  });

  it("resolves nested markers over multiple rounds", async () => {
    const rootPath = "/content/a";
    const level1 = "/content/a/child";
    const level2 = "/content/a/child/grandchild";
    const spy = spyFetch(
      fakeFetch({
        [`https://author-aem-dev.davidsbridal.com${rootPath}.infinity.json`]: {
          "jcr:primaryType": "cq:Page",
          child: level1,
        },
        [`https://author-aem-dev.davidsbridal.com${level1}.infinity.json`]: {
          "jcr:primaryType": "nt:unstructured",
          x: 1,
          grandchild: level2,
        },
        [`https://author-aem-dev.davidsbridal.com${level2}.infinity.json`]: {
          "jcr:primaryType": "nt:unstructured",
          y: 2,
        },
      }),
    );
    const result = await fetchInfinityTree(makeDeps(spy.fetch), rootPath);
    expect((result.tree as any).child.grandchild).toEqual({
      "jcr:primaryType": "nt:unstructured",
      y: 2,
    });
    expect(result.stats.markersResolved).toBe(2);
    expect(result.stats.expansionsUsed).toBe(2); // two rounds required
    expect(detectTruncations(result.tree, rootPath)).toEqual([]);
  });

  it("honours maxDepthExpansions budget and replaces leftovers with maxDepth sentinel", async () => {
    const rootPath = "/content/a";
    const chain = ["/content/a/b", "/content/a/b/c", "/content/a/b/c/d"];
    const spy = spyFetch(
      fakeFetch({
        [`https://author-aem-dev.davidsbridal.com${rootPath}.infinity.json`]: {
          "jcr:primaryType": "cq:Page",
          b: chain[0],
        },
        [`https://author-aem-dev.davidsbridal.com${chain[0]}.infinity.json`]: {
          "jcr:primaryType": "nt:unstructured",
          c: chain[1],
        },
        [`https://author-aem-dev.davidsbridal.com${chain[1]}.infinity.json`]: {
          "jcr:primaryType": "nt:unstructured",
          d: chain[2],
        },
        [`https://author-aem-dev.davidsbridal.com${chain[2]}.infinity.json`]: {
          "jcr:primaryType": "nt:unstructured",
          leaf: true,
        },
      }),
    );
    const result = await fetchInfinityTree(makeDeps(spy.fetch), rootPath, {
      maxDepthExpansions: 2,
    });
    // After 2 rounds we've resolved `b` then `c`, but `d` was discovered in
    // round 3 which we skip (budget = 2). So `d` remains a string marker at
    // the end of the rounds; the final sweep converts it to maxDepth.
    const leaf = (result.tree as any).b.c.d;
    expect(leaf).toEqual({
      __truncated: "maxDepth",
      jcrPath: chain[2],
    });
    expect(result.stats.markersTruncated).toBe(1);
    expect(result.stats.expansionsUsed).toBe(2);
    // Invariant: markersFound counts every marker discovered across rounds
    // AND the final sweep. `d` appears only in round 2's spliced result and
    // is never a round-start marker, so the post-loop `markersFound +=
    // markersTruncated` at fetch-tree.ts:194 is the only place it's counted.
    expect(result.stats.markersFound).toBe(3);
    expect(result.stats.markersFound).toBe(
      result.stats.markersResolved +
        result.stats.markersTruncated +
        result.stats.markersFailed,
    );
    // downstream `transform.ts:222` guard treats { __truncated } as opaque.
    expect(detectTruncations(result.tree, rootPath)).toEqual([]);
  });

  it("cycle guard: re-detection of an already-fetched path does not re-fetch", async () => {
    // Pathological AEM: page `/content/a` has a marker pointing at
    // `/content/a/nested`. When we fetch `.../nested.infinity.json`, the
    // response is an object that, due to the suspiciously-empty heuristic,
    // gets re-detected as a marker on the next round. The cycle guard must
    // recognise it as already-fetched and stop the loop.
    const rootPath = "/content/a";
    const nestedPath = "/content/a/nested";
    const spy = spyFetch(
      fakeFetch({
        [`https://author-aem-dev.davidsbridal.com${rootPath}.infinity.json`]: {
          "jcr:primaryType": "cq:Page",
          // Sibling carries content → suspiciously-empty heuristic is
          // active when walking this level.
          realContent: { "jcr:primaryType": "nt:unstructured", x: 1, y: 2 },
          nested: nestedPath,
        },
        // The fetched response is itself empty enough to re-trigger the
        // suspiciously-empty heuristic in the next round.
        [`https://author-aem-dev.davidsbridal.com${nestedPath}.infinity.json`]:
          { "jcr:primaryType": "nt:unstructured" },
      }),
    );
    const result = await fetchInfinityTree(makeDeps(spy.fetch), rootPath);
    // `nested` was fetched exactly once — the cycle guard prevents a re-fetch
    // even though the suspiciously-empty heuristic keeps flagging it.
    const nestedFetches = spy.calls.filter((u) => u.includes("/nested.infinity"));
    expect(nestedFetches).toHaveLength(1);
    // After the final sweep the re-detected marker is replaced with a
    // cycle / maxDepth sentinel — never left as a bare string.
    const nested = (result.tree as any).nested;
    expect(typeof nested).toBe("object");
    // Could be `cycle` (caught mid-round) or `maxDepth` (caught by final
    // sweep) depending on exactly when the heuristic re-fires. Either
    // matches downstream's `{__truncated}` guard.
    expect(["cycle", "maxDepth"]).toContain(nested.__truncated);
  });

  it("failed follow-up: 404 becomes an error sentinel, root is not aborted", async () => {
    const rootPath = "/content/a";
    const spy = spyFetch(
      fakeFetch({
        [`https://author-aem-dev.davidsbridal.com${rootPath}.infinity.json`]: {
          "jcr:primaryType": "cq:Page",
          missing: `${rootPath}/missing`,
          present: `${rootPath}/present`,
        },
        [`https://author-aem-dev.davidsbridal.com${rootPath}/present.infinity.json`]:
          { "jcr:primaryType": "nt:unstructured", ok: true },
        // missing is absent → 404 from fakeFetch
      }),
    );
    const result = await fetchInfinityTree(makeDeps(spy.fetch), rootPath);
    expect((result.tree as any).present).toEqual({
      "jcr:primaryType": "nt:unstructured",
      ok: true,
    });
    expect((result.tree as any).missing).toMatchObject({
      __truncated: "error",
      jcrPath: `${rootPath}/missing`,
      status: 404,
    });
    expect(result.stats.markersResolved).toBe(1);
    expect(result.stats.markersFailed).toBe(1);
  });

  it("parallel follow-ups: concurrency=4 fetches 4 markers in one overlapping window", async () => {
    const rootPath = "/content/a";
    const markers = ["m1", "m2", "m3", "m4", "m5", "m6"].map(
      (k) => `${rootPath}/${k}`,
    );
    const table: Record<string, unknown> = {
      [`https://author-aem-dev.davidsbridal.com${rootPath}.infinity.json`]: {
        "jcr:primaryType": "cq:Page",
        m1: markers[0],
        m2: markers[1],
        m3: markers[2],
        m4: markers[3],
        m5: markers[4],
        m6: markers[5],
      },
    };
    for (const m of markers)
      table[
        `https://author-aem-dev.davidsbridal.com${m}.infinity.json`
      ] = { "jcr:primaryType": "nt:unstructured", ok: true };
    const spy = spyFetch(delayed(fakeFetch(table), 40));
    const result = await fetchInfinityTree(makeDeps(spy.fetch), rootPath, {
      concurrency: 4,
    });
    expect(result.stats.markersResolved).toBe(6);
    // Peak concurrency should have been at least 2 (proving parallelism);
    // with 6 markers and pool=4, peak can hit 4. Root fetch runs alone
    // before the pool starts, so peak observed during the follow-up round
    // should be >= 2 and <= 4.
    expect(spy.peakInFlight()).toBeGreaterThanOrEqual(2);
    expect(spy.peakInFlight()).toBeLessThanOrEqual(4);
  });

  it("respects concurrency=1 (fully serial)", async () => {
    const rootPath = "/content/a";
    const markers = ["m1", "m2", "m3"].map((k) => `${rootPath}/${k}`);
    const table: Record<string, unknown> = {
      [`https://author-aem-dev.davidsbridal.com${rootPath}.infinity.json`]: {
        "jcr:primaryType": "cq:Page",
        m1: markers[0],
        m2: markers[1],
        m3: markers[2],
      },
    };
    for (const m of markers)
      table[
        `https://author-aem-dev.davidsbridal.com${m}.infinity.json`
      ] = { "jcr:primaryType": "nt:unstructured" };
    const spy = spyFetch(delayed(fakeFetch(table), 20));
    await fetchInfinityTree(makeDeps(spy.fetch), rootPath, {
      concurrency: 1,
    });
    expect(spy.peakInFlight()).toBe(1);
  });

  it("onFollowUp callback is fired once per marker with round index", async () => {
    const rootPath = "/content/a";
    const level1 = "/content/a/b";
    const spy = spyFetch(
      fakeFetch({
        [`https://author-aem-dev.davidsbridal.com${rootPath}.infinity.json`]: {
          "jcr:primaryType": "cq:Page",
          b: level1,
        },
        [`https://author-aem-dev.davidsbridal.com${level1}.infinity.json`]: {
          "jcr:primaryType": "nt:unstructured",
          leaf: true,
        },
      }),
    );
    const seen: Array<[string, number]> = [];
    await fetchInfinityTree(makeDeps(spy.fetch), rootPath, {
      onFollowUp: (p, r) => seen.push([p, r]),
    });
    expect(seen).toEqual([[level1, 0]]);
  });
});

describe("fetchInfinityTree — fixture-based replay", () => {
  // These tests use the on-disk fixtures from task 9eDR1wjQ. If fixtures
  // aren't present (rare — CI should always have them), skip gracefully.
  const fixturesPresent = (() => {
    try {
      return statSync(FIXTURES_DIR).isDirectory();
    } catch {
      return false;
    }
  })();

  (fixturesPresent ? describe : describe.skip)("/content/dbi", () => {
    let fetchImpl: typeof globalThis.fetch;
    beforeEach(() => {
      fetchImpl = buildFixturesFetch(FIXTURES_DIR, testConfig.baseUrl);
    });

    it("resolves all 6 of the audit-identified depth-5 markers", async () => {
      const result = await fetchInfinityTree(
        makeDeps(fetchImpl),
        "/content/dbi",
      );
      expect(result.stats.markersFound).toBe(6);
      expect(result.stats.markersResolved).toBe(6);
      expect(result.stats.markersTruncated).toBe(0);
      expect(result.stats.markersFailed).toBe(0);
      expect(detectTruncations(result.tree, "/content/dbi")).toEqual([]);
    });

    it("/content/dbi/en resolves all follow-ups within the default 3-round budget", async () => {
      const result = await fetchInfinityTree(
        makeDeps(fetchImpl),
        "/content/dbi/en",
      );
      expect(detectTruncations(result.tree, "/content/dbi/en")).toEqual([]);
      expect(result.stats.markersTruncated).toBe(0);
      expect(result.stats.markersFailed).toBe(0);
    });

    it("shallow page (/content/dbi/en/about-us) has no markers", async () => {
      const result = await fetchInfinityTree(
        makeDeps(fetchImpl),
        "/content/dbi/en/about-us",
      );
      expect(result.stats.markersFound).toBe(0);
      expect(result.stats.expansionsUsed).toBe(0);
    });
  });
});

describe("fetchInfinityTree — error propagation", () => {
  it("auth failure on root aborts (auth is never retry-able)", async () => {
    const spy = spyFetch(async () => new Response("denied", { status: 401 }));
    await expect(
      fetchInfinityTree(makeDeps(spy.fetch), "/content/site"),
    ).rejects.toThrow(AemFetchError);
  });

  it("root 404 throws — follow-ups never start", async () => {
    const spy = spyFetch(async () => new Response("nope", { status: 404 }));
    await expect(
      fetchInfinityTree(makeDeps(spy.fetch), "/content/nope"),
    ).rejects.toThrow();
    // Only the root fetch was attempted.
    expect(spy.calls).toHaveLength(1);
  });
});
