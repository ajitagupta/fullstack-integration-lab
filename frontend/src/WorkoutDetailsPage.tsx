import { useParams } from 'react-router-dom';

function WorkoutDetailPage() {
  const { id} = useParams();
  return (
    <>
        <h1>Workout #{id}</h1>
    </>
  );
}

export default WorkoutDetailPage;