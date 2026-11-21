import os
from dotenv import load_dotenv
from sqlalchemy import Date, create_engine, select, func, text
from sqlalchemy.orm import sessionmaker
from models import Workout
from datetime import date, timedelta

load_dotenv()
engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)            # from DATABASE_URL, as in check_db.py
SessionLocal = sessionmaker(engine)    # a factory: SessionLocal() gives you a new session

SORT_COLUMNS = {
    "id": Workout.id,
    "distance_km": Workout.distance_km,
    "duration_min": Workout.duration_min,
}

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

def update_workout(workout_id, data):
    with SessionLocal() as session:
        workout = session.get(Workout, workout_id)
        if workout is None:
            return None
        workout.sport = data["sport"]
        workout.duration_min = data.get("duration_min")
        workout.distance_km = data.get("distance_km")
        session.commit()
        return to_dict(workout)

def delete_workout(workout_id):
    with SessionLocal() as session:
        workout = session.get(Workout, workout_id)
        if workout is None:
            return False
        session.delete(workout)
        session.commit()
        return True
    
def build_conditions(sport, min_distance, min_duration):
    conditions = []
    if sport is not None:
        conditions.append(Workout.sport == sport)
    if min_distance is not None:
        conditions.append(Workout.distance_km >= min_distance)
    if min_duration is not None:
        conditions.append(Workout.duration_min >= min_duration)
    return conditions

def search_workouts(sport, min_distance, min_duration, limit, offset, sort="id"):
    conditions = build_conditions(sport, min_distance, min_duration)
    descending = sort.startswith("-")
    column = SORT_COLUMNS[sort[1:] if descending else sort]
    order = column.desc() if descending else column.asc()
    stmt = (
        select(Workout)
        .where(*conditions)
        .order_by(order.nulls_last(), Workout.id)     # id = the tie-breaker
        .limit(limit)
        .offset(offset)
    )    
    conditions = build_conditions(sport, min_distance, min_duration)
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
            fields = {"sport": data["sport"], "distance_km": data.get("distance_km"), "duration_min": data.get("duration_min")}
            if data.get("performed_on") is not None:
                fields["performed_on"] = data.get("performed_on")
            workout = Workout(**fields)
            session.add(workout)

    return len(workouts)             # an exception inside the block → ROLLBACK, nothing saved

def weekly_stats(weeks):
    today = date.today()
    start = today - timedelta(days=today.weekday()) - timedelta(weeks=weeks - 1)   # Monday, (weeks-1) weeks ago

    week_start = func.date_trunc("week", Workout.performed_on).cast(Date).label("week_start")
    stmt = (
        select(
            week_start,
            Workout.sport,
            func.count().label("workouts"),
            func.coalesce(func.sum(Workout.distance_km), 0).label("distance_km"),
            func.coalesce(func.sum(Workout.duration_min), 0).label("duration_min"),
        )
        .where(Workout.performed_on >= start)
        .group_by(week_start, Workout.sport)
        .order_by(week_start, Workout.sport)
    )
    with SessionLocal() as session:
        rows = session.execute(stmt).all()
    return [
        {"week_start": r.week_start.isoformat(), "sport": r.sport, "workouts": r.workouts,
         "distance_km": round(r.distance_km, 1), "duration_min": r.duration_min}
        for r in rows
    ]

def existing_workout_keys(dates):
    """All (sport, distance_km, duration_min, performed_on) on the given dates, as a set."""
    stmt = select(Workout.sport, Workout.distance_km, Workout.duration_min, Workout.performed_on).where(
        Workout.performed_on.in_(dates)              # only the dates that appear in the file
    )
    with SessionLocal() as session:
        rows = session.execute(stmt).all()
    return {tuple(r) for r in rows}

def ping():
    """Raises if the database can't be reached."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))