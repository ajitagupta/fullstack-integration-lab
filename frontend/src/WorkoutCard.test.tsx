import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import WorkoutCard from './WorkoutCard';

test('displays the workout sport and distance', () => {
  render(<WorkoutCard sport="swim" distance={0.6} />);   // ARRANGE + ACT: render it

  expect(screen.getByText('swim')).toBeInTheDocument();   // ASSERT: "swim" is shown
  expect(screen.getByText('0.6 km')).toBeInTheDocument(); // ASSERT: "0.6 km" is shown
});