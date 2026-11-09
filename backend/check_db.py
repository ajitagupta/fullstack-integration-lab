from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, text

load_dotenv()                               # reads backend/.env into the environment
url = os.environ["DATABASE_URL"]            # get DATABASE_URL from os.environ
engine = create_engine(url)                 # create the engine from url


with engine.connect() as conn:              # opens a connection, closes it automatically
    result = conn.execute(text("SELECT version();"))# your SELECT version() query
    print(result.scalar())                  # result.scalar() gives the single value

    