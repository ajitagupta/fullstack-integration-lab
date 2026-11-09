import os
from dotenv import load_dotenv
import pytest
from sqlalchemy import text

load_dotenv()
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]

import db

@pytest.fixture(autouse=True)
def clean_database():
    with db.engine.begin() as conn:
        conn.execute(text("TRUNCATE workouts RESTART IDENTITY"))       # the TRUNCATE statement, wrapped in text()