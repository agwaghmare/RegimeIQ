from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.router import api_router

# Allowed origins (frontend URLs)
CORS_ORIGINS = [
    "http://localhost:3000",  # your React dev server
    "http://127.0.0.1:3000",
]

app = FastAPI(title="RegimeIQ API")

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