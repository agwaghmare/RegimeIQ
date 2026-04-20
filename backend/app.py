from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.router import api_router
from services.model_service import ensure_model_trained

# Allowed origins (frontend URLs)
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app = FastAPI(title="RegimeIQ API")

@app.on_event("startup")
def startup():
    ensure_model_trained()

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
