import pytest
from api import cache
import httpx
import respx

def test_get_file_dict():
    """
    Test that get_file_dict correctly converts a list of file metadata
    into a dictionary mapping filenames to URLs.
    """

    test_input = [{"name": "file1.csv", "id": "1234abcd", "url": "drive.google.com/1234abcd"}, 
                  {"name": "file2.csv", "id": "abcd1234", "url": "drive.google.com/abcd1234"}, 
                  {"name": "file3.csv", "id": "0192", "url": "drive.google.com/0192"}]
    result = cache.get_file_dict(test_input)
    expected = {"file1.csv": "drive.google.com/1234abcd", 
                "file2.csv": "drive.google.com/abcd1234", 
                "file3.csv": "drive.google.com/0192"}
    assert result == expected

@pytest.mark.asyncio
@respx.mock
async def test_fetch_file_json():
    url = "https://script.google.com/macros/s/AKfycbzNeJvs8VXCqja9ia-DY3lORan0-z1L-H_LonUwDnZ6_wbNsU7mS779S1AvWYIPV8oH4g/exec"

    mock_response = [
        {"name": "D_2025-07-01.csv", "id": "1234abcd", "url": "drive.google.com/1234abcd"},
        {"name": "D_2025-07-02.csv", "id": "abcd1234", "url": "drive.google.com/abcd1234"},
        {"name": "D_2025-07-03.csv", "id": "bad", "url": "drive.google.com/bad"}
    ]
    respx.get(url).mock(
        return_value=httpx.Response(200, json=mock_response)
    )

    result = await cache.fetch_file_json()
    assert isinstance(result, list)
    assert result == mock_response