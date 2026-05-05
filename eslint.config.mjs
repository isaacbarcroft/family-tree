import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "UI-redisgn/**",
    ],
  },
  {
    rules: {
      "@next/next/no-img-element": "off",
      // New in eslint-plugin-react-hooks v7. Existing callsites use legitimate
      // patterns (URL-param reads, localStorage gates, route-change cleanups);
      // surface them as warnings until each can be audited individually.
      "react-hooks/set-state-in-effect": "warn",
      // Allow underscore-prefixed args/vars to stay for API signature reasons.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]

export default eslintConfig
