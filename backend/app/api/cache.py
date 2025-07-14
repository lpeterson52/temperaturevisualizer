from fastapi import APIRouter, BackgroundTasks
import httpx
import asyncio

router = APIRouter()

cached_file_dict = {}
# dict struct: {filename: url}


async def fetch_file_json():
    """
    Fetches a JSON from google apps script containing available file information.

    Returns:
        dict: A JSON with a list of objects containing the filename, the id=, and URL. 
    """
    # set timeout to deal with long response times
    timeout = httpx.Timeout(timeout=30.0, read=30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        result = await client.get("https://script.google.com/macros/s/AKfycbzNeJvs8VXCqja9ia-DY3lORan0-z1L-H_LonUwDnZ6_wbNsU7mS779S1AvWYIPV8oH4g/exec")
        resultDict = result.json()
        return resultDict

def get_file_dict(fileJSON):
    """
    Converts a JSON containing file information and changes the structure to be {name: url}

    Args:
        fileJSON: A JSON containing file information passed in from fetch_file_json

    Returns:
        dict: A python dict containing file information in the form {filename: url}
    """

    returnDict = {fileobject["name"]: fileobject["url"] for fileobject in fileJSON}
    return returnDict


async def refresh_cache():
    global cached_file_dict
    while True:
        fileJSON = await fetch_file_json()
        cached_file_dict = get_file_dict(fileJSON)
        print("Cache refreshed")
        await asyncio.sleep(3600) # refresh every hour

@router.get("/")
def get_available_files():
    return cached_file_dict

