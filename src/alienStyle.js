/** Small, validated styling presets shared by the registrar, stage, and saved portraits. */
export const SKINS = Object.freeze([
  { id: 'lime', label: 'Classic Slime', hex: '#b3ec63', hue: 0 },
  { id: 'mint', label: 'Mint Meteor', hex: '#6ce8af', hue: 37 },
  { id: 'aqua', label: 'Cosmic Aqua', hex: '#72dbe9', hue: 72 },
  { id: 'lilac', label: 'Grape Galaxy', hex: '#c9a3f5', hue: 141 },
  { id: 'pink', label: 'Bubblegum', hex: '#f3a0c9', hue: 197 },
  { id: 'orange', label: 'Solar Flare', hex: '#f7b46c', hue: 295 },
  { id: 'yellow', label: 'Radioactive', hex: '#e3f574', hue: -16 },
  { id: 'ice', label: 'Moonlight', hex: '#d1eef5', hue: 85 },
]);
export const ACCESSORIES = Object.freeze([
  { id: 'none', label: 'Bareheaded', icon: '◌' },
  { id: 'crown', label: 'Space Royalty', icon: '♛' },
  { id: 'headphones', label: 'DJ Ears', icon: '♫' },
  { id: 'visor', label: 'Laser Visor', icon: '▰' },
  { id: 'party', label: 'Party Hat', icon: '✦' },
  { id: 'halo', label: 'Suspicious Halo', icon: '◎' },
  { id: 'cap', label: 'Moon Cap', icon: '⌒' },
  { id: 'antennae', label: 'Mega Antennae', icon: '⚯' },
  { id: 'bow', label: 'Cosmic Bow', icon: '✿' },
]);
export const OUTFITS = Object.freeze([
  { id: 'nebula', label: 'Nebula', hex: '#8067cf' },
  { id: 'starlight', label: 'Starlight', hex: '#f4cf69' },
  { id: 'bubblegum', label: 'Bubblegum', hex: '#f07eaa' },
  { id: 'deepsea', label: 'Deep Space', hex: '#66c6d4' },
  { id: 'void', label: 'Black Hole', hex: '#364058' },
  { id: 'slime', label: 'Slime Time', hex: '#c6ef79' },
]);
export const ACCENTS = Object.freeze([
  { id: 'lemon', label: 'Neon Lemon', hex: '#e8ff70' },
  { id: 'pink', label: 'Hot Pink', hex: '#ff83ca' },
  { id: 'blue', label: 'Star Blue', hex: '#8acaff' },
  { id: 'purple', label: 'Space Purple', hex: '#b29aff' },
  { id: 'white', label: 'Moon White', hex: '#f1f7ff' },
]);
export const DEFAULT_ALIEN_STYLE = Object.freeze({ skin: 'lime', accessory: 'none', outfit: 'nebula', accent: 'lemon' });
const from = (choices, value, fallback) => choices.some(choice => choice.id === value) ? value : fallback;
export function normalizeAlienStyle(value) {
  return {
    skin: from(SKINS, value?.skin, DEFAULT_ALIEN_STYLE.skin),
    accessory: from(ACCESSORIES, value?.accessory, DEFAULT_ALIEN_STYLE.accessory),
    outfit: from(OUTFITS, value?.outfit, DEFAULT_ALIEN_STYLE.outfit),
    accent: from(ACCENTS, value?.accent, DEFAULT_ALIEN_STYLE.accent),
  };
}
export const styleChoice = (choices, id) => choices.find(choice => choice.id === id) || choices[0];
export const styleFingerprint = value => {
  const style = normalizeAlienStyle(value);
  return `${style.skin}:${style.accessory}:${style.outfit}:${style.accent}`;
};
