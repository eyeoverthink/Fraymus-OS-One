import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: path.resolve("client"),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4177",
      "/live": "http://127.0.0.1:4177",
      "/published": "http://127.0.0.1:4177",
      "/vendor": "http://127.0.0.1:4177",
      "/login": "http://127.0.0.1:4177",
      "/logout": "http://127.0.0.1:4177"
    }
  },
  build: {
    outDir: path.resolve("client/dist"),
    emptyOutDir: true
  }
});
