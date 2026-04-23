/**
 * Sanity built-in type names that can't be re-used for user-defined types.
 * Shared across the emitter pipeline (`resolveSanityTypeNames`) and the
 * Studio-side `sanitizeSchemaTypes` defense-in-depth step so both agree on
 * what counts as a collision.
 */
export const RESERVED_SANITY_TYPE_NAMES: ReadonlySet<string> = new Set<string>([
  "image",
  "file",
  "geopoint",
  "reference",
  "slug",
  "url",
  "text",
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "block",
  "object",
  "array",
  "email",
  "span",
]);

/**
 * Convert an AEM component path into a stable, camelCase Sanity type name.
 *
 *   /apps/aem-integration/components/promo           → "promo"
 *   /apps/aem-integration/components/variable-column → "variableColumn"
 *   /apps/.../components/hero/banner                 → "heroBanner"
 */
export function componentPathToTypeName(componentPath: string): string {
  const segments = componentPath.split("/").filter(Boolean);
  const marker = segments.lastIndexOf("components");
  const tail = marker >= 0 ? segments.slice(marker + 1) : segments.slice(-1);
  if (tail.length === 0) {
    throw new Error(`Cannot derive type name from path: ${componentPath}`);
  }
  const joined = tail.join("-");
  return toCamelCase(joined);
}

/**
 * General-purpose camelCase for AEM `name` values (e.g. `./contentPosition`),
 * hyphenated paths (`hero-video-banner`), and slugs. Inserts word breaks at
 * camelCase / PascalCase boundaries so `contentPosition` → `contentPosition`,
 * not `contentposition`.
 */
export function toCamelCase(input: string): string {
  const spaced = input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
  const words = spaced.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function toTitleCase(input: string): string {
  const words = input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * AEM `cq:Component` nodes often use `jcr:title` like "Hero video banner component".
 * Strip a trailing " component" for Studio labels (redundant with the context).
 */
export function displayTitleFromAemComponentJcrTitle(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const stripped = t.replace(/\s+component$/i, "").trim();
  return stripped.length > 0 ? stripped : t;
}

/**
 * Resolve every AEM component path to a final, collision-free Sanity type
 * name. Returns a `Map<path, typeName>` preserving the input paths verbatim
 * as keys.
 *
 * The emitted name is the authoritative identifier: it's what lands on disk
 * (`{name}.ts`), what gets registered in `pageBuilder.of[]`, what the
 * content registry writes as `sanityType`, and what the ingest pipeline
 * stamps onto `_type` in every document. Resolving up front (rather than
 * per-path inside the Studio with `sanitizeSchemaTypes`) is what keeps all
 * those artifacts in lockstep — otherwise a later rename leaves ingested
 * data orphaned as "unknown type" in the Studio.
 *
 * Resolution rules:
 *   1. Base name: `componentPathToTypeName(path)`.
 *   2. If the base collides with a Sanity built-in (`RESERVED_SANITY_TYPE_NAMES`)
 *      or with a name already assigned to another path, prefix with `aem`.
 *   3. If that's still taken, append a numeric suffix (`aemImage2`, etc.).
 *
 * Iteration order is the input order — earlier paths win ties, which gives
 * deterministic output for a given `aem-component-paths` list.
 */
export function resolveSanityTypeNames(
  componentPaths: readonly string[],
): Map<string, string> {
  const assigned = new Map<string, string>();
  const taken = new Set<string>();

  for (const path of componentPaths) {
    const base = componentPathToTypeName(path);
    let name = base;
    if (RESERVED_SANITY_TYPE_NAMES.has(name) || taken.has(name)) {
      name = "aem" + base.charAt(0).toUpperCase() + base.slice(1);
    }
    if (taken.has(name)) {
      const root = name;
      let suffix = 2;
      do {
        name = `${root}${suffix++}`;
      } while (taken.has(name));
    }
    assigned.set(path, name);
    taken.add(name);
  }

  return assigned;
}
