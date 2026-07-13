from sqlmodel import SQLModel, create_engine

DATABASE_URL = "sqlite:///learning.db"

engine = create_engine(
    DATABASE_URL,
    echo=True,
    connect_args={"check_same_thread": False}
)

def create_db():
    SQLModel.metadata.create_all(engine)