import { readFileSync } from "node:fs";

/**
 * Per-project config declaring which AEM components are "page shells" —
 * components that live on the `jcr:content` node of an authored page and
 * carry page-level dialog properties (`pwaOrientation`, `disableCache`,
 * `pinPage`, ...) rather than appearing inside a page body.
 *
 * Each declared page-shell is paired with one or more `cq:template` paths.
 * For every (resource type, template) pair the schema emitter renders one
 * Sanity document type whose fields are: title / slug / tags / pageBuilder
 * + an inline `pageProperties` object holding the page-shell dialog +
 * `featuredImage` lifted from `cq:featuredimage` + a `cqTemplate` traceback.
 *
 * Operators declare the pairing explicitly so the migrator doesn't have to
 * walk content during schema generation. Templates seen in extracted
 * content that aren't declared here surface as `unknownPageTemplates`
 * findings in the transform audit.
 *
 * Example (`tenants/<your-tenant>/aem-page-components.json`):
 *
 * ```json
 * {
 *   "uxp/components/structure/page": {
 *     "templates": [
 *       "/conf/uxp/settings/wcm/templates/plan-details",
 *       "/conf/uxp/settings/wcm/templates/news-article"
 *     ]
 *   }
 * }
 * ```
 *
 * Override the file path via the `AEM_PAGE_COMPONENTS_FILE` env var.
 */
export interface PageComponentConfigEntry {
  /**
   * Explicit `cq:template` paths this page-shell is used with. Each entry
   * here becomes one Sanity document type at `migrate:schema` time.
   *
   * Optional when {@link discover} is `true` — the schema pass scans
   * `output/cache/aem/content/` (extracted content) and auto-adds any templates it
   * finds on `jcr:content` nodes whose `sling:resourceType` matches this
   * entry. Listing some explicitly + setting `discover: true` is allowed
   * (and useful for nailing down known templates while still picking up
   * new ones automatically).
   */
  templates: ReadonlyArray<string>;
  /**
   * Auto-discover templates by scanning extracted raw content for distinct
   * `cq:template` values on `jcr:content` nodes that carry this entry's
   * resource type. Requires `aem-extract` to have populated
   * `output/cache/aem/content/` first — first-run schema with `discover: true` and
   * no explicit `templates` emits nothing and logs a hint to run extract.
   *
   * Default: false.
   */
  discover?: boolean;
}

export type PageComponentConfig = Map<string, PageComponentConfigEntry>;

export interface LoadPageComponentConfigOptions {
  /** Absolute or relative path. Missing file → empty config. */
  file: string;
}

/**
 * Synchronous load — matches `loadContainerConfig` / `loadAuthoringHintConfig`.
 * Returns an empty Map when the file is absent so the feature is fully
 * optional. Throws on malformed JSON or invalid entries so a typo doesn't
 * silently disable per-template document emission.
 */
export function loadPageComponentConfig(
  opts: LoadPageComponentConfigOptions,
): PageComponentConfig {
  const { file } = opts;
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `page-components config: ${file} is not valid JSON (${(err as Error).message})`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `page-components config: ${file} must be a JSON object keyed by sling:resourceType`,
    );
  }

  const out: PageComponentConfig = new Map();
  for (const [resourceType, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(
        `page-components config: entry for "${resourceType}" must be an object with a templates array`,
      );
    }
    const v = value as Record<string, unknown>;
    const rawTemplates = v.templates;
    const discover = v.discover === true;
    if (rawTemplates !== undefined && !Array.isArray(rawTemplates)) {
      throw new Error(
        `page-components config: entry for "${resourceType}" — "templates" must be an array when set`,
      );
    }
    const list: string[] = [];
    const seen = new Set<string>();
    for (const t of (rawTemplates ?? []) as unknown[]) {
      if (typeof t !== "string" || t.trim().length === 0) {
        throw new Error(
          `page-components config: entry for "${resourceType}" has a non-string / empty template path`,
        );
      }
      const trimmed = t.trim();
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      list.push(trimmed);
    }
    if (list.length === 0 && !discover) {
      throw new Error(
        `page-components config: entry for "${resourceType}" needs either a non-empty "templates" array or "discover": true (or both)`,
      );
    }
    out.set(resourceType, discover ? { templates: list, discover: true } : { templates: list });
  }
  return out;
}
