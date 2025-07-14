from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.services.csv_merge import fetch_and_merge_csvs
import app.api.cache
import pandas as pd

router = APIRouter()


@router.get("/")
async def merge_csv(
    start_date: str = Query(..., description="Start date in format YYYY-MM-DD"),
    end_date: str = Query(..., description="End date in format YYYY-MM-DD")
):
    try:
        merged_df = await fetch_and_merge_csvs(start_date, end_date, app.api.cache.cached_file_dict)
        return merged_df.reset_index(drop=True).to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))