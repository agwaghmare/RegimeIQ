from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.router import api_router

# Allowed origins (frontend URLs)
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Train LightGBM model on startup if not already trained
    from services.model_service import ensure_model_trained
    ensure_model_trained()
    yield


app = FastAPI(title="RegimeIQ API", lifespan=lifespan)

# ----- CORS Middleware -----
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # or ["*"] for all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- Routers -----
app.include_router(api_router)

# ----- Root endpoint -----
@app.get("/")
def root():
    return {"message": "RegimeIQ running"}