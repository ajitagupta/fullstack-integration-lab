from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import CheckConstraint, Date, Float, Index, Integer, String, func, text
from datetime import date

class Base(DeclarativeBase):
    pass

class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sport: Mapped[str] = mapped_column(String(20), nullable=False)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    performed_on: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())

    __table_args__ = (
        CheckConstraint("sport IN ('swim', 'run', 'cycle', 'strength', 'badminton', 'rest')", name="ck_workouts_sport_allowed"),
        CheckConstraint("distance_km is NULL or distance_km >= 0", name="ck_workouts_distance_non_negative"),
        CheckConstraint("duration_min is NULL or duration_min >= 0", name="ck_workouts_duration_non_negative"),
        CheckConstraint("sport NOT in ('run', 'swim', 'cycle') OR distance_km IS NOT NULL", name="ck_workouts_distance_required"),
        CheckConstraint("sport in ('rest') OR duration_min IS NOT NULL", name="ck_workouts_duration_required"),
        Index("ix_workouts_sport_distance",
          "sport", text("distance_km DESC NULLS LAST"), "id"),
        Index("ix_workouts_sport_duration",
          "sport", text("duration_min DESC NULLS LAST"), "id"),
    )