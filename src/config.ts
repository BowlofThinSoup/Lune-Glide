export interface Config {
  animationLength: number;
  shortAnimationLength: number;
  trailSize: number;
  animateTyping: boolean;
  respectReducedMotion: boolean;
  vfx: 'none' | 'railgun';
  particleLifetime: number;
  particleCount: number;
}
export const defaults: Config = {
  animationLength: 0.15, shortAnimationLength: 0.04, trailSize: 1,
  animateTyping: true, respectReducedMotion: true, vfx: 'none',
  particleLifetime: 0.5, particleCount: 64,
};
export function normalizeConfig(input: unknown): Config {
  const v = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const number = (key: keyof Config, min: number, max: number): number => {
    const n = v[key];
    return typeof n === 'number' && Number.isFinite(n)
      ? Math.max(min, Math.min(max, n)) : defaults[key] as number;
  };
  return {
    animationLength: number('animationLength', 0, 1),
    shortAnimationLength: number('shortAnimationLength', 0, 1),
    trailSize: number('trailSize', 0, 1),
    animateTyping: typeof v.animateTyping === 'boolean' ? v.animateTyping : defaults.animateTyping,
    respectReducedMotion: typeof v.respectReducedMotion === 'boolean' ? v.respectReducedMotion : true,
    vfx: v.vfx === 'railgun' ? 'railgun' : 'none',
    particleLifetime: number('particleLifetime', 0.05, 2),
    particleCount: Math.round(number('particleCount', 0, 256)),
  };
}
