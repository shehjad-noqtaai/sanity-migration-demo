import { fetchInfinityJson, resolveConfig, type AmbiguousResolution } from "./src/index.ts";
import { detectTruncations } from "./src/aem/infinity.ts";

async function main() {
  const config = await resolveConfig(process.env);
  console.log("baseUrl:", config.baseUrl, "auth.kind:", config.auth.kind);

  // Case 1: /content/dbi.infinity.json → 300 on real AEM
  const ambig: AmbiguousResolution[] = [];
  try {
    const tree = await fetchInfinityJson({ config }, "/content/dbi", undefined, {
      onAmbiguous: (r) => ambig.push(r),
    });
    console.log("case1 OK, ambig fired:", ambig.length, "chosenDepth:", ambig[0]?.chosenDepth);
    const markers = detectTruncations(tree, "/content/dbi");
    console.log("case1 truncation markers detected:", markers.length, "first 3:", markers.slice(0, 3));
  } catch (e) {
    console.log("case1 ERROR:", (e as Error).message);
  }

  // Case 2: dialog fetch (normal 200 path)
  try {
    const { fetchComponentDialog } = await import("./src/aem/fetcher.ts");
    const dlg = await fetchComponentDialog({ config }, "/apps/dbi/components/content/about");
    console.log("case2 dialog keys:", Object.keys(dlg).slice(0, 10));
  } catch (e) {
    console.log("case2 ERROR:", (e as Error).message);
  }

  // Case 3: 404
  try {
    await fetchInfinityJson({ config }, "/content/does-not-exist-abc123");
    console.log("case3 unexpected success");
  } catch (e) {
    console.log("case3 error.kind:", (e as any).kind, "msg:", (e as Error).message.slice(0, 120));
  }

  // Case 4: oversize (tiny cap)
  try {
    await fetchInfinityJson({ config }, "/content/dbi", undefined, { maxResponseBytes: 50 });
    console.log("case4 unexpected success");
  } catch (e) {
    console.log("case4 error.kind:", (e as any).kind, "msg:", (e as Error).message.slice(0, 120));
  }

  // Case 5: bad auth → kind must be "auth"
  try {
    const badConfig = { ...config, auth: { kind: "basic" as const, username: "nope", password: "nope" } };
    await fetchInfinityJson({ config: badConfig }, "/content/dbi");
    console.log("case5 unexpected success");
  } catch (e) {
    console.log("case5 error.kind:", (e as any).kind, "msg:", (e as Error).message.slice(0, 120));
  }
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
