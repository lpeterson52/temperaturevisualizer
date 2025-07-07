from fastapi import APIRouter, HTTPException
from typing import List
from app.services.csv_merge import fetch_and_merge_csvs

router = APIRouter()


@router.get("/")
async def merge_csv(urls: List[str]):
    try:
        return await fetch_and_merge_csvs(urls)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))