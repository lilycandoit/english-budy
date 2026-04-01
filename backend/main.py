from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import Base, engine
from routes.mistakes import router as mistakes_router

# Create all tables on startup (safe to run multiple times)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Daily English Buddy API",
    description="Backend for the Daily English Buddy learning app.",
    version="1.0.0",
)

# Allow the frontend (served from a different port during development) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mistakes_router)

# Serve the frontend from /  (backend serves everything in one process)
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
