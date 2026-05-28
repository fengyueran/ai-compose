import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import boundariesPlugin from 'eslint-plugin-boundaries'
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

const fsdLayers = ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared']

const getLowerLayers = (layer) => fsdLayers.slice(fsdLayers.indexOf(layer) + 1)

const getUpperLayers = (layer) => fsdLayers.slice(0, fsdLayers.indexOf(layer))

const getNotSharedLayersRules = () =>
  getUpperLayers('shared').map((layer) => ({
    from: { type: layer },
    allow: getLowerLayers(layer).map((allowedType) => ({
      to: { type: allowedType },
    })),
  }))

const slicelessLayerRules = [
  {
    from: { type: 'shared' },
    allow: [{ to: { type: 'shared' } }],
  },
  {
    from: { type: 'app' },
    allow: [{ to: { type: 'app' } }],
  },
]

const getGodModeRules = () =>
  fsdLayers.map((layer) => ({
    from: { type: `gm_${layer}` },
    allow: [layer, ...getLowerLayers(layer)].map((allowedType) => ({
      to: { type: allowedType },
    })),
  }))

const boundariesElements = [
  ...fsdLayers.map((layer) => ({
    type: layer,
    pattern: `${layer}/!(_*){,/*}`,
    mode: 'folder',
    capture: ['slices'],
  })),
  ...fsdLayers.map((layer) => ({
    type: `gm_${layer}`,
    pattern: `${layer}/_*`,
    mode: 'folder',
    capture: ['slices'],
  })),
]

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
    .extends('@feature-sliced/eslint-config/rules/public-api')
    .map(normalizeCompatConfig),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      boundaries: boundariesPlugin,
    },
    settings: {
      'boundaries/dependency-nodes': ['import'],
      'boundaries/elements': boundariesElements,
    },
    rules: {
      'boundaries/element-types': 'off',
      'boundaries/dependencies': [
        2,
        {
          default: 'disallow',
          message:
            '"{{from.type}}" is not allowed to import "{{to.type}}" | See rules: https://feature-sliced.design/docs/reference/layers/overview ',
          rules: [...getNotSharedLayersRules(), ...slicelessLayerRules, ...getGodModeRules()],
        },
      ],
    },
  },
])
