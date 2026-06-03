import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
