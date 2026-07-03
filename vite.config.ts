import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Split big, rarely-changing vendors into their own long-cache chunks so
        // they parallelize on first load and survive app-code deploys in cache.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/react-router|\/react-dom\/|\/react\/|\/scheduler\//.test(id)) return "react-vendor";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("@tanstack")) return "query";
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
