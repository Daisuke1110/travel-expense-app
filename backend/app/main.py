from fastapi import FastAPI
from app.routes import trips

app = FastAPI(title="Travel Expense App API", version="0.1.0")

app.include_router(trips.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
