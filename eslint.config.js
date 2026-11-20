// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // .claude/worktrees berisi checkout lain; supabase/functions memakai Deno.
    ignores: ['dist/*', '.expo/*', '.claude/*', 'supabase/functions/*'],
  },
]);
