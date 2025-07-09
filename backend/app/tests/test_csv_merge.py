import pytest
from services import csv_merge
from datetime import date
from api.cache import fetch_file_json, get_file_dict
import respx
import httpx
import pandas as pd


def test_get_dates_between():
    mock_dict = {"D_2025-03-24.csv": "drive.google.com/1",
                 "D_2025-03-25.csv": "drive.google.com/2",
                 "D_2025-03-30.csv": "drive.google.com/3",
                 "D_2025-04-30.csv": "drive.google.com/4",
                 "D_2025-05-01.csv": "drive.google.com/5"}
    
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

@pytest.mark.asyncio
@respx.mock
async def test_fetch_and_merge_csvs():
    # Distinct mock CSVs per file
    csv_2025_07_03 = "date,temp\n2025-07-03,25\n2025-07-03,26"
    csv_2025_07_04 = "date,temp\n2025-07-04,27\n2025-07-04,28"

    mock_dict = {
        "D_2025-07-03.csv": "https://drive.mock/D_2025-07-03.csv",
        "D_2025-07-04.csv": "https://drive.mock/D_2025-07-04.csv",
    }

    respx.get("https://drive.mock/D_2025-07-03.csv").mock(
        return_value=httpx.Response(200, content=csv_2025_07_03)
    )
    respx.get("https://drive.mock/D_2025-07-04.csv").mock(
        return_value=httpx.Response(200, content=csv_2025_07_04)
    )

    df = await csv_merge.fetch_and_merge_csvs("2025-07-03", "2025-07-04", mock_dict)

    assert isinstance(df, pd.DataFrame)
    assert not df.empty
    assert len(df) == 4  # 2 rows per CSV, 2 CSVs
    assert "date" in df.columns
    assert "temp" in df.columns

    # Additional optional asserts
    assert (df['temp'] == [25, 26, 27, 28]).all()

@pytest.mark.asyncio
@pytest.mark.skip(reason="Integration test that fetches from google drive")
async def test_live_fetch_from_google_drive():
    start_date = "2025-07-01"
    end_date = "2025-07-04"
    filejson = await fetch_file_json()
    filedict = get_file_dict(filejson)
    print("fetched")
    df = await csv_merge.fetch_and_merge_csvs(start_date=start_date, 
                                              end_date=end_date, 
                                              cached_file_dict=filedict)

    assert not df.empty
