const globals = require('globals');
module.exports = [
  { ignores: ['node_modules/**', 'logs/**', 'backups/**'] },
  {
    files: ['src/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
      'no-dupe-keys': 'error',
      eqeqeq: 'warn'
    }
  }
];
