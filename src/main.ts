import { chooseLayout, type Layout, type SiteView, type BoardBrowseState } from './presentation';
import './style.css';

const app = document.querySelector<HTMLElement>('#app')!;
const review = import.meta.env.DEV && new URLSearchParams(location.search).has('review');
const boardState: BoardBrowseState = { category: 'all', query: '', page: 1 };
let current: Layout | undefined;
let view: SiteView | undefined;
let generation = 0;
let frame = 0;
let stopped = false;

async function updateLayout() {
  if (stopped) return;
  // innerWidth includes the scrollbar, avoiding a breakpoint feedback loop.
  const next = review ? 'desktop' : chooseLayout(window.innerWidth);
  if (next === current) return;
  const request = ++generation;
  view?.dispose();
  view = undefined;
  current = next;
  document.documentElement.dataset.layout = next;
  delete document.documentElement.dataset.ready;
  delete document.documentElement.dataset.viewport;
  delete document.documentElement.dataset.viewLocked;
  delete document.documentElement.dataset.buildStage;
  const host = document.createElement('main');
  host.id = next === 'mobile' ? 'mobile-dojo' : 'scene';
  host.setAttribute('aria-label', next === 'mobile' ? 'Monkey King Dojo noticeboard' : 'Monkey King Dojo — interactive 3D frontage with portfolio, contact and social links');
  app.replaceChildren(host);
  const options = { boardState };
  try {
    if (next === 'mobile') {
      const { mountMobileDojo } = await import('./mobileDojo');
      if (request === generation && !stopped) view = mountMobileDojo(host, options);
    } else {
      const { mountDesktopScene } = await import('./desktopScene');
      if (request === generation && !stopped) view = mountDesktopScene(host, options);
    }
  } catch (error) {
    if (request !== generation || stopped) return;
    console.error('Could not load the dojo presentation.', error);
    host.innerHTML = '<div class="site-load-error"><h1>Unable to open the dojo.</h1><p>Please reload to try again.</p><button type="button">Reload</button></div>';
    host.querySelector('button')!.addEventListener('click', () => location.reload(), { once: true });
  }
}

function scheduleLayout() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => { frame = 0; void updateLayout(); });
}
const listeners = new AbortController();
window.addEventListener('resize', scheduleLayout, { signal: listeners.signal });
window.addEventListener('pageshow', scheduleLayout, { signal: listeners.signal });
if (import.meta.hot) import.meta.hot.dispose(() => {
  stopped = true; generation++; cancelAnimationFrame(frame); listeners.abort(); view?.dispose();
});
void updateLayout();
