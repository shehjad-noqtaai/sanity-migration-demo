/**
 * AEM auto-names repeated authored child nodes (drop-zone instances) with a
 * stable base plus a machine-generated suffix. The same logical slot therefore
 * surfaces under many JCR keys across pages. The suffixes stack — a creation
 * timestamp, then a copy marker (`_c` / `_cop` / `_copy`, or the camelCased
 * `C` / `Cop` / `Copy`), then a paste id, repeated for each duplication:
 *
 *   content                              ← first instance, clean
 *   content_1793623844                   ← created via the page editor (base + creation timestamp)
 *   content_1793623844_c                 ← a copy of the above (`_c`)
 *   content_1893078103_c_100046160       ← a pasted copy (`_c_<paste-id>`)
 *   title_copy / title_copy_copy_copy    ← repeated JCR "copy" suffix
 *   title_1967938466_cop_1581547696      ← abbreviated `_cop` marker + paste id
 *   title_copy_44665454_                 ← trailing separator left behind
 *   content1732069919C1240033211         ← already-camelCased form (`C<paste-id>`)
 *   item_1657754806454                   ← older underscore-timestamp form
 *
 * Treated naively, every distinct key becomes its own Sanity field — one
 * `defineField` per author drop — which blows past Sanity's per-dataset
 * attribute limit on content-heavy tenants. {@link normalizeSlotBase} reduces
 * each key to its logical base so callers can collapse the instances into a
 * single (array) field. Run it on the raw JCR key (before camelCasing). The
 * schema emitter groups discovered slots by base and the content transform
 * groups sibling nodes by base, so both sides agree on the field name without
 * exchanging state.
 */

/**
 * Ordered suffix strippers applied repeatedly to the *end* of a JCR key until
 * the value stops changing. Order matters: the copy markers and copy-with-id
 * must run before the bare trailing-digits rule so a paste id is peeled off
 * first and the marker it sits behind is recognized, rather than the digits
 * being stripped while the marker is left stranded.
 */
const SUFFIX_RULES: ReadonlyArray<RegExp> = [
  // AEM truncates the word "copy" to any prefix when it auto-names a paste —
  // we see `_co`, `_cop`, `_copy` (and the bare `_c` below). Match the
  // underscore/dash form, consuming the separator too. Anchored at `$` so it
  // only strips a genuine trailing token (`hero_company` is left alone).
  /[_-][Cc]op?y?$/,
  /C\d+$/, // camelCased copy-with-id: `content…C1240033211`
  /(?<=[a-z0-9])C(?:o(?:p(?:y)?)?)?$/, // camelCased copy word after a word/digit: `titleCopy`, `…466Cop`, `…919C`
  /[_-][a-z]$/, // single trailing copy letter behind a separator: `…_c`
  /[_-]?\d+$/, // creation timestamp / paste id, with or without separator
  /[_-]$/, // leftover trailing separator
];

/**
 * Reduce an AEM JCR child-node key to the logical base it was generated from.
 * Returns the input unchanged when it carries no recognizable auto-name suffix
 * (so clean, hand-named slots like `content` are preserved). Never returns an
 * empty string — if stripping would empty the key, the last non-empty value is
 * kept (defends against pathological all-digit keys).
 */
export function normalizeSlotBase(key: string): string {
  let current = key;
  for (let changed = true; changed; ) {
    changed = false;
    for (const rule of SUFFIX_RULES) {
      const next = current.replace(rule, "");
      if (next !== current && next.length > 0) {
        current = next;
        changed = true;
      }
    }
  }
  return current;
}
