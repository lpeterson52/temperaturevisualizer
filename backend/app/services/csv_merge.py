"""
CSV merge service for the temperature visualizer backend.

This module contains the functions for fetching and merging CSV files from Google Drive.
"""

import io
import asyncio
import uuid
from typing import List, Dict
from datetime import date
from app.api.cache import get_available_files
from app.services.clean_csv import sanitize_nan_vals
import pandas as pd
import httpx

# Dictionary to store jobs
jobs: Dict[str, Dict] = {}

async def create_merge_job(start_date: str, end_date: str) -> dict:
    """
    Starts a job which merges the csvs between the given start and end date (inclusive).
    
    Args:
        start_date (str): start of date range to be merged.
        end_date (str): end of date range to be merged.
        
    Returns:
        job_id: dict representing job id {"job_id": job_id}
    """
    job_id: str = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "queued", 
        "progress": 0,
        "result": None,
        "error": None
    }
    
    asyncio.create_task(run_merge_job(job_id, start_date, end_date))
    return {"job_id": job_id}
    
async def run_merge_job(job_id: str, start_date: str, end_date: str) -> None:
    
    try:
        jobs[job_id]["status"] = "running"
        jobs[job_id]["progress"] = 10
        
        decimate: bool = start_date == end_date
        
        jobs[job_id]["progress"] = 30
        cached_file_dict: Dict[str, str] = get_available_files()
        merged_df: pd.DataFrame = await fetch_and_merge_csvs(
            start_date=start_date,
            end_date=end_date,
            cached_file_dict=cached_file_dict,
            decimate=decimate
        )

        jobs[job_id]["progress"] = 90
        
        merged_df = merged_df.reset_index(drop=True).to_dict(orient="records")
        
        jobs[job_id]["status"] = "complete"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["result"] = merged_df
        print("Finished job with id", job_id)
        
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        print("failed job with id", job_id)
        


async def fetch_and_merge_csvs(start_date: str,
                               end_date: str,
                               cached_file_dict: Dict[str, str],
                               decimate: bool) -> pd.DataFrame:
    """
    Returns a pandas dataframe containing the merged csv data
    
    Args:
        start_date: A string in the form YYYY-MM-DD.
        end_date: A string in the form YYYY-MM-DD.
        cached_file_dict: A dictionary of the form {filename: url}
        decimate: A boolean indicating whether to decimate the data
    Return:
        pd.DataFrame: A DataFrame containing the merged csv information.
    """
    datelist = get_dates_between(start_date=str_to_date(start_date),
                                 end_date=str_to_date(end_date),
                                 filedict=cached_file_dict)
    fetched_frames = await fetch_csvs_from_drive(datelist=datelist, filedict=cached_file_dict)
    date_key_dict = {}

    for filename, df in fetched_frames.items():
        date_key_dict[filename_to_date(filename)] = df
    sorted_dates: List[date] = sorted(date_key_dict.keys())
    sorted_frames: List[pd.DataFrame] = [date_key_dict[d] for d in sorted_dates]
    merged_df: pd.DataFrame = pd.concat(sorted_frames)
    cleaned_df: pd.DataFrame = sanitize_nan_vals(merged_df)
    if decimate:
        return decimate_dataframe(cleaned_df, decimation_factor=10)
    return cleaned_df

def get_dates_between(start_date: date, end_date: date, filedict: Dict[str, str]) -> List[date]:
    """
    Returns a list of dates inclusive between a start date and an end date.
    
    Args:
        start_date: A date object containing the specified start date.
        end_date: A date object containing the specified start date.
    Returns:
        list[date]: A list of dates between the given start date and end date inclusive.
    """
    def is_date_between(date_obj: date, start_date: date, end_date: date) -> bool:
        return start_date <= date_obj and date_obj <= end_date

    filenames: List[str] = [filename for filename in filedict]
    datelist: List[date] = list(map(filename_to_date, filenames))
    filtered_dates: List[date] = [d for d in datelist if is_date_between(d, start_date, end_date)]
    return filtered_dates

async def fetch_csvs_from_drive(datelist: List[date], filedict: Dict[str, str]) -> Dict[str, pd.DataFrame]:
    """
    Fetches the csvs associated with the given datelist from google drive, 
    converts them to pandas dataframes and returns a dictionary.

    Args:
        datelist: A list of dates to be fetched from google drive
        filedict: A dictionary of the form {filename: url}
        
    Returns:
        dict: A dictionary with filenames as keys and DataFrames as values {filename: DataFrame}
    """
    dataframes: Dict[str, pd.DataFrame] = {} # dictionary to store the fetched dataframes filename: dataframe

    file_list: List[str] = list(map(date_to_filename, datelist)) # list of filenames to be fetched
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        tasklist: List[asyncio.Task] = []
        # create task list for asyncio.gather
        for filename in file_list:
            tasklist.append(fetch_csv(client, filename, filedict[filename]))

        results: List[tuple] = await asyncio.gather(*tasklist, return_exceptions=True)

        # if result is valid, append it to dataframe dictionary
        for result in results:
            if isinstance(result, tuple) and result[1] is not None:
                filename: str = result[0]
                df: pd.DataFrame = result[1]
                dataframes[filename] = df

    return dataframes


async def fetch_csv(client, filename, url):
    """
    Fetches a csv from google drive and returns a dataframe.
    """
    try:
        response = await client.get(url)
        response.raise_for_status()
        df: pd.DataFrame = pd.read_csv(io.StringIO(response.text))
        return filename, df
    except (httpx.HTTPError, pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        print(f"Failed to fetch {filename}: {e}")
        return filename, None

def decimate_dataframe(df: pd.DataFrame, decimation_factor: int) -> pd.DataFrame:
    """
    Decimates a dataframe to a given decimation factor.
    """
    if decimation_factor > 1:
        return df.iloc[::decimation_factor]
    return df

# ------------------------------
# ---- Conversion Functions ----
# ------------------------------
def filename_to_date(file_name: str) -> date:
    """
    Converts a filename of the form D_YYYY-MM-DD.csv to its corresponding date

    Args:
        file_name (str): A filename in the form D_YYYY-MM-DD.csv
    Returns:
        date: A date that corresponds with the filename
    """
    date_str: str = str(file_name[2: len(file_name) - 4])
    return str_to_date(date_str)

def str_to_date(date_str: str) -> date:
    """
    Converts a date string to a date object
    
    Args:
        date_str (str): A string in the form YYYY-MM-DD
    Returns:
        date: A date object containing the info from the datestring
    """
    split_str: List[str] = date_str.split("-")
    split_str = list(map(int, split_str))
    return date(split_str[0], split_str[1], split_str[2])

def date_to_filename(date_obj: date) -> str:
    """
    Converts a date object to a filename of the form D_YYYY-MM-DD.csv
    """
    year: str = str(date_obj.year)
    month: str = str(date_obj.month)
    day: str = str(date_obj.day)
    if date_obj.month < 10:
        month: str = "0" + month
    if date_obj.day < 10:
        day: str = "0" + day
    return "D_" + year + "-" + month + "-" + day + ".csv"
