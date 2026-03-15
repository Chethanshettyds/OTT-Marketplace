import * as THREE from 'three';

export const platformColors: Record<string, { from: string; to: string; emoji: string }> = {
  Netflix: { from: '#E50914', to: '#B20710', emoji: '🎬' },
  'Amazon Prime': { from: '#00A8E0', to: '#FF9900', emoji: '📦' },
  'YouTube Premium': { from: '#FF0000', to: '#CC0000', emoji: '▶️' },
  'Disney+': { from: '#113CCF', to: '#0A1F8F', emoji: '✨' },
  Spotify: { from: '#1DB954', to: '#158A3E', emoji: '🎵' },
  'Apple TV+': { from: '#555555', to: '#000000', emoji: '🍎' },
  'HBO Max': { from: '#5822B4', to: '#3D1580', emoji: '👑' },
  Hulu: { from: '#1CE783', to: '#0FA85E', emoji: '📺' },
  Crunchyroll: { from: '#F47521', to: '#C45A10', emoji: '⚔️' },
  'Paramount+': { from: '#0064FF', to: '#0040CC', emoji: '⭐' },
};

export const platformLetters: Record<string, string> = {
  Netflix: 'N',
  'Amazon Prime': 'P',
  'YouTube Premium': 'YT',
  'Disney+': 'D+',
  Spotify: 'S',
  'Apple TV+': 'TV',
  'HBO Max': 'HBO',
  Hulu: 'H',
  Crunchyroll: 'CR',
  'Paramount+': 'P+',
};

export function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
