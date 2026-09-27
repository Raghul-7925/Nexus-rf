"""
app/db/models.py

SQLite-backed models for the solo build (see README.md for why SQLite
instead of PostgreSQL/PostGIS here -- swap the engine URL in session.py
if you later move to Postgres; these models don't change).
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, DateTime, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()


def gen_id() -> str:
    return str(uuid.uuid4())


class Tower(Base):
    __tablename__ = "towers"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    operator = Column(String, nullable=True)       # Jio / Airtel / Vi / BSNL / None
    technology = Column(String, nullable=True)      # 2G/3G/4G/5G
    freq_mhz = Column(Float, nullable=True)
    bandwidth_mhz = Column(Float, nullable=True)
    height_m = Column(Float, nullable=True, default=25.0)
    power_dbm = Column(Float, nullable=True, default=43.0)
    tower_type = Column(String, nullable=True)       # Rooftop / Ground / Wall mount
    azimuth_deg = Column(Float, nullable=True)        # None = omni
    source = Column(String, default="manual")         # manual | tarangsanchar_seed | import
    cell_id = Column(String, nullable=True)
    site_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Obstacle(Base):
    __tablename__ = "obstacles"

    id = Column(String, primary_key=True, default=gen_id)
    # polygon stored as a JSON list of [lat, lng] pairs -- simplest thing
    # that works without a spatial extension; fine at solo-project scale
    points = Column(JSON, nullable=False)
    height_m = Column(Float, default=12.0)
    obstacle_type = Column(String, default="building")
    created_at = Column(DateTime, default=datetime.utcnow)


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(String, primary_key=True, default=gen_id)
    filename = Column(String, nullable=True)
    row_count = Column(Float, default=0)
    format = Column(String, nullable=True)   # csv | json | geojson
    created_at = Column(DateTime, default=datetime.utcnow)
