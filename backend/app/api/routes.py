"""
API routes for the temperature visualizer backend.

This module contains FastAPI route handlers for CSV data operations,
specifically for merging and retrieving temperature data from CSV files
based on date ranges.
"""

from fastapi import APIRouter, HTTPException, Query
import app.services.csv_merge
import app.api.cache
from app.api.schemas import JobIDResponse, MergeStatusResponse, MergeResultResponse
import pandas as pd  # noqa: F401
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start-merge", response_model=JobIDResponse)
async def start_merge_job(
    start_date: str = Query(..., description="Start date in format YYYY-MM-DD"),
    end_date: str = Query(..., description="End date in format YYYY-MM-DD")
):
    """
    Starts a merge job for the csvs in the specified date range.
    
    Args: 
        start_date (str): Start date in format YYYY-MM-DD
        end_date (str): End date in format YYYY-MM-DD
    
    Returns:
        job_id: Id of the job that was created
    """
    job_id = await app.services.csv_merge.create_merge_job(start_date, end_date)
    logger.info("Created job with id %s", job_id["job_id"])
    return JobIDResponse(job_id=job_id["job_id"])


@router.get("/merge-status", response_model=MergeStatusResponse)
async def get_merge_status(
    job_id: str = Query(..., description="Job id in string format")
):
    """
    Gets the status of a started merge job.
    
    Args:
        job_id (str): id of job.
        
    Returns:
        status_dict: Dictionary containing info of status of job.
        
    Raises:
        HTTPException: If the job_id doesn't exist.
    """
    job = app.services.csv_merge.jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return MergeStatusResponse(status=job["status"], progress=job["progress"], error=job["error"])

@router.get("/merge-result")
async def get_merge_result(
    job_id: str = Query(..., description="Job id in string format")
):
    """
    Returns a dictionary representing the merged csvs.
    
    Args:
        job_id (str): Id of job to be returned.
    
    Result:
        result_dict: Dictionary containing merged csv data.
    
    Raises:
        HTTPException: If the job_id doesn't exist or the job is not complete yet.
    """
    job = app.services.csv_merge.jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "complete":
        raise HTTPException(status_code=409, detail="Job is not complete yet")
    
    return job["result"]
