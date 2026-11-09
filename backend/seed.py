import random
from sqlalchemy import text
import db

# 1. Empty the table
with db.engine.begin() as conn:
    conn.execute(text("TRUNCATE workouts RESTART IDENTITY"))

# 2. Build the sample workouts
random.seed(42)
workouts = []
for i in range(40):
    sport = random.choice(['swim', 'run', 'cycle', 'badminton', 'strength', 'rest'])          # the six sports
    distance_km = round(random.uniform(1, 20), 1)
    duration_min = random.randint(20, 90)
    if sport in ['swim', 'run', 'cycle']:                     # needs distance and duration
        workouts.append({"sport": sport, "distance_km": distance_km, "duration_min": duration_min})
    elif sport == "rest":                                     # needs neither
        workouts.append({"sport": "rest"})
    else:                                                     # badminton, strength: duration only
        workouts.append({"sport": sport, "duration_min": duration_min})

# 3. Save them in one transaction
count = db.add_workouts(workouts)

# 4. Report
print(f"Seeded {count} workouts")