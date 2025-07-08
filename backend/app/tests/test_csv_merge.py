import pytest
from services import csv_merge
from datetime import date


def test_get_dates_between():
    # finish test later
    mock_dict = {"D_2025-3-24.csv": "drive.google.com/1",
                 "D_2025-3-25.csv": "drive.google.com/2",
                 "D_2025-3-30.csv": "drive.google.com/3",
                 "D_2025-4-30.csv": "drive.google.com/4",
                 "D_2025-5-1.csv": "drive.google.com/5"}
    
    start_date = date(2025, 3, 25) # 2025-3-25
    end_date = date(2025, 4, 30) # 2025-4-30

    expected = [date(2025, 3, 25),
                date(2025, 3, 30),
                date(2025, 4, 30)]
    actual = csv_merge.get_dates_between(start_date=start_date, end_date=end_date, filedict=mock_dict)
    assert expected == actual
    
    
    
def test_str_to_date():
    expected = [date(2025, 7, 3)]
    actual = [csv_merge.str_to_date("2025-07-03")]
    assert expected == actual

def test_date_to_filename():
    expected = ["D_2025-07-03.csv",
            "D_2022-09-30.csv",
            "D_2022-10-30.csv"]
    actual = [csv_merge.date_to_filename(date(2025, 7, 3)),
              csv_merge.date_to_filename(date(2022, 9, 30)),
              csv_merge.date_to_filename(date(2022, 10, 30))]
    assert expected == actual
    
    