/** @type {import('apidox').Config} */
export default {
  title: 'API Documentation',
  src: ['**/*.{js,ts,mjs,cjs}'],
  ignore: ['node_modules/**', 'docs/**', 'dist/**'],
  output: 'docsx',
  versionFile: ['VERSION', 'version.md', 'package.json'],
  keepHistory: true,
  maxHistoryVersions: 50,
  theme: 'dark'
};
