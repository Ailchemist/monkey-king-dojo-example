# Monkey King Dojo

A Three.js dojo frontage with a locked frontal camera, plus a wooden noticeboard for narrow screens. Both presentations use the same links, portfolio content and contact details.

## Screen-size behavior

| Available viewport width | Presentation |
| --- | --- |
| Below 640 CSS px | Mobile noticeboard with large Portfolio, Contact, social, Merch and Donate links |
| 640 CSS px and wider | Original 3D dojo, with no surrounding website layout |

The switch is based only on viewport width, not device detection or orientation. Resizing the window or rotating a phone updates the presentation automatically; most landscape phones show the dojo. The 3D view keeps its centered cinematic framing, with the roof, doors and pavement visible and the unfinished outer ends cropped.

Narrow screens use ordinary document scrolling, controls at least 48 px high and full-width portfolio/contact pages. The home page does not load Three.js, the model or its textures. Content loads when Portfolio or Contact is opened. Both presentations preserve the same hash URL, category, search and results page across resizing.

## Explore the dojo

- **MERCH** fills the left display window; **DONATE** fills the right.
- **X** and **Discord** are in the small transom panes above the doors.
- **YouTube** and **Instagram** are on the upper glass of the actual doors.
- **KICK** and **Twitch** are on the lower door glass.
- **PORTFOLIO** runs down the left inner pillar; **CONTACT** runs down the right.

All eight external signs open new tabs. Hover and keyboard focus lift and highlight the signs; clicking does not wait for an animation. Native modifier-click behavior is preserved, reduced-motion preferences use color feedback without movement, and rendering stops while idle. The entire Merch and Donate glass panes are clickable. Stacked door links use separate rows and columns to prevent overlap within the scene. The narrow noticeboard uses labelled HTML links instead.

| Sign | Destination |
| --- | --- |
| Merch | [Monkey King store](https://www.stickermule.com/monkeyking) |
| Donate | [The Monkey King Cobra on Streamlabs](https://streamlabs.com/themonkeykingcobra) |
| X | [themonkeycobra](https://x.com/themonkeycobra) |
| Discord | [Monkey King invite](https://discord.com/invite/alexbmkc) |
| KICK | [monkeykingcobra](https://kick.com/monkeykingcobra) |
| Twitch | [themonkeykingcobra](https://www.twitch.tv/themonkeykingcobra) |
| YouTube | [@TheMonkeyKingCobra](https://www.youtube.com/@TheMonkeyKingCobra) |
| Instagram | [alex_beeezy](https://www.instagram.com/alex_beeezy/) |

The two pillars open an aged wooden information board. It has Portfolio/Contact tabs, category filters, search, six projects per results page, individual project pages and additional tabs within each project. Contact includes the supplied email and all six social channels: KICK, Twitch, YouTube, Instagram, X and Discord. Its social links share destinations with the scene and open new tabs. Close the desktop board with its × button, the backdrop, or Escape. The mobile noticeboard has Home / Portfolio / Contact navigation, a category selector, and wrapping project tabs; projects with more than three subpages use a labelled selector. Project pages have shareable hash URLs such as `#portfolio/project-name/process`.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm test` checks width-based presentation selection, shared routes, framing, hover motion, ten scene hit targets, read-only content validation, filtering and pagination. `npm run build` typechecks and creates `dist/`; `npm run preview` serves that production build locally.

On Windows, double-click **Run Dist Server.bat** in the project folder to build the latest production files, serve `dist/` at the local preview address, and open it automatically. Keep its console window open while testing; close the window or press Ctrl+C to stop the server. The launcher binds only to `127.0.0.1` and does not expose the preview to other devices on the network.

## Low-cost static hosting

Deploy only the generated `dist/` directory to a static CDN. The site has no server, database, upload route, analytics beacon or paid runtime API. Mobile starts without Three.js or the façade texture; portfolio media uses native lazy loading. The current public media is about 237 KiB total, and the largest possible six-cover portfolio page is about 59 KiB.

`npm run check:assets` enforces modern WebP/AVIF media, a 200 KiB texture ceiling, a 150 KiB portfolio-image ceiling and a 900 KiB six-cover page ceiling. It also runs automatically before every production build and as part of the test suite. Content-hashed media filenames allow safe immutable caching. `public/_headers` supplies year-long cache rules for hosts that support the Cloudflare Pages/Netlify headers format; configure equivalent rules if the chosen host ignores that file, and enable Brotli or gzip for JavaScript, CSS, JSON and SVG.

Application code can bound bytes per visit, but it cannot control a hosting provider's billing policy. Before launch, enable the provider's hard spending or usage cap and CDN/DDoS protection, and do not attach serverless functions to this static deployment. A budget alert alone is not a cap.

### GitHub Pages example deployment

The repository includes `.github/workflows/pages.yml`. On pushes to `main`, it installs the locked dependencies, validates and builds the site, then publishes `dist/` through GitHub Pages. The Vite base path is derived from GitHub's repository name during Actions builds, while local previews and domain-root hosts continue to use `/`.

For a new public repository, select **Settings → Pages → Source: GitHub Actions** once. Subsequent pushes to `main` deploy automatically.

## Add projects and contact details

Portfolio and Contact are read-only at runtime. Edit `public/content/dojo.json` directly in the repository, then rebuild the site. Each project contains its title, category, date, summary, optional cover/link, Featured flag and an array of subpages. Image paths may point at files committed under `public/` or at approved HTTPS URLs. Store local artwork as WebP/AVIF under `public/portfolio/`, keep it below 150 KiB, and include a short content hash in the filename so it can be cached permanently. Text uses plain paragraphs; a blank line separates paragraphs. The collection supports up to 5,000 projects and 50 pages per project; search and pagination keep large collections manageable.

The contact address is **alexander@bernardfinancialllc.com**. The portfolio currently contains Cobra Pit, False Hawks (2025) and Fishtank.live. No More Heroes, AlexB.live and the old example/placeholder page are excluded. There is no browser editor, content write endpoint, upload endpoint or development fixture route. Social, Merch and Donate destinations are hardcoded in `src/signage.ts`.

## Implementation

- `src/createDojoModel.ts`: reusable architecture, door signs, and named parts.
- `src/main.ts`, `src/presentation.ts`: width-based startup, lazy presentation switching, shared routes and browse state.
- `src/desktopScene.ts`, `src/desktopScene.css`: original lighting, rendering, scene framing and page lifecycle.
- `src/mobileDojo.ts`, `src/mobileDojo.css`: mobile noticeboard, ordinary scrolling and large native links.
- `src/framing.ts`: safe crop and maximum stage aspect ratio.
- `src/signage.ts`: shared destinations, sign placements and navigation order.
- `src/channelLinks.ts`: ten projected native targets, column/row spacing and centered hover motion.
- `src/pillarLettering.ts`: beveled pillar lettering and vector storefront lettering.
- `src/infoBoard.ts`, `src/infoBoard.css`, `src/boardWood.ts`: shared read-only desktop dialog/mobile content pages.
- `src/content.ts`, `public/content/dojo.json`: content schema, filtering and repository-authored Portfolio/Contact data.
- `src/materials.ts`: reference-derived paint and procedural material channels.

The painted facade comes from the supplied reference. Hidden sides, interior depth and real-world dimensions are approximate. Asset provenance is in `public/brands/SOURCES.md`. Reconstruction evidence is in `.img2threejs/`; model review routes and reports are disabled in production. Local `?review` routes always use the 3D presentation, independent of width. Formal later model-pass gates remain tracked separately from the website interaction checks in `Tasks.log`. Browser viewport checks do not replace physical iOS/Android touch testing; the mobile plan and remaining device checks are recorded in `MOBILE-PLAN.md`.

