#!/usr/bin/env node
/**
 * Ensure apps/studio/schemas/generated/index.ts exists so the Studio
 * typechecks + boots on a bare clone before `pnpm migrate:schema` has run.
 *
 * The directory is gitignored — every operator emits their own real barrel
 * locally. This script only writes a minimal empty stub when nothing is
 * there yet; it NEVER overwrites an existing file, so a real generated
 * barrel survives `pnpm install` re-runs unchanged.
 *
 * Invoked via the root `prepare` script.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const dir = join(repoRoot, "apps", "studio", "schemas", "generated");
const file = join(dir, "index.ts");

if (existsSync(file)) {
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
writeFileSync(
  file,
  [
    "// Bare-clone bootstrap stub. Overwritten by `pnpm migrate:schema` with",
    "// the real component barrel emitted from your AEM dialogs. Until then the",
    "// Studio loads with only hand-authored schemas (e.g. `category`).",
    "export const allSchemaTypes = [] as const;",
    "",
  ].join("\n"),
  "utf8",
);

console.log(`[ensure-studio-stub] wrote ${file}`);
