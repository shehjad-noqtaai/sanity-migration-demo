import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  aemCacheAppsFile,
  aemCacheContentFile,
  extractedContentExists,
  legacyFlatContentFilename,
  legacyRawFile,
  listExtractedContentFiles,
  resolveAppsDialogFile,
} from "../src/cache-paths.ts";

describe("cache-paths", () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), "aem-cache-"));
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("aemCacheContentFile mirrors JCR paths", () => {
    expect(aemCacheContentFile(outputDir, "/content/demo/us/en/home")).toBe(
      join(outputDir, "cache/aem/content/content/demo/us/en/home.json"),
    );
    expect(aemCacheContentFile(outputDir, "/content/cq:tags/demo")).toBe(
      join(outputDir, "cache/aem/content/content/cq:tags/demo.json"),
    );
  });

  it("aemCacheAppsFile drops the legacy components/ prefix", () => {
    expect(
      aemCacheAppsFile(outputDir, "/apps/demo-site-a/components/box/_cq_dialog"),
    ).toBe(
      join(
        outputDir,
        "cache/aem/apps/demo-site-a/components/box/_cq_dialog.json",
      ),
    );
  });

  it("listExtractedContentFiles prefers path-mirror content over legacy raw", () => {
    const mirrored = aemCacheContentFile(outputDir, "/content/demo/home");
    mkdirSync(join(mirrored, ".."), { recursive: true });
    writeFileSync(mirrored, "{}");
    const legacy = legacyRawFile(outputDir, "/content/other");
    mkdirSync(join(legacy, ".."), { recursive: true });
    writeFileSync(legacy, "{}");

    const files = listExtractedContentFiles(outputDir);
    expect(files).toHaveLength(1);
    expect(files[0]?.relPath).toBe("content/demo/home.json");
  });

  it("listExtractedContentFiles falls back to legacy raw", () => {
    const legacy = legacyRawFile(outputDir, "/content/demo/home");
    mkdirSync(join(legacy, ".."), { recursive: true });
    writeFileSync(legacy, "{}");

    const files = listExtractedContentFiles(outputDir);
    expect(files).toHaveLength(1);
    expect(files[0]?.relPath).toBe(legacyFlatContentFilename("/content/demo/home"));
  });

  it("resolveAppsDialogFile reads canonical and legacy dialog caches", () => {
    const canonical = aemCacheAppsFile(outputDir, "/apps/demo/components/box");
    mkdirSync(join(canonical, ".."), { recursive: true });
    writeFileSync(canonical, "{}");
    expect(resolveAppsDialogFile(outputDir, "/apps/demo/components/box")).toBe(
      canonical,
    );

    rmSync(canonical);
    const legacy = join(outputDir, "cache/aem/components/apps/demo/components/box.json");
    mkdirSync(join(legacy, ".."), { recursive: true });
    writeFileSync(legacy, "{}");
    expect(resolveAppsDialogFile(outputDir, "/apps/demo/components/box")).toBe(
      legacy,
    );
  });

  it("extractedContentExists checks canonical and legacy paths", () => {
    expect(extractedContentExists(outputDir, "/content/x")).toBe(false);
    const canonical = aemCacheContentFile(outputDir, "/content/x");
    mkdirSync(dirname(canonical), { recursive: true });
    writeFileSync(canonical, "{}");
    expect(extractedContentExists(outputDir, "/content/x")).toBe(true);

    rmSync(join(outputDir, "cache/aem"), { recursive: true, force: true });
    const legacy = legacyRawFile(outputDir, "/content/y");
    mkdirSync(dirname(legacy), { recursive: true });
    writeFileSync(legacy, "{}");
    expect(extractedContentExists(outputDir, "/content/y")).toBe(true);
  });
});
