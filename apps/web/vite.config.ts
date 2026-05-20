import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Dev-time Sanity env is sourced from:
 *  1. `apps/web/.env` (if present — same conventions as the rest of the repo),
 *  2. otherwise the first tenant folder under `examples/` that has a `.env`
 *     so the demo picks up the same project / dataset the migration pipeline
 *     writes to without duplication. `examples/tenant/` (the committed
 *     template) is intentionally skipped — it never has real credentials.
 *
 * Only the *public* values (SANITY_PROJECT_ID, SANITY_DATASET) are exposed to
 * the client bundle; tokens stay server-side (this demo is read-only and
 * doesn't need one).
 */
function findTenantEnvDir(mode: string): string | undefined {
  const examplesDir = resolve(process.cwd(), "../../examples");
  if (!existsSync(examplesDir)) return undefined;
  const candidates = readdirSync(examplesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "tenant")
    .map((d) => join(examplesDir, d.name))
    .filter((dir) => {
      // loadEnv honors .env, .env.local, .env.<mode>, .env.<mode>.local.
      // Any of these is a signal the tenant folder has been set up.
      return (
        existsSync(join(dir, ".env")) ||
        existsSync(join(dir, ".env.local")) ||
        existsSync(join(dir, `.env.${mode}`)) ||
        existsSync(join(dir, `.env.${mode}.local`))
      );
    });
  return candidates[0];
}

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  const tenantDir = findTenantEnvDir(mode);
  const sharedEnv = tenantDir ? loadEnv(mode, tenantDir, "") : {};
  const projectId = localEnv.SANITY_PROJECT_ID ?? sharedEnv.SANITY_PROJECT_ID ?? "";
  const dataset = localEnv.SANITY_DATASET ?? sharedEnv.SANITY_DATASET ?? "production";
  // Server-side token for the dev proxy when the dataset is private.
  // Never exposed to the browser: the proxy attaches `Authorization` to
  // outbound requests, the client only talks to `/sanity-api/*`.
  const token = localEnv.SANITY_TOKEN ?? sharedEnv.SANITY_TOKEN ?? "";

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_SANITY_PROJECT_ID": JSON.stringify(projectId),
      "import.meta.env.VITE_SANITY_DATASET": JSON.stringify(dataset),
    },
    server: {
      port: 4321,
      proxy: projectId
        ? {
            // Proxy Sanity API traffic through the dev server so the browser
            // never issues a cross-origin request to *.apicdn.sanity.io — no
            // CORS config needed on the Sanity project for localhost
            // preview. In prod the client talks to the CDN directly; see
            // `src/sanity.ts` for the env-conditional switch.
            "/sanity-api": {
              target: `https://${projectId}.apicdn.sanity.io`,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/sanity-api/, ""),
              secure: true,
              configure: (proxy) => {
                // Private dataset? Attach the token on the server side so
                // the browser never sees it. Leaving the header off when
                // no token is configured keeps public-read projects
                // working (we'd otherwise ship a bogus "Bearer " header).
                if (!token) return;
                proxy.on("proxyReq", (proxyReq) => {
                  proxyReq.setHeader("Authorization", `Bearer ${token}`);
                });
              },
            },
          }
        : undefined,
    },
  };
});
