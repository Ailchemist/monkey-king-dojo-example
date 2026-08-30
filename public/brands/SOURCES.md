# Storefront and door signs

- KICK wordmark: [official KICK brand page](https://about.kick.com/brand), SVG from `https://about.kick.com/img/kick-logo.svg`. The wordmark path is used without the small BETA annotation. Original green: `#53FC18`.
- Twitch Glitch: [official Twitch brand assets](https://brand.twitch.com/), `Twitch-Brand.zip`, `Twitch Logos/02. Glitch/01. Twitch Purple/glitch_flat_purple.svg`. Original white and Twitch Purple `#9146FF` paths are preserved.
- YouTube and Instagram upper door glass signs: locally drawn SVG icon treatments. The Instagram background receives vertex-color shading in Three.js. These sit below the transom on the actual door leaves. They link to the user-provided YouTube @TheMonkeyKingCobra and Instagram alex_beeezy accounts, with hover feedback.
- X: white `logo.svg` from the [official X brand toolkit](https://about.x.com/en/who-we-are/brand-toolkit), downloaded in the [X logo archive](https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-logo.zip). Placed in the left transom pane above the doors.
- Discord: white symbol from the [official Discord branding page](https://discord.com/branding), using its [symbol SVG](https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e3d7f4ef6498ac018f2c55_Symbol.svg). Placed in the right transom pane above the doors.

KICK and Twitch now sit on the lower door glass, left and right respectively. All six social marks are vector geometry, and the four door-leaf signs follow their respective doors. All external signs use the user's exact destinations, open new tabs, and retain hover/focus feedback.

MERCH and DONATE replace the two large display-window graphics. Their lettering, T-shirt, heart, rim and underline are original code-native geometry in `src/pillarLettering.ts` and `src/createDojoModel.ts`, not third-party store or payment logos. The full glass panes link to the supplied Sticker Mule store and Streamlabs donation page. The original central cobra mural is unchanged.

These logos are trademarks of their respective owners. Their inclusion follows the user's requested window design and does not imply sponsorship or endorsement. Consult each owner's brand guidance before publishing.
