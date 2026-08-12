import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["website/tests/contracts/**/*.test.ts"],
    restoreMocks: true,
  },
});
