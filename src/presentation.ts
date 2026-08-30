/** Choose by viewport width, not device or orientation. */
export type Layout = 'mobile' | 'desktop';
export const NOTICEBOARD_BREAKPOINT = 640;
export function chooseLayout(width: number): Layout {
  const w = Number.isFinite(width) && width > 0 ? width : 1024;
  return w < NOTICEBOARD_BREAKPOINT ? 'mobile' : 'desktop';
}

export function routeParts(hash: string) {
  try { return hash.replace(/^#/, '').split('/').map(decodeURIComponent); }
  catch { return []; }
}

export interface BoardBrowseState { category: string; query: string; page: number }
export interface ViewOptions { boardState: BoardBrowseState }
export interface SiteView {
  dispose: () => void;
}
