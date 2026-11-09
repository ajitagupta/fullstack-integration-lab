import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from models import Workout

load_dotenv()
engine = create_engine(os.environ["DATABASE_URL"])            # from DATABASE_URL, as in check_db.py
SessionLocal = sessionmaker(engine)    # a factory: SessionLocal() gives you a new session

def to_dict(workout):
    return {"id": workout.id, "sport": workout.sport, "distance_km": workout.distance_km, "duration_min": workout.duration_min}                      # id, sport, distance_km, duration_min from the object

def add_workout(data):
    with SessionLocal() as session:
        workout = Workout(sport=data["sport"], duration_min=data.get("duration_min"), distance_km=data.get("distance_km"))         # from data; distance and duration may be missing
        session.add(workout)
        session.commit()
        return to_dict(workout)        # the stored row, not the input

def get_workout_by_id(workout_id):
    with SessionLocal() as session:
        workout = session.get(Workout, workout_id)           # look up by primary key
        if workout is None:
            return None
        return to_dict(workout)                              # a dict, or None if not found

def build_conditions(sport, min_distance, min_duration):
    conditions = []
    if sport is not None:
        conditions.append(Workout.sport == sport)
    if min_distance is not None:
        conditions.append(Workout.distance_km >= min_distance)
    if min_duration is not None:
        conditions.append(Workout.duration_min >= min_duration)
    return conditions

def search_workouts(sport, min_distance, min_duration, limit, offset):
    conditions = build_conditions(sport, min_distance, min_duration)
    stmt = select(Workout).where(*conditions).order_by(Workout.id).limit(limit).offset(offset)
    with SessionLocal() as session:
        workouts = session.scalars(stmt).all()
        return [to_dict(w) for w in workouts]              # a list of dicts, using to_dict()

def count_workouts(sport, min_distance, min_duration):
    conditions = build_conditions(sport, min_distance, min_duration)
    stmt = select(func.count()).select_from(Workout).where(*conditions)
    with SessionLocal() as session:
        return session.scalar(stmt)

def add_workouts(workouts):
    # one transaction: commits at the end, rolls back on any error
    with SessionLocal.begin() as session:
        for data in workouts:
            workout = Workout(sport=data["sport"], duration_min=data.get("duration_min"), distance_km=data.get("distance_km"))         # from data; distance and duration may be missing
            session.add(workout)

    return len(workouts)             # an exception inside the block → ROLLBACK, nothing saved
        