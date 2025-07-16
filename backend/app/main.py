from typing import Union
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.cache import refresh_cache, router as cache_router
from app.api.routes import router as merge_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(refresh_cache())
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(merge_router, prefix="/api")
app.include_router(cache_router, prefix="/cache")

@app.get("/")
def read_root():
    return {"Hello": "World"}