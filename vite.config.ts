import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hosts the dev/preview servers answer to. Localhost and IPs are always allowed;
// preview tunnels (e.g. *.e2b.app) and anything in VITE_ALLOWED_HOSTS are added here.
const allowedHosts = [
  ".e2b.app",
  ...(process.env.VITE_ALLOWED_HOSTS ? process.env.VITE_ALLOWED_HOSTS.split(",") : []),
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // Relative asset paths: the build can be served from any host or sub-path
  // (GitHub Pages project sites, S3 buckets, an intranet folder, file://).
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    // The whole app is inlined into one index.html — no chunks to warn about.
    chunkSizeWarningLimit: 4096,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts,
  },
});
