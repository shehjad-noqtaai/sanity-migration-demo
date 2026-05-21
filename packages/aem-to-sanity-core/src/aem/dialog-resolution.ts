import { AemFetchError } from "./fetcher.ts";
import type { DialogNode } from "./dialog-types.ts";

/**
 * Resolve a component's Granite UI dialog, walking the
 * `sling:resourceSuperType` chain when the component itself has no direct
 * `cq:dialog` child.
 *
 * This mirrors AEM's runtime dialog-resolution: an authored content node
 * with `sling:resourceType: <proxy>` opens the dialog of whichever ancestor
 * in the supertype chain actually defines one. Proxy components — common in
 * AEMaaCS where a site-specific `/apps/<site>/components/foo` extends an
 * Adobe Core Component or a versioned `/apps/<site>/components/foo/v1/foo`
 * — would otherwise be unmigrate-able, because the on-disk component path
 * has no dialog of its own.
 *
 * Resolution rules:
 *
 *  1. Try `${current}/_cq_dialog.infinity.json`. If it exists, return it,
 *     plus the chain (single entry for direct hits, multiple for inherited).
 *  2. On 404, fetch `${current}.infinity.json` and read
 *     `sling:resourceSuperType`. Absent → dead-end (component is genuinely
 *     dialogless).
 *  3. Resolve the supertype:
 *       - Absolute paths (`/apps/...`, `/libs/...`) → used as-is.
 *       - Relative resource types (`<namespace>/components/...`) →
 *         AEM's lookup order is `/apps/<rt>` first, then `/libs/<rt>`.
 *  4. Recurse with the resolved path, guarding against cycles and capping
 *     the hop count.
 *
 * The injected `fetcher` is the same shape `aem-to-sanity-schema` already
 * uses (`(jcrPath) => Promise<DialogNode>`), so this helper plugs in without
 * a new transport. Non-404 errors propagate as-is — they're real failures,
 * not "missing dialog" signals.
 */

export interface DialogResolution {
  /** The Granite UI dialog node. */
  dialog: DialogNode;
  /** JCR path where the dialog was found (may differ from the requested path). */
  resolvedPath: string;
  /**
   * The full supertype walk. First entry is the originally-requested path,
   * last is `resolvedPath`. For a direct (non-inherited) hit, length = 1.
   */
  chain: string[];
}

export interface ResolveDialogOptions {
  /** Cap on supertype hops. Default 10. */
  maxHops?: number;
}

const DEFAULT_MAX_HOPS = 10;

export async function resolveDialogViaSuperType(
  componentPath: string,
  fetcher: (jcrPath: string) => Promise<DialogNode>,
  opts: ResolveDialogOptions = {},
): Promise<DialogResolution> {
  const maxHops = opts.maxHops ?? DEFAULT_MAX_HOPS;
  const visited = new Set<string>();
  const chain: string[] = [];
  let current: string | undefined = componentPath;

  for (let hop = 0; hop < maxHops && current; hop++) {
    if (visited.has(current)) {
      throw new Error(
        `Cycle in sling:resourceSuperType chain at ${current}. Chain: ${chain.join(" → ")}`,
      );
    }
    visited.add(current);
    chain.push(current);

    try {
      const dialog = await fetcher(`${current}/_cq_dialog`);
      return { dialog, resolvedPath: current, chain };
    } catch (err) {
      if (!isNotFound(err)) throw err;
      // 404 — look up the component itself for sling:resourceSuperType.
      const supertype = await readResourceSuperType(current, fetcher);
      if (!supertype) {
        throw new Error(
          `No \`cq:dialog\` at ${current} and no \`sling:resourceSuperType\` to follow. ` +
            `Chain walked: ${chain.join(" → ")}`,
        );
      }
      const resolved = await resolveSuperTypePath(supertype, fetcher);
      if (!resolved) {
        throw new Error(
          `Found \`sling:resourceSuperType="${supertype}"\` at ${current} but couldn't ` +
            `resolve it under /apps/ or /libs/. Chain walked: ${chain.join(" → ")}`,
        );
      }
      current = resolved;
    }
  }
  throw new Error(
    `Aborting after ${maxHops} supertype hops without finding a dialog. ` +
      `Chain: ${chain.join(" → ")}`,
  );
}

/**
 * Read `sling:resourceSuperType` from a component node's `.infinity.json`.
 * Returns undefined if the component itself 404s or has no supertype
 * declared. Non-404 errors propagate.
 */
async function readResourceSuperType(
  componentPath: string,
  fetcher: (jcrPath: string) => Promise<DialogNode>,
): Promise<string | undefined> {
  let node: DialogNode;
  try {
    node = await fetcher(componentPath);
  } catch (err) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
  const v = node["sling:resourceSuperType"];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Resolve a `sling:resourceSuperType` value to an absolute JCR path.
 *
 * Absolute paths (starting with `/`) are returned as-is after a HEAD-like
 * existence check. Relative resource types follow AEM's lookup order:
 * `/apps/<rt>` first (project + AMS overrides take precedence), `/libs/<rt>`
 * second (Adobe defaults).
 *
 * Returns undefined when neither candidate exists — the chain dead-ends.
 */
async function resolveSuperTypePath(
  supertype: string,
  fetcher: (jcrPath: string) => Promise<DialogNode>,
): Promise<string | undefined> {
  if (supertype.startsWith("/")) {
    return (await pathExists(supertype, fetcher)) ? supertype : undefined;
  }
  for (const base of ["/apps", "/libs"] as const) {
    const candidate = `${base}/${supertype}`;
    if (await pathExists(candidate, fetcher)) return candidate;
  }
  return undefined;
}

async function pathExists(
  jcrPath: string,
  fetcher: (jcrPath: string) => Promise<DialogNode>,
): Promise<boolean> {
  try {
    await fetcher(jcrPath);
    return true;
  } catch (err) {
    if (isNotFound(err)) return false;
    // Auth / network / parse — bubble up so callers see real failures
    // instead of "couldn't resolve supertype" masking a 401.
    throw err;
  }
}

/**
 * Distinguish AEM's "JCR node doesn't exist" 404 from other errors. The
 * fetcher classifies non-401/403 HTTP failures as `kind: "network"` with
 * `details.status` set, so we key off the status code.
 */
function isNotFound(err: unknown): boolean {
  if (!(err instanceof AemFetchError)) return false;
  return err.details?.status === 404;
}
