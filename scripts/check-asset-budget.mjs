import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootURL = new URL('../public/', import.meta.url);
const root = fileURLToPath(rootURL);
const raster = new Set(['.avif', '.webp', '.png', '.jpg', '.jpeg']);
const modern = new Set(['.avif', '.webp']);
const limits = {
  texture: 200 * 1024,
  portfolio: 150 * 1024,
  firstPortfolioPage: 900 * 1024,
};

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const all = files(root);
const errors = [];
for (const path of all) {
  const rel = relative(root, path).replaceAll('\\', '/');
  const ext = extname(path).toLowerCase();
  if (!raster.has(ext)) continue;
  if ((rel.startsWith('textures/') || rel.startsWith('portfolio/')) && !modern.has(ext)) {
    errors.push(`${rel} must use WebP or AVIF, not ${ext}`);
  }
  const max = rel.startsWith('portfolio/') ? limits.portfolio : limits.texture;
  if (statSync(path).size > max) errors.push(`${rel} exceeds ${Math.round(max / 1024)} KiB`);
}

const content = JSON.parse(readFileSync(new URL('content/dojo.json', rootURL), 'utf8'));
const pageSizes = content.projects.flatMap(project => project.cover?.startsWith('/portfolio/')
  ? [statSync(new URL(project.cover.slice(1), rootURL)).size] : []);
pageSizes.sort((a, b) => b - a);
const firstPage = pageSizes.slice(0, 6).reduce((sum, size) => sum + size, 0);
if (firstPage > limits.firstPortfolioPage) errors.push(`six portfolio covers total ${firstPage} bytes; budget is ${limits.firstPortfolioPage}`);

if (errors.length) {
  console.error(`Asset budget failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  const publicBytes = all.reduce((sum, path) => sum + statSync(path).size, 0);
  console.log(`Asset budget passed: ${(publicBytes / 1024).toFixed(1)} KiB public total; ${(firstPage / 1024).toFixed(1)} KiB for six portfolio covers.`);
}
