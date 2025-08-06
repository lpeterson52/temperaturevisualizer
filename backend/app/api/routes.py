"""
API routes for the temperature visualizer backend.

This module contains FastAPI route handlers for CSV data operations,
specifically for merging and retrieving temperature data from CSV files
based on date ranges.
"""

from fastapi import APIRouter, HTTPException, Query
from app.services.csv_merge import fetch_and_merge_csvs
import app.api.cache
import pandas as pd  # noqa: F401

router = APIRouter()


@router.get("/")
async def merge_csv(
    start_date: str = Query(..., description="Start date in format YYYY-MM-DD"),
    end_date: str = Query(..., description="End date in format YYYY-MM-DD")
):
    """
    Merge CSV files from the specified date range.

    Args:
        start_date (str): Start date in format YYYY-MM-DD
        end_date (str): End date in format YYYY-MM-DD

    Returns:
        list: List of dictionaries representing the merged CSV data

    Raises:
        HTTPException: If there is an error during the CSV merge process
    """
    try:
        merged_df = await fetch_and_merge_csvs(start_date, end_date, app.api.cache.cached_file_dict)
        return merged_df.reset_index(drop=True).to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
