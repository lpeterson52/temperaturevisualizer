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

def get_dates_between(start_date: date, end_date: date) -> List[date]:
    """
    Returns a list of dates inclusive between a start date and an end date.
    
    Args:
        start_date: A date object containing the specified start date.
        end_date: A date object containing the specified start date.
    Returns:
        list[date]: A list of dates between the given start date and end date inclusive.
    """
    pass

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
