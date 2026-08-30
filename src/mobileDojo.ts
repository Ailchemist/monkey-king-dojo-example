import { ABOUT_DESTINATION, EXTERNAL_LINKS, PILLAR_DESTINATIONS, SOCIAL_CHANNELS } from './signage';
import { boardWood } from './boardWood';
import { routeParts, type SiteView, type ViewOptions } from './presentation';
import type { InfoBoard } from './infoBoard';
import './mobileDojo.css';

/** An HTML noticeboard: no renderer, model or scene assets in this import tree. */
export function mountMobileDojo(host: HTMLElement, options: ViewOptions): SiteView {
  const listeners = new AbortController();
  let board: InfoBoard | undefined;
  let loading: Promise<void> | undefined;
  let disposed = false;
  let previousSection = '';
  const arrow = '<span class="mobile-arrow" aria-hidden="true">↗</span>';
  host.innerHTML = `
    <header class="mobile-masthead">
      <h1 tabindex="-1">Alex B</h1><span class="mobile-signature">The Monkey King</span>
    </header>
    <div class="mobile-pages">
      <section class="mobile-home" aria-label="Home">
        <div class="mobile-grid">
          <a class="mobile-action mobile-primary mobile-about" href="${ABOUT_DESTINATION}">About <span class="mobile-arrow" aria-hidden="true">→</span></a>
          <a class="mobile-action mobile-primary" href="${PILLAR_DESTINATIONS.portfolio}">Portfolio <span class="mobile-arrow" aria-hidden="true">→</span></a>
          <a class="mobile-action mobile-primary" href="${PILLAR_DESTINATIONS.contact}">Contact <span class="mobile-arrow" aria-hidden="true">→</span></a>
        </div>
        <h2 class="mobile-section-title">WATCH &amp; CONNECT</h2>
        <div class="mobile-grid">
          ${SOCIAL_CHANNELS.map(link => `<a class="mobile-action" href="${link.href}" target="_blank" rel="noopener noreferrer">${link.name} ${arrow}</a>`).join('')}
        </div>
        <h2 class="mobile-section-title">SHOP &amp; SUPPORT</h2>
        <div class="mobile-grid">
          <a class="mobile-action" href="${EXTERNAL_LINKS.merch.href}" target="_blank" rel="noopener noreferrer">Merch ${arrow}</a>
          <a class="mobile-action" href="${EXTERNAL_LINKS.donate.href}" target="_blank" rel="noopener noreferrer">Donate ${arrow}</a>
        </div>
      </section>
      <div class="mobile-content" hidden></div>
    </div>
    <nav class="mobile-navigation" aria-label="Main navigation">
      <a href="#" data-page="home">Home</a>
      <a href="${ABOUT_DESTINATION}" data-page="about">About</a>
      <a href="${PILLAR_DESTINATIONS.portfolio}" data-page="portfolio">Portfolio</a>
      <a href="${PILLAR_DESTINATIONS.contact}" data-page="contact">Contact</a>
    </nav>`;
  const home = host.querySelector<HTMLElement>('.mobile-home')!;
  const content = host.querySelector<HTMLElement>('.mobile-content')!;
  const heading = host.querySelector<HTMLElement>('h1')!;
  const section = () => ['about', 'portfolio', 'contact'].includes(routeParts(location.hash)[0]) ? routeParts(location.hash)[0] : 'home';

  function ensureBoard() {
    if (board || loading || disposed) return;
    content.innerHTML = '<p class="mobile-board-status" role="status">Opening the noticeboard…</p>';
    loading = import('./infoBoard').then(({ createInfoBoard }) => {
      if (disposed) return;
      content.replaceChildren();
      board = createInfoBoard({
        base: import.meta.env.BASE_URL,
        presentation: 'page', mount: content, state: options.boardState,
      });
      syncRoute();
    }).catch(error => {
      if (disposed) return;
      console.error('Could not open the information board.', error);
      content.innerHTML = '<div class="mobile-board-status"><h2>Unable to open the board.</h2><p>Please try again.</p><button type="button" class="mobile-action" data-retry>Try again</button></div>';
    }).finally(() => { loading = undefined; });
  }

  function syncRoute() {
    if (disposed) return;
    // Make the new page visible before its heading receives focus.
    content.hidden = section() === 'home';
    board?.syncRoute();
    const active = section();
    home.hidden = active !== 'home';
    content.hidden = active === 'home';
    host.querySelectorAll<HTMLAnchorElement>('.mobile-navigation a').forEach(link => {
      if (link.dataset.page === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (active === 'home' && previousSection !== 'home') {
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (previousSection) heading.focus({ preventScroll: true });
    }
    previousSection = active;
    if (active !== 'home') ensureBoard();
  }

  host.addEventListener('click', event => {
    if ((event.target as HTMLElement).closest('[data-retry]')) ensureBoard();
  }, { signal: listeners.signal });
  window.addEventListener('hashchange', syncRoute, { signal: listeners.signal });
  window.addEventListener('pageshow', syncRoute, { signal: listeners.signal });
  syncRoute();
  const wood = boardWood();
  host.style.setProperty('--wood-v', `url("${wood.vertical}")`);
  host.style.setProperty('--wood-h', `url("${wood.horizontal}")`);
  document.documentElement.dataset.ready = 'true';

  return {
    dispose() { disposed = true; listeners.abort(); board?.dispose(); host.replaceChildren(); },
  };
}
