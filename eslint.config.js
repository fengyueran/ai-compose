import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import globals from 'globals'
import path from 'node:path'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const normalizeCompatConfig = (config) => {
  const ecmaVersion = config.languageOptions?.ecmaVersion

  return {
    ...config,
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ...config.languageOptions,
      ...(typeof ecmaVersion === 'string'
        ? { ecmaVersion: Number.parseInt(ecmaVersion, 10) }
        : {}),
    },
  }
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  ...compat
    .extends(
      '@feature-sliced/eslint-config/rules/public-api',
      '@feature-sliced/eslint-config/rules/layers-slices',
    )
    .map(normalizeCompatConfig),
])
