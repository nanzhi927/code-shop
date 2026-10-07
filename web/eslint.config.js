const pluginVue = require('eslint-plugin-vue');
module.exports = [
  { ignores: ['node_modules/**', 'dist/**'] },
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        IntersectionObserver: 'readonly'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'warn',
      'no-unused-vars': 'warn'
    }
  }
];
