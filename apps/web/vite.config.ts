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

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_SANITY_PROJECT_ID": JSON.stringify(projectId),
      "import.meta.env.VITE_SANITY_DATASET": JSON.stringify(dataset),
    },
    server: { port: 4321 },
  };
});
