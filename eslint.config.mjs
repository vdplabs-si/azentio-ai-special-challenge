import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // three.js is ~200 kB gzipped: only the lazily loaded scene module may import it.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/three/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^(three|@react-three/[^/]+)(/.*)?$", message: "Import WebGL code only inside src/components/three (loaded via SceneStage)." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
