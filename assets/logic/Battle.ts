import { battleConfig as config } from '../BattleConfig';

export type BattleAction = 'attack' | 'defend' | 'charge';
type BattleState = { hero: number; slime: number; rage: number; turn: number; slimeCharging: boolean };

export function startBattle(): BattleState {
    return { hero: config.hero.hp, slime: config.slime.hp, rage: 0, turn: 0, slimeCharging: false };
}

export function battleOutcome({ hero, slime }: BattleState) {
    if (slime === 0) return 'victory';
    if (hero === 0) return 'defeat';
    return null;
}

export function resolveTurn(state: BattleState, action: BattleAction, random = Math.random) {
    if (battleOutcome(state) || (action === 'charge' && state.rage < config.rage.max)) return null;

    const defending = action === 'defend';
    const heavy = state.slimeCharging;
    const interrupted = action === 'charge' && heavy;
    const roll = ([min, max]: readonly [number, number]) => min + Math.floor(random() * (max - min + 1));
    const strike = defending ? 0 : interrupted ? config.rage.chargedDamage : roll(config.hero.damage);
    const next = {
        hero: state.hero,
        slime: Math.max(0, state.slime - strike),
        rage: action === 'charge' ? 0 : state.rage,
        turn: state.turn + 1,
        slimeCharging: false,
    };

    let counter: { damage: number; blocked: number; gained: number } | undefined;
    if (next.slime > 0 && !interrupted) {
        const strikeBack = roll(config.slime.damage) * (heavy ? config.slime.heavyMultiplier : 1);
        const damage = defending ? Math.ceil(strikeBack * config.defenseMultiplier) : strikeBack;
        const hpLost = Math.min(next.hero, damage);
        const gained = Math.min(config.rage.max - next.rage, Math.ceil(hpLost / config.rage.hpPerPoint));
        next.hero -= hpLost;
        next.rage += gained;
        counter = { damage, blocked: strikeBack - damage, gained };
    }

    next.slimeCharging = !battleOutcome(next) && (next.turn + 1) % config.slime.heavyEvery === 0;
    return { state: next, strike, interrupted, counter };
}

export function startRun() {
    return { encounter: 1, battle: startBattle() };
}

type BattleRun = ReturnType<typeof startRun>;

export function runStatus(run: BattleRun) {
    const outcome = battleOutcome(run.battle);
    if (outcome !== 'victory') return outcome;
    return run.encounter < config.encounterCount ? 'next' : 'cleared';
}

export function advanceEncounter(run: BattleRun): BattleRun | null {
    if (runStatus(run) !== 'next') return null;
    return { encounter: run.encounter + 1, battle: startBattle() };
}
