import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/cloud_worker.db")
# Fix postgres URL prefix if deployed on Railway
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite connect_args
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# Ensure data dir exists if sqlite
if DATABASE_URL.startswith("sqlite:///./data"):
    os.makedirs("./data", exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CapturedSite(Base):
    __tablename__ = "captured_sites"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(String(100), unique=True, index=True, nullable=False)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    tower_type = Column(String(50), default="Rooftop")
    state = Column(String(100), nullable=True, index=True)
    district = Column(String(100), nullable=True, index=True)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkerSession(Base):
    __tablename__ = "worker_sessions"

    id = Column(Integer, primary_key=True, index=True)
    cookie_header = Column(Text, nullable=False)
    asp_session_id = Column(String(255), nullable=True)
    verification_token = Column(String(255), nullable=True)
    is_valid = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkerJob(Base):
    __tablename__ = "worker_jobs"

    id = Column(Integer, primary_key=True, index=True)
    state_name = Column(String(100), nullable=False)
    district_name = Column(String(100), nullable=False)
    status = Column(String(50), default="idle")  # 'idle', 'running', 'paused', 'completed', 'failed'
    current_slide = Column(Integer, default=0)
    total_slides = Column(Integer, default=0)
    sites_captured = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkerLog(Base):
    __tablename__ = "worker_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20), default="INFO")
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
