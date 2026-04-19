from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
import os

from database import init_db
from config import settings
from routers import articles, graph, chat, dashboard, agent
from routers.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="SYS Knowledge Hub API",
    description="Steel Industry Knowledge Management System — SYS Co., Ltd.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded PDFs
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

app.include_router(articles.router, prefix="/api/articles", tags=["Articles"])
app.include_router(graph.router, prefix="/api/graph", tags=["Graph"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(agent.router, prefix="/api/agent", tags=["Agent"])
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])


@app.get("/")
def root():
    return {"message": "SYS Knowledge Hub API", "version": "1.0.0", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
