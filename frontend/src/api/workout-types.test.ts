import { describe, expect, it } from 'vitest';
import { parseWorkout } from './workout-types';
import { InvalidResponseError } from './api-error';

describe('parseWorkout', () => {
  it('accepts a valid workout', () => {
    const data = { id: 1, sport: 'run', distance_km: 5, duration_min: 30 };
    expect(parseWorkout(data)).toEqual({ id: 1, sport: 'run', distance_km: 5, duration_min: 30 });
  });

  it('rejects a distance sent as a string', () => {
    const data = { id: 1, sport: 'run', distance_km: '5', duration_min: 30 };
    expect(() => parseWorkout(data)).toThrow(InvalidResponseError);
  });
});