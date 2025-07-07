from typing import Union
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from api.cache import refresh_cache, cache_router
from api.routes import merge_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(refresh_cache())

app = FastAPI(lifespan=lifespan)

app.include_router(merge_router, prefix="/api")
app.include_router(cache_router, prefix="/cache")

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}