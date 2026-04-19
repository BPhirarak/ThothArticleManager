from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(200), default="")
    role = Column(String(20), default="user")   # "admin" | "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), default="system")


class AccessLog(Base):
    __tablename__ = "access_logs"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False, index=True)
    action = Column(String(100), nullable=False)   # login, logout, upload, download, chat, delete
    detail = Column(Text, default="")
    ip = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False, index=True)
    summary_en = Column(Text, default="")
    summary_th = Column(Text, default="")
    key_insights = Column(JSON, default=list)
    tags = Column(JSON, default=list)
    topic_category = Column(String(100), default="General")
    pdf_path = Column(String(500), default="")
    source_url = Column(String(500), default="")
    publication_date = Column(String(20), default="")
    # Ownership & visibility
    owner = Column(String(100), default="system")       # username of uploader
    visibility = Column(String(10), default="public")   # "public" | "private"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_relationships = relationship(
        "ArticleRelationship",
        foreign_keys="ArticleRelationship.source_id",
        back_populates="source",
        cascade="all, delete-orphan",
    )
    target_relationships = relationship(
        "ArticleRelationship",
        foreign_keys="ArticleRelationship.target_id",
        back_populates="target",
        cascade="all, delete-orphan",
    )


class ArticleRelationship(Base):
    __tablename__ = "article_relationships"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    target_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    relationship_type = Column(String(50), default="similarity")
    weight = Column(Float, default=0.0)
    shared_tags = Column(JSON, default=list)

    source = relationship("Article", foreign_keys=[source_id], back_populates="source_relationships")
    target = relationship("Article", foreign_keys=[target_id], back_populates="target_relationships")
