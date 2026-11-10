import { describe, expect, it } from 'vitest';
import { advanceEncounter, resolveTurn, runStatus, startRun } from '../assets/logic/Battle';
import type { BattleAction } from '../assets/logic/Battle';

function play(run: ReturnType<typeof startRun>, actions: BattleAction[]) {
    for (const action of actions) {
        run = { ...run, battle: resolveTurn(run.battle, action, () => 0.99)!.state };
    }
    return run;
}

const win: BattleAction[] = ['attack', 'attack', 'attack', 'charge', 'attack', 'attack'];

describe('consecutive encounters', () => {
    it('opens encounter two after victory and resets the battle', () => {
        const firstWin = play(startRun(), win);
        expect(runStatus(firstWin)).toBe('next');
        const second = advanceEncounter(firstWin)!;
        expect(second.encounter).toBe(2);
        expect(second.battle).toEqual({ hero: 30, slime: 49, rage: 0, turn: 0, slimeCharging: false });
    });

    it('clears the run after the second victory', () => {
        const second = advanceEncounter(play(startRun(), win))!;
        const cleared = play(second, win);
        expect(runStatus(cleared)).toBe('cleared');
        expect(advanceEncounter(cleared)).toBeNull();
    });

    it('allows a fresh run from encounter one after defeat in encounter two', () => {
        const second = advanceEncounter(play(startRun(), win))!;
        const defeated = play(second, ['attack', 'attack', 'attack', 'attack']);
        expect(runStatus(defeated)).toBe('defeat');
        expect(advanceEncounter(defeated)).toBeNull();
        expect(startRun()).toEqual({
            encounter: 1,
            battle: { hero: 30, slime: 49, rage: 0, turn: 0, slimeCharging: false },
        });
    });

    it('cannot skip an encounter in progress', () => {
        const ongoing = play(startRun(), ['attack']);
        expect(runStatus(ongoing)).toBeNull();
        expect(advanceEncounter(ongoing)).toBeNull();
    });
});
