import { describe, expect, it } from 'vitest';
import { battleOutcome, resolveTurn, startBattle } from '../assets/logic/Battle';

const low = () => 0;
const high = () => 0.99;

describe('battle settlement', () => {
    it('rolls ordinary attack damage and gives the slime a counterattack', () => {
        const result = resolveTurn(startBattle(), 'attack', high)!;
        expect(result.strike).toBe(8);
        expect(result.state).toMatchObject({ hero: 24, slime: 34, rage: 3 });
    });

    it('rounds up defense damage and gains rage from the reduced HP loss', () => {
        const result = resolveTurn(startBattle(), 'defend', () => 0.5)!;
        expect(result.counter).toEqual({ damage: 3, blocked: 2, gained: 2 });
        expect(result.state).toMatchObject({ hero: 27, slime: 42, rage: 2 });
        expect(resolveTurn(startBattle(), 'defend', high)!.counter).toEqual({ damage: 3, blocked: 3, gained: 2 });
    });

    it('gains rage only for HP actually lost and floors hero HP at zero', () => {
        const result = resolveTurn({ ...startBattle(), hero: 1 }, 'attack', high)!;
        expect(result.state).toMatchObject({ hero: 0, rage: 1 });
        expect(battleOutcome(result.state)).toBe('defeat');
        expect(resolveTurn(result.state, 'attack', low)).toBeNull();
    });

    it('caps rage and rejects charging before rage is full', () => {
        expect(resolveTurn(startBattle(), 'charge', low)).toBeNull();
        const result = resolveTurn({ ...startBattle(), rage: 5 }, 'attack', high)!;
        expect(result.counter?.gained).toBe(1);
        expect(result.state.rage).toBe(6);
    });

    it('spends full rage for ordinary damage outside the interrupt window', () => {
        const result = resolveTurn({ ...startBattle(), rage: 6 }, 'charge', low)!;
        expect(result.strike).toBe(6);
        expect(result.state).toMatchObject({ hero: 26, slime: 36, rage: 2 });
        expect(result.interrupted).toBe(false);
        const lethal = resolveTurn({ ...startBattle(), hero: 1, rage: 6 }, 'charge', low)!;
        expect(lethal.state).toMatchObject({ hero: 0, rage: 1 });
    });

    it('warns before a heavy hit and lets a charged attack cancel it', () => {
        const first = resolveTurn({ ...startBattle(), rage: 6 }, 'defend', low)!;
        expect(first.state).toMatchObject({ turn: 1, slimeCharging: false });
        const warning = resolveTurn(first.state, 'defend', low)!;
        expect(warning.counter?.damage).toBe(2);
        expect(warning.state.turn).toBe(2);
        expect(warning.state.slimeCharging).toBe(true);
        const result = resolveTurn(warning.state, 'charge', low)!;
        expect(result).toMatchObject({ strike: 14, interrupted: true });
        expect(result.counter).toBeUndefined();
        expect(result.state).toMatchObject({ hero: warning.state.hero, slime: 28, rage: 0, turn: 3, slimeCharging: false });
        const heavy = resolveTurn(warning.state, 'attack', low)!;
        expect(heavy.counter?.damage).toBe(16);
        expect(heavy.state).toMatchObject({ turn: 3, slimeCharging: false });
        expect(resolveTurn(warning.state, 'defend', low)!.counter?.damage).toBe(8);
    });

    it('floors slime HP at zero, skips retaliation and locks out further actions', () => {
        const result = resolveTurn({ ...startBattle(), slime: 1 }, 'attack', low)!;
        expect(result.state).toMatchObject({ hero: 30, slime: 0 });
        expect(result.counter).toBeUndefined();
        expect(battleOutcome(result.state)).toBe('victory');
        expect(resolveTurn(result.state, 'defend', low)).toBeNull();
    });
});
