#!/usr/bin/env node
/**
 * Convert legacy `__`-encoded fixture files to path-mirror layout.
 *
 *   pnpm tsx scripts/migrate-fixtures-layout.ts <fixtures/aem/dir> [--delete-legacy]
 *
 * Walks `content/`, `components/`, and the fixtures root for flat legacy
 * names, writes path-mirror copies, and optionally removes the source files.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { decodeLegacyFixtureFilename } from "../packages/aem-to-sanity-core/src/aem/fetcher-fixtures.ts";

function migrateDir(fixturesRoot: string, deleteLegacy: boolean): { moved: number; skipped: number } {
  let moved = 0;
  let skipped = 0;

  const queue: string[] = [fixturesRoot];
  const legacyBuckets = [
    join(fixturesRoot, "content"),
    join(fixturesRoot, "components"),
  ];
  for (const bucket of legacyBuckets) {
    if (existsSync(bucket) && statSync(bucket).isDirectory()) queue.push(bucket);
  }

  for (const dir of queue) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "assets" || entry.name === "images") continue;
        continue;
      }
      const name = entry.name;
      const isMeta = name.endsWith(".meta.json");
      const decodeName = isMeta ? name : name;
      const decoded = decodeLegacyFixtureFilename(decodeName);
      if (!decoded) {
        skipped++;
        continue;
      }
      const src = join(dir, name);
      const dest = join(fixturesRoot, decoded + (isMeta ? ".meta.json" : ""));
      if (existsSync(dest)) {
        skipped++;
        continue;
      }
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      moved++;
      if (deleteLegacy) unlinkSync(src);
    }
  }

  if (deleteLegacy) {
    for (const bucket of legacyBuckets) {
      if (!existsSync(bucket)) continue;
      const remaining = readdirSync(bucket);
      if (remaining.length === 0) rmSync(bucket, { recursive: true, force: true });
    }
  }

  return { moved, skipped };
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--delete-legacy");
  const deleteLegacy = process.argv.includes("--delete-legacy");
  const target = args[0];
  if (!target) {
    console.error("usage: pnpm tsx scripts/migrate-fixtures-layout.ts <fixtures/aem/dir> [--delete-legacy]");
    process.exit(2);
  }
  const fixturesRoot = resolve(target);
  if (!existsSync(fixturesRoot)) {
    console.error(`[migrate-fixtures-layout] not found: ${fixturesRoot}`);
    process.exit(1);
  }
  const { moved, skipped } = migrateDir(fixturesRoot, deleteLegacy);
  console.log(`[migrate-fixtures-layout] ${fixturesRoot}`);
  console.log(`  copied : ${moved}`);
  console.log(`  skipped: ${skipped}`);
  if (deleteLegacy) console.log("  legacy sources removed where copied");
}

main();
