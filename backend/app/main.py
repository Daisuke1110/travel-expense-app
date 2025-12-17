from fastapi import FastAPI
from app.routes import trips

app = FastAPI(title="Travel Expense App API", version="0.1.0")


@app.middleware("http")
async def add_charset_to_json(request, call_next):
    """
    Ensure JSON responses include charset so Windows PowerShell decodes UTF-8 correctly.
    """
    response = await call_next(request)
    content_type = response.headers.get("content-type")
    if content_type and content_type.startswith("application/json") and "charset" not in content_type.lower():
        response.headers["content-type"] = "application/json; charset=utf-8"
    return response


app.include_router(trips.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
