import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const pagesBase = process.env.GITHUB_ACTIONS === 'true' && repository && !repository.endsWith('.github.io')
  ? `/${repository}/`
  : '/';

export default defineConfig({
  base: pagesBase,
  server: {
    host: '127.0.0.1',
  },
});
