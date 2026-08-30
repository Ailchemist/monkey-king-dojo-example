import { EMPTY_CONTENT } from '../src/content.ts';

/** Synthetic records for isolated tests; never published as real portfolio work. */
export function makeContent(count = 25) {
  const content = structuredClone(EMPTY_CONTENT);
  content.projects = Array.from({ length: count }, (_, i) => ({
    id: `qa-project-${String(i + 1).padStart(2, '0')}`,
    title: `QA project ${String(i + 1).padStart(2, '0')}`,
    category: ['Design', 'Development', 'Film'][i % 3],
    year: '2026', summary: `Synthetic UI test content, entry ${i + 1}. Not published portfolio work.`,
    cover: '', featured: i % 4 === 0, url: '',
    pages: [
      { id: 'overview', title: 'Overview', body: 'This is synthetic UI test content.\n\nThe overview belongs to this test project only.', image: '' },
      { id: 'process', title: 'Process', body: 'Synthetic process notes for testing project subpages.', image: '' },
    ],
  }));
  return content;
}
