/** Shared destinations and placement: keep the geometry, links and tests aligned. */
// One or two tenths of a millimetre collapses to about one depth-buffer step at
// the public camera. Keep multi-colour SVG layers visibly coincident but far
// enough apart that their white/brand-colour pieces cannot trade depth while
// the logo is animating.
export const LOGO_LAYER_GAP = .0015;

export const EXTERNAL_LINKS = {
  merch: { id: 'merch', label: 'Shop Monkey King merch', href: 'https://www.stickermule.com/monkeyking', color: '#e4cda4', partId: 'window-sign-merch', lane: 'merch' },
  donate: { id: 'donate', label: 'Donate to Monkey King Cobra', href: 'https://streamlabs.com/themonkeykingcobra', color: '#e4cda4', partId: 'window-sign-donate', lane: 'donate' },
  kick: { id: 'kick', label: 'Watch Monkey King Cobra on KICK', href: 'https://kick.com/monkeykingcobra', color: '#53fc18', partId: 'door-sign-kick', lane: 'door-left' },
  twitch: { id: 'twitch', label: 'Watch The Monkey King Cobra on Twitch', href: 'https://www.twitch.tv/themonkeykingcobra', color: '#9146ff', partId: 'door-sign-twitch', lane: 'door-right' },
  youtube: { id: 'youtube', label: 'Watch The Monkey King Cobra on YouTube', href: 'https://www.youtube.com/@TheMonkeyKingCobra', color: '#ff0033', partId: 'door-sign-youtube', lane: 'door-left' },
  instagram: { id: 'instagram', label: 'Follow Alex Beeezy on Instagram', href: 'https://www.instagram.com/alex_beeezy/', color: '#e9588e', partId: 'door-sign-instagram', lane: 'door-right' },
  x: { id: 'x', label: 'Follow The Monkey Cobra on X', href: 'https://x.com/themonkeycobra', color: '#eeeeee', partId: 'transom-sign-x', lane: 'door-left' },
  discord: { id: 'discord', label: 'Join the Monkey King Discord', href: 'https://discord.com/invite/alexbmkc', color: '#5865f2', partId: 'transom-sign-discord', lane: 'door-right' },
} as const;

export const SOCIAL_CHANNELS = [
  { ...EXTERNAL_LINKS.kick, name: 'KICK', account: 'monkeykingcobra' },
  { ...EXTERNAL_LINKS.twitch, name: 'Twitch', account: 'themonkeykingcobra' },
  { ...EXTERNAL_LINKS.youtube, name: 'YouTube', account: '@TheMonkeyKingCobra' },
  { ...EXTERNAL_LINKS.instagram, name: 'Instagram', account: '@alex_beeezy' },
  { ...EXTERNAL_LINKS.x, name: 'X', account: '@themonkeycobra' },
  { ...EXTERNAL_LINKS.discord, name: 'Discord', account: 'Join the community' },
] as const;

export const PILLAR_DESTINATIONS = { portfolio: '#portfolio', contact: '#contact' } as const;
export const ABOUT_DESTINATION = '#about' as const;
export const FACADE_NAVIGATION = [
  EXTERNAL_LINKS.merch,
  { id: 'portfolio', label: 'Portfolio', href: PILLAR_DESTINATIONS.portfolio, color: '#c8884e', partId: 'pillar-portfolio', lane: 'portfolio' },
  EXTERNAL_LINKS.x, EXTERNAL_LINKS.youtube, EXTERNAL_LINKS.kick,
  EXTERNAL_LINKS.discord, EXTERNAL_LINKS.instagram, EXTERNAL_LINKS.twitch,
  { id: 'contact', label: 'Contact', href: PILLAR_DESTINATIONS.contact, color: '#c8884e', partId: 'pillar-contact', lane: 'contact' },
  EXTERNAL_LINKS.donate,
] as const;

export const LOGO_PLACEMENTS = [
  { id: 'x', parent: 'transom', x: 602.5, y: 407, width: 26, svgWidth: 1200, svgHeight: 1227, z: -.161 },
  { id: 'discord', parent: 'transom', x: 719.5, y: 407, width: 36, svgWidth: 64, svgHeight: 48, z: -.161 },
  { id: 'youtube', parent: 'door-west', x: 601.5, y: 501, width: 50, svgWidth: 100, svgHeight: 70, z: -.157 },
  { id: 'instagram', parent: 'door-east', x: 718, y: 501, width: 38, svgWidth: 100, svgHeight: 100, z: -.157 },
  { id: 'kick', parent: 'door-west', x: 601.5, y: 625, width: 65, svgWidth: 77.8771, svgHeight: 26, z: -.157 },
  { id: 'twitch', parent: 'door-east', x: 718, y: 625, width: 40.5, svgWidth: 2400, svgHeight: 2800, z: -.157 },
] as const;
