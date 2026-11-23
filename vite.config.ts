import { defineConfig } from "vitest/config";

// Suhteellinen base, jotta build toimii GitHub Pagesissa alihakemistosta.
export default defineConfig({
  base: "./",
  // Projektikansion sisällä voi olla Clauden/Codexin erillisiä työpuita. Niiden
  // vanhoja testejä ei saa ajaa tämän branchin testipakettina.
  test: { include: ["src/**/*.test.ts"] },
});
