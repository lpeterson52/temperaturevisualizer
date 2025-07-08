import pytest
from services import csv_merge
from datetime import date


def test_get_dates_between(mocker):
    # finish test later
    mock_dict = {"D_2025-3-24.csv": "drive.google.com/1",
                 "D_2025-3-25.csv": "drive.google.com/2",
                 "D_2025-3-30.csv": "drive.google.com/3",
                 "D_2025-4-30.csv": "drive.google.com/4",
                 "D_2025-5-1.csv": "drive.google.com/5"}
    mocker.patch('api.cache.cached_file_dict', mock_dict)
    
    start_date = "2025-3-25"
    end_date = "2025-4-30"
    
    
def test_str_to_date():
    expected = [date(2025, 7, 3)]
    actual = [csv_merge.str_to_date("2025-07-03")]
    assert expected == actual
    
    