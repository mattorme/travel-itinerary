import next from 'eslint-config-next';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'lib/db/database.types.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...next,
  {
    // Scoped to TS files so the @typescript-eslint plugin that
    // eslint-config-next registers for them is in scope.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // The spec asks for strong types; `any` is how that erodes.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Architectural boundary: domain/ is pure. No IO, no framework, no service
    // clients. This is what makes the itinerary logic testable without a
    // network, a database, or an API key — see docs/ARCHITECTURE.md §14.
    files: ['domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/*', '@/app/*', '@/components/*'],
              message: 'domain/ must stay pure — no imports from lib/, app/ or components/.',
            },
            {
              group: ['next', 'next/*', 'react', 'react-dom', 'server-only'],
              message: 'domain/ must stay framework-free.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
