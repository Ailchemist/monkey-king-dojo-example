import { EMPTY_CONTENT, escapeHTML as esc, projectResults, validateContent, type DojoContent } from './content.ts';
import { boardWood } from './boardWood';
import { SOCIAL_CHANNELS } from './signage.ts';
import { routeParts, type BoardBrowseState } from './presentation';
import './infoBoard.css';

interface BoardOptions {
  base: string;
  presentation?: 'dialog' | 'page'; mount?: HTMLElement;
  state?: BoardBrowseState;
}
export interface InfoBoard {
  syncRoute: () => boolean; dispose: () => void;
}
const linkedText = (text: string) => text.split(/(https?:\/\/[^\s]+)/g).map(part => /^https?:\/\//.test(part)
  ? `<a href="${esc(part)}" target="_blank" rel="noopener noreferrer">${esc(part)}</a>` : esc(part)).join('');
const bodyHTML = (text: string) => text.split(/\n\s*\n/).filter(Boolean).map(p => `<p>${linkedText(p).replace(/\n/g, '<br>')}</p>`).join('');

export function createInfoBoard(options: BoardOptions): InfoBoard {
  const pageMode = options.presentation === 'page';
  const dialog: HTMLElement = document.createElement(pageMode ? 'section' : 'dialog');
  const modal = dialog instanceof HTMLDialogElement ? dialog : undefined;
  dialog.id = 'dojo-board';
  if (pageMode) { dialog.className = 'board-page-mode'; dialog.hidden = true; }
  else dialog.setAttribute('aria-labelledby', 'dojo-board-title');
  const wood = boardWood();
  dialog.style.setProperty('--wood-v', `url("${wood.vertical}")`);
  dialog.style.setProperty('--wood-h', `url("${wood.horizontal}")`);
  dialog.innerHTML = `<article class="dojo-board">${pageMode ? '' : `
    <i class="board-bracket top-left" aria-hidden="true"></i><i class="board-bracket top-right" aria-hidden="true"></i>
    <header class="board-cap"><div><h1 id="dojo-board-title">THE NOTICEBOARD</h1></div><button class="board-close" data-action="close" aria-label="Close information board">×</button></header>`}
    <div class="board-face">${pageMode ? '' : `<nav class="board-primary" role="tablist" aria-label="Information board">
      <a id="about-tab" href="#about" role="tab" aria-controls="board-page"><span>01</span> About</a>
      <a id="portfolio-tab" href="#portfolio" role="tab" aria-controls="board-page"><span>02</span> Portfolio</a>
      <a id="contact-tab" href="#contact" role="tab" aria-controls="board-page"><span>03</span> Contact</a>
    </nav>`}<div class="board-scroll"><section id="board-page" role="${pageMode ? 'region' : 'tabpanel'}" tabindex="-1"></section></div></div>${pageMode ? '' : `
    <div class="board-bottom"><span>© 2026 AlexB.live</span></div>
    <i class="board-bracket bottom-left" aria-hidden="true"></i><i class="board-bracket bottom-right" aria-hidden="true"></i>`}
  </article>`;
  (options.mount ?? document.body).append(dialog);
  const pane = dialog.querySelector<HTMLElement>('#board-page')!;
  const scrollArea = dialog.querySelector<HTMLElement>('.board-scroll')!;
  const listeners = new AbortController();
  let content: DojoContent = structuredClone(EMPTY_CONTENT), loaded = false, loadError = '';
  let { category, query, page } = options.state ?? { category: 'all', query: '', page: 1 };
  let closing: ReturnType<typeof setTimeout> | undefined;
  let lastRoute = location.hash;
  let pendingFocus = false;

  const route = () => routeParts(location.hash);
  const rememberBrowseState = () => { if (options.state) Object.assign(options.state, { category, query, page }); };
  const resetScroll = () => { if (pageMode) window.scrollTo({ top: 0, behavior: 'auto' }); else scrollArea.scrollTop = 0; };
  const asset = (url: string) => url.startsWith('/') ? options.base + url.slice(1) : url;
  const image = (url: string, alt: string, className = '') => `<img class="${className}" src="${esc(asset(url))}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  const control = (action: string, label: string, extra = '') => `<button class="board-button ${extra}" data-action="${action}" type="button">${label}</button>`;

  function drawResults() {
    const results = projectResults(content.projects, category, query, page);
    page = results.page;
    rememberBrowseState();
    const grid = pane.querySelector<HTMLElement>('#project-grid');
    if (!grid) return;
    pane.querySelectorAll<HTMLElement>('[data-category]').forEach(tab => {
      const active = tab.dataset.category === category;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    });
    grid.innerHTML = results.projects.length ? results.projects.map((p, i) => `<a class="project-card" href="#portfolio/${p.id}">
      <div class="project-cover">${p.cover ? image(p.cover, p.title) : `<div class="project-cover-empty" aria-hidden="true"><span>${String((page - 1) * 6 + i + 1).padStart(2, '0')}</span><small>${esc(p.category)}</small></div>`}${p.featured ? '<span class="project-featured">SELECTED WORK</span>' : ''}</div>
      <div class="project-card-copy"><p class="project-meta">${esc(p.category)}${p.year ? ` <span> / </span> ${esc(p.year)}` : ''}</p><h3>${esc(p.title)}<span aria-hidden="true">↗</span></h3><p>${esc(p.summary)}</p></div>
    </a>`).join('') : `<div class="board-empty"><span class="empty-score" aria-hidden="true">00</span><p class="board-kicker">${content.projects.length ? 'NO MATCHES' : 'THE ARCHIVE'}</p><h3>${content.projects.length ? 'Try another search.' : 'Your work belongs here.'}</h3><p>${content.projects.length ? 'Change the category or search to find a project.' : 'No projects have been published yet.'}</p></div>`;
    pane.querySelector<HTMLElement>('#project-count')!.textContent = results.total ? `${results.total} project${results.total === 1 ? '' : 's'} · page ${page} of ${results.pages}` : '0 projects';
    pane.querySelector<HTMLElement>('#project-pagination')!.innerHTML = results.pages > 1 ? `<button class="board-button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous project page">← Previous</button><label class="page-picker">Page <select aria-label="Project results page" data-role="page-picker">${Array.from({ length: results.pages }, (_, i) => `<option value="${i + 1}" ${page === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label><button class="board-button" data-page="${page + 1}" ${page === results.pages ? 'disabled' : ''} aria-label="Next project page">Next →</button>` : '';
  }

  function drawPortfolio() {
    const categories = [...new Set(content.projects.map(p => p.category))];
    if (!['all', ...categories.map(c => `category:${c}`)].includes(category)) category = 'all';
    const choices = [{ id: 'all', label: 'All work' }, ...categories.map(c => ({ id: `category:${c}`, label: c }))];
    const categoryControls = pageMode
      ? `<label class="board-select-label">Category<select data-role="category-picker">${choices.map(c => `<option value="${esc(c.id)}" ${category === c.id ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>`
      : `<div class="category-tabs" role="tablist" aria-label="Project categories">${choices.map(c => `<button role="tab" data-category="${esc(c.id)}" aria-controls="project-grid" aria-selected="${category === c.id}" tabindex="${category === c.id ? 0 : -1}">${esc(c.label)}</button>`).join('')}</div>`;
    pane.innerHTML = `<div class="board-section-heading"><div><p class="board-kicker">THE COLLECTION</p><h2>Portfolio</h2></div><p id="project-count" class="board-count" role="status"></p></div>
      <div class="portfolio-filters">${categoryControls}<label class="project-search"><span aria-hidden="true">⌕</span><input type="search" data-role="project-search" aria-label="Search projects" placeholder="Find a project…" value="${esc(query)}"></label></div>
      <div id="project-grid" class="project-grid" role="${pageMode ? 'region' : 'tabpanel'}" aria-label="Projects"></div><nav id="project-pagination" class="project-pagination" aria-label="Project result pages"></nav>`;
    drawResults();
  }

  function drawProject(id: string, requestedPage?: string) {
    const project = content.projects.find(p => p.id === id);
    if (!project) { pane.innerHTML = '<div class="board-empty"><h2>Project not found.</h2><p>This project may have moved or has not been published.</p><a class="board-button" href="#portfolio">← All projects</a></div>'; return; }
    const current = project.pages.find(p => p.id === requestedPage) ?? project.pages[0];
    const usePagePicker = pageMode && project.pages.length > 3;
    const pageControls = usePagePicker
      ? `<label class="board-select-label project-page-picker">Project page<select data-role="project-page-picker">${project.pages.map(p => `<option value="${p.id}" ${p.id === current.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>`
      : `<nav class="project-page-tabs" role="tablist" aria-label="Project pages">${project.pages.map(p => `<a role="tab" href="#portfolio/${project.id}/${p.id}" aria-selected="${p.id === current.id}" tabindex="${p.id === current.id ? 0 : -1}" aria-controls="project-article">${esc(p.title)}</a>`).join('')}</nav>`;
    pane.innerHTML = `<a class="board-back" href="#portfolio">← All projects</a><div class="project-heading"><p class="project-meta">${esc(project.category)}${project.year ? ` / ${esc(project.year)}` : ''}</p><h2>${esc(project.title)}</h2><p class="project-summary">${esc(project.summary)}</p></div>
      ${pageControls}<article id="project-article" class="project-article" role="${usePagePicker ? 'region' : 'tabpanel'}" aria-label="${esc(current.title)}">${current.image || (current === project.pages[0] && project.cover) ? image(current.image || project.cover, `${project.title} — ${current.title}`, 'project-hero') : ''}<h3>${esc(current.title)}</h3>${current.body ? bodyHTML(current.body) : '<p class="board-muted">This project page has no description yet.</p>'}${project.url ? `<a class="board-button" href="${esc(project.url)}" target="_blank" rel="noopener noreferrer">View project ↗</a>` : ''}</article>`;
  }

  function drawContact() {
    const c = content.contact;
    const socials = SOCIAL_CHANNELS.map(link => `<a class="contact-channel" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer"><strong>${esc(link.name)}</strong><span>${esc(link.account)} <span aria-hidden="true">↗</span></span></a>`).join('');
    pane.innerHTML = `<div class="contact-layout"><div class="contact-lead"><p class="board-kicker">GET IN TOUCH</p><h2>${esc(c.heading)}</h2><div class="contact-intro">${bodyHTML(c.intro)}</div>${c.location ? `<p class="contact-location">${esc(c.location)}</p>` : ''}</div>
      <div class="contact-details"><div class="contact-slip"><p class="board-kicker">CORRESPONDENCE</p>${c.email ? `<a class="contact-email" href="mailto:${encodeURIComponent(c.email)}">${esc(c.email)} <span aria-hidden="true">↗</span></a>` : '<h3>Email</h3><p class="board-muted">Contact email has not been added yet.</p>'}</div><div class="contact-slip"><p class="board-kicker">FIND ME ONLINE</p>${socials}</div></div></div>`;
  }

  function drawAbout() {
    const a = content.about;
    pane.innerHTML = `<div class="about-layout"><div class="about-lead"><p class="board-kicker">ABOUT ALEX B</p><h2>${esc(a.heading)}</h2><p class="about-intro">${esc(a.intro)}</p></div>
      <article class="about-story"><p class="board-kicker">THE MONKEY KING</p>${bodyHTML(a.body)}<div class="about-disciplines" aria-label="Creative fields"><span>Livestreaming</span><span>Television</span><span>Film</span><span>Live Entertainment</span></div></article></div>`;
  }

  function render(focus = false) {
    const focusedTab = dialog.contains(document.activeElement) ? document.activeElement?.closest('a[role="tab"]')?.getAttribute('href') : null;
    const parts = route(), section = parts[0] === 'about' ? 'about' : parts[0] === 'contact' ? 'contact' : 'portfolio';
    dialog.dataset.section = section;
    dialog.querySelectorAll<HTMLElement>('.board-primary [role="tab"]').forEach(tab => {
      const active = tab.id === `${section}-tab`;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    });
    pane.setAttribute('aria-labelledby', pageMode ? 'board-page-title' : `${section}-tab`);
    if (!loaded) pane.innerHTML = '<div class="board-empty"><p class="board-kicker">OPENING THE ARCHIVE</p><h2>One moment…</h2></div>';
    else if (loadError) pane.innerHTML = `<div class="board-empty"><h2>Unable to load the board.</h2><p>${esc(loadError)}</p>${control('reload', 'Try again')}</div>`;
    else {
      if (section === 'about') drawAbout();
      else if (section === 'contact') drawContact();
      else if (parts[1]) drawProject(parts[1], parts[2]);
      else drawPortfolio();
    }
    if (pageMode) {
      const heading = pane.querySelector<HTMLElement>('h2')!;
      heading.id = 'board-page-title'; heading.tabIndex = -1;
      pendingFocus ||= focus;
      if (pendingFocus && !dialog.hidden) { heading.focus({ preventScroll: true }); if (loaded) pendingFocus = false; }
    }
    if (focusedTab) dialog.querySelector<HTMLAnchorElement>(`a[role="tab"][href="${CSS.escape(focusedTab)}"]`)?.focus({ preventScroll: true });
  }

  function requestClose() {
    history.pushState(null, '', location.pathname + location.search);
    syncRoute();
  }

  function syncRoute() {
    const changed = location.hash !== lastRoute;
    lastRoute = location.hash;
    const isBoard = ['about', 'portfolio', 'contact'].includes(route()[0]);
    clearTimeout(closing);
    if (isBoard) {
      dialog.removeAttribute('data-closing');
      const wasClosed = modal ? !modal.open : Boolean(dialog.hidden);
      if (modal && !modal.open) modal.showModal();
      if (pageMode) dialog.hidden = false;
      render(pageMode && (changed || wasClosed));
      if (changed || wasClosed) resetScroll();
    } else {
      pendingFocus = false;
      if (pageMode) dialog.hidden = true;
      else if (modal?.open) {
        dialog.dataset.closing = 'true';
        closing = setTimeout(() => { modal.close(); dialog.removeAttribute('data-closing'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
      }
    }
    return true;
  }

  async function load() {
    loaded = false; loadError = ''; render();
    try {
      const response = await fetch(`${options.base}content/dojo.json`, { signal: listeners.signal });
      if (!response.ok) throw new Error(`Content request failed (${response.status}).`);
      content = validateContent(await response.json());
    } catch (error) { if (!listeners.signal.aborted) loadError = error instanceof Error ? error.message : 'Please try again.'; }
    loaded = true;
    if (!listeners.signal.aborted) render();
  }

  dialog.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (modal && target === modal) { requestClose(); return; }
    const categoryTab = target.closest<HTMLElement>('[data-category]');
    if (categoryTab) { category = categoryTab.dataset.category!; page = 1; drawResults(); return; }
    const pageButton = target.closest<HTMLElement>('[data-page]');
    if (pageButton) { page = Number(pageButton.dataset.page); drawResults(); resetScroll(); return; }
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'close') requestClose();
    else if (action === 'reload') void load();
  });
  dialog.addEventListener('input', event => {
    const target = event.target as HTMLInputElement;
    if (target.matches('[data-role="project-search"]')) { query = target.value; page = 1; drawResults(); }
  });
  dialog.addEventListener('change', event => {
    const target = event.target as HTMLInputElement;
    if (target.matches('[data-role="page-picker"]')) { page = Number(target.value); drawResults(); resetScroll(); }
    if (target.matches('[data-role="category-picker"]')) { category = target.value; page = 1; drawResults(); }
    if (target.matches('[data-role="project-page-picker"]')) location.hash = `portfolio/${route()[1]}/${target.value}`;
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  dialog.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const target = event.target as HTMLElement, tabs = target.closest('[role="tablist"]');
    if (!tabs || !target.matches('[role="tab"]')) return;
    const items = [...tabs.querySelectorAll<HTMLElement>('[role="tab"]')];
    const index = items.indexOf(target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    event.preventDefault(); items[next].focus(); items[next].click();
  });

  void load();
  return {
    syncRoute,
    dispose() { rememberBrowseState(); listeners.abort(); clearTimeout(closing); modal?.close(); dialog.remove(); },
  };
}
