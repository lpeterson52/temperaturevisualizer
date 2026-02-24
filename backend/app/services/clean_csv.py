"""
CSV cleaning service for temperature visualizer backend.

This module contains functions for sanitizing csv data for pandas dataframes.
"""
import pandas as pd

def sanitize_nan_vals(df: pd.DataFrame) -> pd.DataFrame:
    # can change later, will replace null values for now
    # keeping null values in dataframe breaks jsondump, so they either have to 
    # be dropped or replaced
    df = df.fillna(0)
    return df 