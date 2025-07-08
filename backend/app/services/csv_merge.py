import pandas as pd
from typing import List
import requests
from datetime import date
# from api.cache import cached_file_dict

async def fetch_and_merge_csvs(start_date: str, end_date: str) -> pd.DataFrame:
    """
    Returns a pandas dataframe containing the merged csv data
    
    Args:
        start_date: A string in the form YYYY-MM-DD.
        end_date: A string in the form YYYY-MM-DD.
    Return:
        pd.DataFrame: A DataFrame containing the merged csv information.
    """
    global cached_file_dict
    pass

def get_dates_between(start_date: date, end_date: date, filedict: dict) -> List[date]:
    """
    Returns a list of dates inclusive between a start date and an end date.
    
    Args:
        start_date: A date object containing the specified start date.
        end_date: A date object containing the specified start date.
    Returns:
        list[date]: A list of dates between the given start date and end date inclusive.
    """

    def is_date_between(date: date, start_date: date, end_date: date) -> bool:
        return start_date <= date and date <= end_date

    filenames = [filename for filename in filedict]
    datelist = list(map(filename_to_date, filenames))
    filtered_dates = [d for d in datelist if is_date_between(d, start_date, end_date)]
    return filtered_dates

def filename_to_date(filename: str) -> date:
    """
    Converts a filename of the form D_YYYY-MM-DD.csv to its corresponding date

    Args:
        filename (str): A filename in the form D_YYYY-MM-DD.csv
    Returns:
        date: A date that corresponds with the filename
    """
    date_str = filename[2:-4]
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

def date_to_filename(date: date) -> str:
    yearstr = str(date.year)
    monthstr = str(date.month)
    daystr = str(date.day) 
    if date.month < 10:
        monthstr = "0" + monthstr
    if date.day < 10:
        daystr = "0" + daystr
    return "D_" + yearstr + "-" + monthstr + "-" + daystr + ".csv"