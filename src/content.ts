export interface ProjectPage { id: string; title: string; body: string; image: string }
export interface Project {
  id: string; title: string; category: string; year: string; summary: string;
  cover: string; featured: boolean; url: string; pages: ProjectPage[];
}
export interface DojoContent {
  version: 1;
  projects: Project[];
  about: { heading: string; intro: string; body: string };
  contact: { heading: string; intro: string; email: string; location: string };
}
export const EMPTY_CONTENT: DojoContent = {
  version: 1, projects: [],
  about: { heading: 'Alex B — The Monkey King', intro: 'Entertainer, streamer, actor and creator.', body: 'General information about Alex B and his work.' },
  contact: { heading: 'Have a project in mind?', intro: 'For projects, collaborations and enquiries.', email: '', location: '' },
};

export function slug(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80).replace(/^-|-$/g, '');
}
export function escapeHTML(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
function text(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Invalid ${label}.`);
  return value.trim();
}
function safeURL(value: unknown, image: boolean) {
  const url = text(value, 'URL', 2048);
  if (!url) return '';
  if (image && /^\/(?!\/)[\w./% -]+$/.test(url)) {
    try {
      const decoded = decodeURIComponent(url);
      if (!decoded.includes('..') && !decoded.includes('\\') && !decoded.startsWith('//')) return url;
    } catch { /* Malformed local path falls through to URL validation. */ }
  }
  try { if (['http:', 'https:'].includes(new URL(url).protocol)) return url; } catch { /* Invalid URL below. */ }
  throw new Error('Use an http/https URL, or a local image path beginning with /.');
}
export function validateContent(input: unknown): DojoContent {
  if (!input || typeof input !== 'object') throw new Error('Content must be an object.');
  const data = input as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.projects) || data.projects.length > 5000) throw new Error('Invalid content version or project collection.');
  const ids = new Set<string>();
  const projects = data.projects.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid project.');
    const p = value as Record<string, unknown>;
    const id = text(p.id, 'project ID', 100, true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) throw new Error('Project IDs must be unique URL slugs.');
    ids.add(id);
    if (!Array.isArray(p.pages) || p.pages.length < 1 || p.pages.length > 50) throw new Error('Each project needs between 1 and 50 pages.');
    const pageIds = new Set<string>();
    const pages = p.pages.map((value: unknown) => {
      if (!value || typeof value !== 'object') throw new Error('Invalid project page.');
      const page = value as Record<string, unknown>;
      const pageId = text(page.id, 'page ID', 100, true);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageId) || pageIds.has(pageId)) throw new Error('Page IDs must be unique URL slugs.');
      pageIds.add(pageId);
      return { id: pageId, title: text(page.title, 'page title', 100, true), body: text(page.body, 'page text', 100000), image: safeURL(page.image ?? '', true) };
    });
    return {
      id, title: text(p.title, 'project title', 160, true), category: text(p.category, 'category', 60, true),
      year: text(p.year ?? '', 'year', 40), summary: text(p.summary ?? '', 'summary', 1000), cover: safeURL(p.cover ?? '', true),
      featured: p.featured === true, url: safeURL(p.url ?? '', false), pages,
    };
  });
  if (!data.about || typeof data.about !== 'object') throw new Error('About details are missing.');
  const about = data.about as Record<string, unknown>;
  if (!data.contact || typeof data.contact !== 'object') throw new Error('Contact details are missing.');
  const contact = data.contact as Record<string, unknown>;
  const email = text(contact.email ?? '', 'email', 254);
  if (email && !/^[^\s<>@\r\n]+@[^\s<>@\r\n]+\.[^\s<>@\r\n]+$/.test(email)) throw new Error('Enter a valid contact email.');
  return {
    version: 1, projects,
    about: { heading: text(about.heading, 'about heading', 160, true), intro: text(about.intro, 'about introduction', 2000, true), body: text(about.body, 'about body', 10000, true) },
    contact: { heading: text(contact.heading, 'contact heading', 160, true), intro: text(contact.intro, 'contact introduction', 2000), email, location: text(contact.location ?? '', 'location', 160) },
  };
}

export function projectResults(projects: Project[], category: string, query: string, page: number, pageSize = 6) {
  const search = query.trim().toLowerCase();
  const filtered = projects.filter(p => (category === 'all' || (category === 'featured' ? p.featured : `category:${p.category}` === category))
    && (!search || `${p.title} ${p.category} ${p.year} ${p.summary}`.toLowerCase().includes(search)));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  return { projects: filtered.slice((current - 1) * pageSize, current * pageSize), total: filtered.length, pages, page: current };
}
