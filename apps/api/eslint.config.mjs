import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'src/generated/**', 'test/**/*.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // O código herdado usa `_` para parâmetros ignorados.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // SQL cru só com template tag do Prisma ($queryRaw`...`), que parametriza os valores.
      'no-restricted-properties': [
        'error',
        { property: '$queryRawUnsafe', message: 'Use $queryRaw`...` (parametrizado).' },
        { property: '$executeRawUnsafe', message: 'Use $executeRaw`...` (parametrizado).' },
      ],
    },
  },
);
