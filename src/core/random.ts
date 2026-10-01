export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
}

export const MAX_SEED = 0xffffffff;

// mulberry32: rápido, 32 bits de estado e sequência idêntica em qualquer plataforma, o que garante reprodutibilidade por seed.
export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) throw new Error(`Seed must be an integer between 0 and ${MAX_SEED}, got ${seed}`);
  let state = seed;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    pick: (items) => {
      if (items.length === 0) throw new Error("Cannot pick from an empty list");
      return items[Math.floor(next() * items.length)]!;
    },
    weighted: (entries) => {
      const valid = entries.filter(([, weight]) => Number.isFinite(weight) && weight > 0);
      const total = valid.reduce((sum, [, weight]) => sum + weight, 0);
      if (total === 0) throw new Error("No options with positive weight");
      let roll = next() * total;
      for (const [item, weight] of valid) {
        roll -= weight;
        if (roll < 0) return item;
      }
      return valid[valid.length - 1]![0];
    },
  };
}
