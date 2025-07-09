import pytest
from services import csv_merge
from datetime import date
import respx
import httpx
import pandas as pd


def test_get_dates_between():
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
    
    
# Conversion Tests   

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

# Fetch tests

@pytest.mark.asyncio
@respx.mock
async def test_fetch_csvs_from_drive():
    # Test Input
    file_dict = {
        "D_2025-07-03.csv": "https://drive.mock/file1",
        "D_2025-06-25.csv": "https://drive.mock/file2",
        "D_2025-05-03.csv": "https://drive.mock/file3"
    }
    csv_data_1 = "date,temp\n2025-07-03,25\n2025-07-03,26"
    csv_data_2 = "date,temp\n2025-06-25,27\n2025-06-25,22"
    csv_data_3 = "date,temp\n2025-05-03,26\n2025-05-03,23"
    
    dates = [date(2025, 7, 3),
             date(2025, 6, 25)]
    # setting up mock responses
    respx.get("https://drive.mock/file1").mock(
        return_value=httpx.Response(200, content=csv_data_1)
    )
    respx.get("https://drive.mock/file2").mock(
        return_value=httpx.Response(200, content=csv_data_2)
    )
    respx.get("https://drive.mock/file3").mock(
        return_value=httpx.Response(200, content=csv_data_3)
    )

    result = await csv_merge.fetch_csvs_from_drive(datelist=dates, filedict=file_dict)
    assert isinstance(result, dict)
    assert "D_2025-07-03.csv" in result
    assert isinstance(result["D_2025-07-03.csv"], pd.DataFrame)
    assert result["D_2025-07-03.csv"].iloc[0]["temp"] == 25
    assert result["D_2025-06-25.csv"].iloc[1]["date"] == "2025-06-25"
    
    