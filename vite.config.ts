// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack Start, React, Tailwind, path aliases, Nitro, VITE_* env injection,
//     error reporting, and sandbox-specific development settings.
//
// Lovable previews use their default target. On Vercel, explicitly select Nitro's
// Vercel preset so the build emits the format expected by Vercel Functions.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel sets VERCEL during its build. Keep the Lovable preview path unchanged.
const isVercel = Boolean(process.env.VERCEL && process.env.VERCEL !== "0");

const env = process.env;
const publicSupabaseUrl =
  env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
const publicSupabaseKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY ||
  "";

export default defineConfig({
  // Use Vercel's output preset for production builds on Vercel. The existing
  // Lovable sandbox remains on its regular preview configuration.
  nitro: isVercel ? { preset: "vercel" } : true,
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSupabaseKey),
    },
  },
  tanstackStart: {
    // Keep the custom SSR error wrapper used by the application.
    server: { entry: "server" },
  },
});
