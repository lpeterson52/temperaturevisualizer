import pytest
from services import clean_csv
import pandas as pd

def test_clean_csv():
    mock_data = {"col_1": [3, 2, 1, 0], "col_2": [None, None, 2, 1]}
    mock_clean_data = {"col_1": [3, 2, 1, 0], "col_2": [0, 0, 2, 1]}
    df = pd.DataFrame(mock_data)
    clean_df = pd.DataFrame(mock_clean_data)
    df = clean_csv.sanitize_nan_vals(df)
    assert df == clean_df
    
    
    