from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Article, ArticleRelationship, User, AccessLog  # noqa
    Base.metadata.create_all(bind=engine)
    # Create local_users table for fallback auth
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS local_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT DEFAULT '',
                role TEXT DEFAULT 'user'
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS custom_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS deleted_categories (
                name TEXT PRIMARY KEY NOT NULL
            )
        """))
        # Default local admin fallback
        import hashlib
        pw = hashlib.sha256("admin1234".encode()).hexdigest()
        conn.execute(text(
            "INSERT OR IGNORE INTO local_users (username, password_hash, display_name, role) VALUES ('admin','"+pw+"','Administrator','admin')"
        ))
        conn.commit()
