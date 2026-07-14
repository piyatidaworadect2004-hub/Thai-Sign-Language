from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Integer, String
from .database import Base

# ==========================
# Category
# ==========================
class Category(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)

    name: str

    description: str

    difficulty: str

    total_words: int

    image: str


# ==========================
# User
# ==========================
class User(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)

    username: str = Field(index=True, unique=True)

    email: str = Field(index=True, unique=True)

    password_hash: str

    role: str = "user"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default="user")