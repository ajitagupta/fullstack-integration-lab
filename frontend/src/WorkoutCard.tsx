interface WorkoutCardProps {
  sport: string;
  distance: number;
}

function WorkoutCard({ sport, distance }: WorkoutCardProps) {
  return (
    <div>
      <h2>{sport}</h2>
      <p>{distance} km</p>
    </div>
  );
}

export default WorkoutCard;