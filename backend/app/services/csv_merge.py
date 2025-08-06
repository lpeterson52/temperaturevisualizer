"""
CSV merge service for the temperature visualizer backend.

This module contains the functions for fetching and merging CSV files from Google Drive.
"""

import io
import asyncio
from typing import List
from datetime import date
import pandas as pd
import httpx

async def fetch_and_merge_csvs(start_date: str,
                               end_date: str,
                               cached_file_dict: dict) -> pd.DataFrame:
    """
    Returns a pandas dataframe containing the merged csv data
    
    Args:
        start_date: A string in the form YYYY-MM-DD.
        end_date: A string in the form YYYY-MM-DD.
    Return:
        pd.DataFrame: A DataFrame containing the merged csv information.
    """
    print("cached_file_dict keys:", list(cached_file_dict.keys()))
    print("start_date:", start_date, "end_date:", end_date)
    datelist = get_dates_between(start_date=str_to_date(start_date),
                                 end_date=str_to_date(end_date),
                                 filedict=cached_file_dict)
    print("datelist:", datelist)
    fetched_frames = await fetch_csvs_from_drive(datelist=datelist, filedict=cached_file_dict)
    print("fetched_frames:", fetched_frames)
    date_key_dict = {}

    for filename, df in fetched_frames.items():
        date_key_dict[filename_to_date(filename)] = df
    sorted_dates = sorted(date_key_dict.keys())
    sorted_frames = [date_key_dict[d] for d in sorted_dates]
    print("sorted_frames:", sorted_frames)
    return pd.concat(sorted_frames)

def get_dates_between(start_date: date, end_date: date, filedict: dict) -> List[date]:
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

    filenames = [filename for filename in filedict]
    datelist = list(map(filename_to_date, filenames))
    filtered_dates = [d for d in datelist if is_date_between(d, start_date, end_date)]
    return filtered_dates

async def fetch_csvs_from_drive(datelist: List[date], filedict: dict) -> dict:
    """
    Fetches the csvs associated with the given datelist from google drive, 
    converts them to pandas dataframes and returns a dictionary.

    Args:
        datelist: A list of dates to be fetched from google drive
        filedict: A dictionary of the form {filename: url}
    Returns:
        dict: A dictionary with filenames as keys and DataFrames as values {filename: DataFrame}
    """
    dataframes = {} # dictionary to store the fetched dataframes filename: dataframe

    filelist = list(map(date_to_filename, datelist)) # list of filenames to be fetched
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        tasklist = []
        # create task list for asyncio.gather
        for filename in filelist:
            tasklist.append(fetch_csv(client, filename, filedict[filename]))

        results = await asyncio.gather(*tasklist, return_exceptions=True)

        # if result is valid, append it to dataframe dictionary
        for result in results:
            if isinstance(result, tuple) and result[1] is not None:
                filename, df = result
                dataframes[filename] = df

    return dataframes


async def fetch_csv(client, filename, url):
    """
    Fetches a csv from google drive and returns a dataframe.
    """
    try:
        response = await client.get(url)
        response.raise_for_status()
        df = pd.read_csv(io.StringIO(response.text))
        return filename, df
    except (httpx.HTTPError, pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        print(f"Failed to fetch {filename}: {e}")
        return filename, None

# ------------------------------
# ---- Conversion Functions ----
# ------------------------------
def filename_to_date(filename: str) -> date:
    """
    Converts a filename of the form D_YYYY-MM-DD.csv to its corresponding date

    Args:
        filename (str): A filename in the form D_YYYY-MM-DD.csv
    Returns:
        date: A date that corresponds with the filename
    """
    date_str = str(filename[2: len(filename) - 4])
    return str_to_date(date_str)

def str_to_date(datestr: str) -> date:
    """
    Converts a date string to a date object
    
    Args:
        datestr (str): A string in the form YYYY-MM-DD
    Returns:
        date: A date object containing the info from the datestring
    """
    split_str = datestr.split("-")
    split_str = list(map(int, split_str))
    return date(split_str[0], split_str[1], split_str[2])

def date_to_filename(date_obj: date) -> str:
    """
    Converts a date object to a filename of the form D_YYYY-MM-DD.csv
    """
    yearstr = str(date_obj.year)
    monthstr = str(date_obj.month)
    daystr = str(date_obj.day)
    if date_obj.month < 10:
        monthstr = "0" + monthstr
    if date_obj.day < 10:
        daystr = "0" + daystr
    return "D_" + yearstr + "-" + monthstr + "-" + daystr + ".csv"
