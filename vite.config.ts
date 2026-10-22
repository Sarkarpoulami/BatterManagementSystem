import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // Listen on every interface so the dev server is reachable from containers / previews.
    host: "0.0.0.0",
    // Dev server only: also accept requests proxied through a preview tunnel.
    // Extra hosts can be allowed with VITE_ALLOWED_HOSTS="a.dev,b.dev".
    allowedHosts: [
      ".e2b.app",
      ...(process.env.VITE_ALLOWED_HOSTS ? process.env.VITE_ALLOWED_HOSTS.split(",") : []),
    ],
  },
});
