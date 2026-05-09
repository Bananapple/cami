import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: [
      // Swap the real Supabase client for a no-op mock during tests so modules
      // that import it don't crash on missing VITE_SUPABASE_URL.
      // Must come before the general "@" alias (first match wins).
      {
        find: "@/integrations/supabase/client",
        replacement: path.resolve(__dirname, "./src/integrations/supabase/client.mock.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
