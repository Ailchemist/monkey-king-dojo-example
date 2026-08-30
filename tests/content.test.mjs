import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { escapeHTML, projectResults, slug, validateContent } from '../src/content.ts';
import { makeContent } from './fixtures.mjs';
import { routeParts } from '../src/presentation.ts';

test('mobile masthead uses the current two-line identity without the retired kicker', () => {
  const source = readFileSync(new URL('../src/mobileDojo.ts', import.meta.url), 'utf8');
  const masthead = source.match(/<header class="mobile-masthead">([\s\S]*?)<\/header>/)?.[1] ?? '';
  assert.match(masthead, /<h1 tabindex="-1">Alex B<\/h1>/);
  assert.match(masthead, /<span class="mobile-signature">The Monkey King<\/span>/);
  assert.doesNotMatch(masthead, /MONKEY KING DOJO|THE NOTICEBOARD/);
});

test('desktop board uses the copyright rail without the retired slogan footer', () => {
  const source = readFileSync(new URL('../src/infoBoard.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/infoBoard.css', import.meta.url), 'utf8');
  assert.match(source, /<div class="board-bottom"><span>© 2026 AlexB\.live<\/span><\/div>/);
  assert.doesNotMatch(source, /WORK · PEOPLE · STORIES|MK \/ DOJO ARCHIVE|board-footer/);
  assert.doesNotMatch(css, /\.board-footer(?:-note)?/);
});

test('desktop noticeboard masthead contains only the noticeboard title', () => {
  const source = readFileSync(new URL('../src/infoBoard.ts', import.meta.url), 'utf8');
  const masthead = source.match(/<header class="board-cap">([\s\S]*?)<\/header>/)?.[1] ?? '';
  assert.match(masthead, /<h1 id="dojo-board-title">THE NOTICEBOARD<\/h1>/);
  assert.doesNotMatch(masthead, /MONKEY KING DOJO|board-kicker/);
});

test('portfolio category controls omit the Featured filter', () => {
  const source = readFileSync(new URL('../src/infoBoard.ts', import.meta.url), 'utf8');
  const portfolio = source.match(/function drawPortfolio\(\) \{([\s\S]*?)\n  \}\n\n  function drawProject/)?.[1] ?? '';
  assert.match(portfolio, /const choices = \[\{ id: 'all', label: 'All work' \}/);
  assert.doesNotMatch(portfolio, /id: 'featured'|label: 'Featured'/);
});

test('About is a first-class read-only noticeboard route on desktop and mobile', () => {
  const board = readFileSync(new URL('../src/infoBoard.ts', import.meta.url), 'utf8');
  const mobile = readFileSync(new URL('../src/mobileDojo.ts', import.meta.url), 'utf8');
  assert.match(board, /id="about-tab" href="#about"/);
  assert.match(board, /function drawAbout\(\)/);
  assert.match(board, /\['about', 'portfolio', 'contact'\]/);
  assert.match(mobile, /data-page="about">About/);
  assert.match(mobile, /\['about', 'portfolio', 'contact'\]/);
});

test('Windows dist launcher builds and previews locally without network exposure', () => {
  const launcher = readFileSync(new URL('../Run Dist Server.bat', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(launcher, /cd \/d "%~dp0"/i);
  assert.match(launcher, /call npm\.cmd run build/i);
  assert.match(launcher, /call npm\.cmd run preview -- --open/i);
  assert.doesNotMatch(launcher, /0\.0\.0\.0|--host\s+(?!127\.0\.0\.1)/i);
  assert.match(pkg.scripts.preview, /vite preview --host 127\.0\.0\.1/);
});

test('procedural board wood wraps periodically and keeps native tile proportions', () => {
  const wood = readFileSync(new URL('../src/boardWood.ts', import.meta.url), 'utf8');
  const mobileCSS = readFileSync(new URL('../src/mobileDojo.css', import.meta.url), 'utf8');
  const boardCSS = readFileSync(new URL('../src/infoBoard.css', import.meta.url), 'utf8');
  assert.match(wood, /const wrap =/);
  assert.match(wood, /tiledNoise\(x \+ warp \+ knot \* 22, y, 52, 2\)/);
  assert.match(wood, /Math\.min\(Math\.abs\(y - 310\), canvas\.height - Math\.abs\(y - 310\)\)/);
  assert.doesNotMatch(wood, /context\.stroke|\.lineTo\(/);
  assert.match(mobileCSS, /\.mobile-masthead[^\n]+background-size:512px 256px/);
  assert.match(boardCSS, /\.board-cap[^\n]+background-size:512px 256px/);
  assert.doesNotMatch(`${mobileCSS}\n${boardCSS}`, /background-size:380px (?:110|130)px/);
});

test('runtime content is repository-authored and exposes no editor or write middleware', () => {
  const root = new URL('../', import.meta.url);
  assert.equal(existsSync(new URL('dev/contentEditor.ts', root)), false);
  assert.equal(existsSync(new URL('tests/content-editor.test.mjs', root)), false);
  const board = readFileSync(new URL('src/infoBoard.ts', root), 'utf8');
  const config = readFileSync(new URL('vite.config.ts', root), 'utf8');
  assert.match(board, /fetch\(`\$\{options\.base\}content\/dojo\.json`/);
  assert.doesNotMatch(`${board}\n${config}`, /__dojo|contentEditor|method:\s*['"](?:PUT|POST)|data-upload|board-editor|editable/);
});

test('public portfolio contains Cobra Pit, Judge Mathis and the two retained legacy projects', () => {
  const source = JSON.parse(readFileSync(new URL('../public/content/dojo.json', import.meta.url), 'utf8'));
  const content = validateContent(source);
  assert.deepEqual(content.projects.map(project => project.id), ['cobra-pit', 'judge-mathis-bounce-baby', 'false-hawks', 'fishtank-live']);
  const cobraPit = content.projects.find(project => project.id === 'cobra-pit');
  assert.equal(cobraPit?.category, 'Reality Television');
  assert.equal(cobraPit?.summary, 'An upcoming high-intensity game show hosted by Alex B, The Monkey King.');
  assert.match(cobraPit?.pages[0].body ?? '', /^Status: Upcoming/);
  assert.equal(content.projects.some(project => ['no-more-heroes', 'alex-b-live'].includes(project.id)), false);
  assert.equal(content.projects.some(project => /example|placeholder/i.test(project.title)), false);
  const judgeMathis = content.projects.find(project => project.id === 'judge-mathis-bounce-baby');
  assert.equal(judgeMathis?.category, 'Reality Television');
  assert.equal(judgeMathis?.year, '2024 · Appearance');
  assert.equal(judgeMathis?.url, 'https://www.youtube.com/watch?v=1gYCaBy8ucM');
  assert.equal(judgeMathis?.cover, '/portfolio/judge-mathis-alex-7b951b913dbf.webp');
  assert.equal(existsSync(new URL('../public/portfolio/judge-mathis-alex-7b951b913dbf.webp', import.meta.url)), true);
  assert.equal(content.projects.find(project => project.id === 'false-hawks')?.url, 'https://www.youtube.com/watch?v=xoSHJ8mRNJI');
  assert.equal(content.projects.find(project => project.id === 'false-hawks')?.cover, '/portfolio/false-hawks-95d781042ab6.webp');
  assert.equal(existsSync(new URL('../public/portfolio/false-hawks-95d781042ab6.webp', import.meta.url)), true);
  assert.match(content.projects.find(project => project.id === 'false-hawks')?.pages[0].body ?? '', /imdb\.com\/title\/tt37244987/);
  const fishtank = content.projects.find(project => project.id === 'fishtank-live')?.pages[0].body ?? '';
  assert.equal(content.projects.find(project => project.id === 'fishtank-live')?.year, 'Season 3 and Season 5');
  assert.equal(content.projects.find(project => project.id === 'fishtank-live')?.cover, '/portfolio/fishtank-logo-34df6e8aec14.webp');
  assert.equal(existsSync(new URL('../public/portfolio/fishtank-logo-34df6e8aec14.webp', import.meta.url)), true);
  assert.match(fishtank, /Magic Stars and a return as a freeloader during Fishtank Season 5/);
  assert.doesNotMatch(fishtank, /Stephen "Alex B" Bernard|Wild Randy|On Day 22/);
  assert.equal(content.about.heading, 'Alex B — The Monkey King');
  assert.match(content.about.body, /livestreaming, reality television, independent film and original live entertainment/i);
  assert.equal(content.contact.email, 'alexander@bernardfinancialllc.com');
});

test('shared noticeboard routes retain project subpages and tolerate malformed hashes', () => {
  assert.deepEqual(routeParts('#portfolio/qa-project-01/process'), ['portfolio', 'qa-project-01', 'process']);
  assert.deepEqual(routeParts('#portfolio/%70roject/overview'), ['portfolio', 'project', 'overview']);
  assert.deepEqual(routeParts('#about'), ['about']);
  assert.deepEqual(routeParts('#contact'), ['contact']);
  assert.deepEqual(routeParts('#portfolio/bad%route'), []);
});

test('large collections filter, paginate and clamp to a valid result page', () => {
  const { projects } = validateContent(makeContent(37));
  assert.equal(projectResults(projects, 'all', '', 1).pages, 7);
  assert.deepEqual(projectResults(projects, 'all', '', 99).projects.map(p => p.id), ['qa-project-37']);
  assert.equal(projectResults(projects, 'category:Design', '', 1).total, 13);
  assert.equal(projectResults(projects, 'featured', '', 1).total, 10);
  const searched = projectResults(projects, 'category:Design', 'PROJECT 01', 4);
  assert.equal(searched.total, 1);
  assert.equal(searched.page, 1);
  assert.equal(projectResults(projects, 'all', 'not present', 5).projects.length, 0);
  projects[0].category = 'all';
  projects[1].category = 'featured';
  assert.equal(projectResults(projects, 'category:all', '', 1).total, 1);
  assert.equal(projectResults(projects, 'category:featured', '', 1).total, 1);
});

test('content rejects duplicate routes, unsafe links, malformed images and incomplete projects', () => {
  const mutations = [
    c => c.projects.push(structuredClone(c.projects[0])),
    c => c.projects[0].pages.push(structuredClone(c.projects[0].pages[0])),
    c => c.projects[0].pages = [],
    c => c.projects[0].url = 'javascript:alert(1)',
    c => c.projects[0].cover = '//untrusted.example/image.png',
    c => c.projects[0].cover = '/%2e%2e/private.png',
    c => c.projects[0].cover = '/%5c%5cserver/file.png',
    c => c.projects[0].cover = '/bad%path.png',
    c => { delete c.about; },
    c => c.about.body = '',
    c => c.contact.email = 'someone@example.com\r\nBcc:other@example.com',
  ];
  for (const mutate of mutations) {
    const content = makeContent(1);
    mutate(content);
    assert.throws(() => validateContent(content));
  }
  const valid = makeContent(1);
  valid.projects[0].cover = '/uploads/my%20image.png';
  valid.projects[0].url = 'https://example.com/project';
  assert.equal(validateContent(valid).projects[0].cover, valid.projects[0].cover);
});

test('content slugs remain bounded and all rendered text is escaped', () => {
  assert.equal(slug('Café / Motion'), 'cafe-motion');
  const longTitle = 'a'.repeat(79) + ' long title';
  assert.equal(slug(longTitle), 'a'.repeat(79));
  assert.equal(escapeHTML('<img onerror="alert(1)"> & \'x\''), '&lt;img onerror=&quot;alert(1)&quot;&gt; &amp; &#39;x&#39;');
});
