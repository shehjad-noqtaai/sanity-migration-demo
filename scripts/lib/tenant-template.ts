/**
 * Shared helpers for migrate:init + migrate:doctor.
 *
 * Knows which files in tenants/template/ are template-owned (drift checked,
 * safe to refresh) vs operator-owned (do not touch, never compare) vs
 * ignored (caches, node_modules, output).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "..", "..");
export const TENANTS_DIR = join(REPO_ROOT, "tenants");
export const TEMPLATE_DIR = join(TENANTS_DIR, "template");

/**
 * Files whose contents come from the template. Doctor compares these and
 * reports drift; init seeds them verbatim.
 */
export const TEMPLATE_FILES = [
  "README.md",
  ".env.example",
  "aem-content-roots.example",
] as const;

/**
 * Files the operator owns and customizes. Doctor never compares contents;
 * init seeds them from the template's empty/example version once.
 */
export const OPERATOR_FILES = [
  ".env",
  "aem-content-roots",
  "aem-component-paths",
  "aem-component-containers.json",
  "aem-component-hints.json",
  "aem-component-exceptions",
  "aem-page-components.json",
  "aem-tag-roots",
] as const;

/**
 * Names that must be skipped during init copy + doctor walks regardless of
 * where they appear.
 */
export const IGNORED_NAMES = new Set([
  "node_modules",
  "output",
  ".turbo",
  ".DS_Store",
]);

export interface EnvLine {
  key: string;
  value: string;
  /** True if the line is uncommented in .env.example — operator must set it. */
  required: boolean;
  /** Placeholder value from .env.example (e.g. "your-project-id"). */
  placeholder: string;
}

/**
 * Parse `.env`-style content into a key→value map. Skips comments + blank
 * lines, strips matched surrounding quotes.
 */
export function parseEnv(content: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.set(key, value);
  }
  return out;
}

/**
 * Introspect `.env.example`. Returns one entry per `KEY=value` line found,
 * with `required=true` when the line is uncommented (operator must set it
 * before running the migration) and `required=false` when commented
 * (informational / optional override).
 *
 * `placeholder` always holds the value as it appears in `.env.example` so
 * the doctor can detect "operator forgot to replace the placeholder".
 */
export function parseEnvExample(content: string): EnvLine[] {
  const out: EnvLine[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const required = !line.startsWith("#");
    const body = required ? line : line.replace(/^#+\s*/, "");
    if (!/^[A-Z][A-Z0-9_]*=/.test(body)) continue;
    const eq = body.indexOf("=");
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.push({ key, value, required, placeholder: value });
  }
  return out;
}

export function readFileIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function tenantDir(slug: string): string {
  return join(TENANTS_DIR, slug);
}

/**
 * AEM authentication is "pick one of three flows" rather than "all required",
 * so the env doctor needs a dedicated check instead of a per-var check.
 */
export const AEM_AUTH_FLOWS = [
  {
    name: "service credentials",
    keys: ["AEM_SERVICE_CREDENTIALS_FILE", "AEM_SERVICE_CREDENTIALS"],
    mode: "any-of",
  },
  { name: "developer token", keys: ["AEM_TOKEN"], mode: "any-of" },
  {
    name: "basic auth",
    keys: ["AEM_AUTHOR_USERNAME", "AEM_AUTHOR_PASSWORD"],
    mode: "all-of",
  },
] as const;

/**
 * Heuristic to detect leftover template placeholder values. Matches anything
 * containing a `your-…` token, runs of x/X, or angle-bracketed `<…>` slugs.
 * Sensible defaults shipped in .env.example (e.g. `author`, `production`)
 * deliberately do NOT match — those are values the operator may keep as-is.
 */
const PLACEHOLDER_RE = /your-|<[^>]+>|x{3,}|X{3,}/;

export function isMeaningfulValue(value: string | undefined): boolean {
  if (!value) return false;
  if (PLACEHOLDER_RE.test(value)) return false;
  return true;
}
