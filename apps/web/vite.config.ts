import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Dev-time Sanity env is sourced from:
 *  1. `apps/web/.env` (if present — same conventions as the rest of the repo),
 *  2. otherwise `examples/davids-bridal/.env` so the demo picks up the same
 *     project / dataset the migration pipeline writes to without duplication.
 *
 * Only the *public* values (SANITY_PROJECT_ID, SANITY_DATASET) are exposed to
 * the client bundle; tokens stay server-side (this demo is read-only and
 * doesn't need one).
 */
export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  const sharedEnv = loadEnv(mode, `${process.cwd()}/../../examples/davids-bridal`, "");
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
