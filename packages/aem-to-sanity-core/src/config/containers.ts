import { readFileSync } from "node:fs";

/**
 * Config for AEM "container" components — ones that author drop-zone children
 * rather than declaring child content in a dialog multifield. Example from
 * David's Bridal: `aem-integration/components/expander`. Its JCR node holds
 * both dialog values (`headline2`, `theme`, ...) and a set of child nodes
 * with keys like `item_1657754806454`, each of which is itself a full
 * component instance with its own `sling:resourceType`.
 *
 * AEM declares this via `cq:isContainer` on the component definition, but
 * that flag isn't in the dialog payload we already fetch, so we mirror it
 * explicitly here. One flat JSON file, keyed by `sling:resourceType`:
 *
 * ```json
 * {
 *   "aem-integration/components/expander":     { "childrenField": "items" },
 *   "aem-integration/components/container":    { "childrenField": "items" },
 *   "aem-integration/components/column-layout":{ "childrenField": "items" }
 * }
 * ```
 *
 * The schema emitter appends an `items`-shaped array field to each listed
 * type (using `type: "pageBuilder"` so the palette matches the top-level
 * page builder). The content transform descends into child nodes of each
 * listed node and emits them as pageBuilder-style blocks under the same
 * field name.
 */
export interface ContainerConfigEntry {
  /** Field name on the Sanity object that carries the child blocks. Typically `"items"`. */
  childrenField: string;
}

export type ContainerConfig = Map<string, ContainerConfigEntry>;

export interface LoadContainerConfigOptions {
  /** Absolute or relative path. Missing file → empty config. */
  file: string;
}

/**
 * Synchronous load — matches the rest of the content CLIs (transform runs
 * sync top-to-bottom). Returns an empty Map when the file is absent; throws
 * on malformed JSON or structurally invalid entries so a typo in the config
 * doesn't silently disable container behavior.
 */
export function loadContainerConfig(
  opts: LoadContainerConfigOptions,
): ContainerConfig {
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
      `container config: ${file} is not valid JSON (${(err as Error).message})`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `container config: ${file} must be a JSON object keyed by sling:resourceType`,
    );
  }

  const out: ContainerConfig = new Map();
  for (const [resourceType, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(
        `container config: entry for "${resourceType}" must be an object with a childrenField`,
      );
    }
    const v = value as Record<string, unknown>;
    const childrenField = v.childrenField;
    if (typeof childrenField !== "string" || childrenField.trim().length === 0) {
      throw new Error(
        `container config: entry for "${resourceType}" needs a non-empty string childrenField`,
      );
    }
    out.set(resourceType, { childrenField });
  }
  return out;
}
