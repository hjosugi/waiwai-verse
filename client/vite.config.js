import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    // allow importing ../../shared/protocol.js from outside the client root
    fs: { allow: [".", "..", "../.."] },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
