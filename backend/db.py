import sqlite3

from flask import request


def get_connection():
    con = sqlite3.connect("workouts.db")
    con.row_factory = sqlite3.Row   # rows accessible by column name, not position
    return con

def init_db():
    con = get_connection()
    cur = con.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS workouts(id INTEGER PRIMARY KEY, sport TEXT, distance_km REAL, duration_min REAL)")
    con.commit()
    con.close()

def add_workout(data):
    con = get_connection()
    cur = con.cursor()
    cur.execute(
        "INSERT INTO workouts (sport, distance_km, duration_min) VALUES (?, ?, ?)",
        (data["sport"], data.get("distance_km"), data.get("duration_min"))
    )
    con.commit()
    new_id = cur.lastrowid
    con.close()
    return {"id": new_id, **data}

def get_workout_by_id(workout_id):
    con = get_connection()
    cur = con.cursor()
    cur.execute("SELECT * FROM workouts WHERE id = ?", (workout_id,))
    row = cur.fetchone()
    con.close()
    return dict(row) if row else None

def search_workouts(sport, min_distance, min_duration, limit, offset):
    conditions = []
    values = []

    if sport is not None:
        conditions.append("sport = ?")
        values.append(sport)
    if min_distance is not None:
        conditions.append("distance_km >= ?")
        values.append(min_distance)
    if min_duration is not None:
        conditions.append("duration_min >= ?")
        values.append(min_duration)

    con = get_connection()
    cur = con.cursor()
    query = "SELECT * FROM workouts"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query +=  " ORDER BY id LIMIT ? OFFSET ?"

    cur.execute(query, tuple(values) + (limit, offset))
    rows = cur.fetchall()
    con.close()
    return [dict(r) for r in rows]

def count_workouts(sport, min_distance, min_duration):
    conditions = []
    values = []

    if sport is not None:
        conditions.append("sport = ?")
        values.append(sport)
    if min_distance is not None:
        conditions.append("distance_km >= ?")
        values.append(min_distance)
    if min_duration is not None:
        conditions.append("duration_min >= ?")
        values.append(min_duration)

    con = get_connection()
    cur = con.cursor()
    query = "SELECT COUNT(*) FROM workouts"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    cur.execute(query, tuple(values))
    row = cur.fetchone()
    con.close()
    return row[0]