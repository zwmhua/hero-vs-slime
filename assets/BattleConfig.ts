export const battleConfig = {
    hero: { hp: 30, damage: [6, 8] },
    rage: { hpPerPoint: 2, max: 6, chargedDamage: 14 },
    slime: { hp: 24, damage: [4, 6], heavyEvery: 3, heavyMultiplier: 4 },
    defenseMultiplier: 0.5,
    turnLockSeconds: 0.35,
} as const;
