export const battleConfig = {
    encounterCount: 2,
    hero: { hp: 30, damage: [6, 8] },
    rage: { hpPerPoint: 2, max: 6, chargedDamage: 14 },
    slime: { hp: 49, damage: [5, 7], heavyEvery: 4, heavyMultiplier: 4 },
    defenseMultiplier: 0.5,
    turnLockSeconds: 0.35,
} as const;
