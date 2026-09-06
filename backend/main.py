from fastapi import FastAPI

app = FastAPI(title="Peblo TV Mini API")


@app.get("/")
def home():
    return {"message": "Peblo TV Mini API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
