"""
Cache module for the temperature visualizer backend.

This module contains the cached file information for the temperature visualizer backend.
"""

import asyncio
from fastapi import APIRouter
from typing import Dict
import httpx

# Google Apps Script URL for fetching file information
GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNeJvs8VXCqja9ia-DY3lORan0-z1L-H_LonUwDnZ6_wbNsU7mS779S1AvWYIPV8oH4g/exec"

router = APIRouter()

cached_file_dict = {}
# dict struct: {filename: url}

@router.get("/", response_model=Dict[str, str])
def get_available_files():
    """
    Returns the cached file dictionary.

    Returns:
        dict: A python dict containing file information in the form {filename: url}
    """
    return cached_file_dict

async def fetch_file_json():
    """
    Fetches a JSON from google apps script containing available file information.

    Returns:
        dict: A JSON with a list of objects containing the filename, the id=, and URL. 
    """
    # set timeout to deal with long response times
    timeout = httpx.Timeout(timeout=30.0, read=30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        result = await client.get(GOOGLE_SCRIPT_URL)
        result_dict = result.json()
        return result_dict

def get_file_dict(file_json):
    """
    Converts a JSON containing file information and changes the structure to be {name: url}

    Args:
        fileJSON: A JSON containing file information passed in from fetch_file_json

    Returns:
        dict: A python dict containing file information in the form {filename: url}
    """

    return_dict = {fileobject["name"]: fileobject["url"] for fileobject in file_json}
    return return_dict

async def populate_cache():
    """
    Populates cached file dictionary.
    """
    global cached_file_dict
    file_json = await fetch_file_json()
    cached_file_dict = get_file_dict(file_json)

async def refresh_cache():
    """
    Refreshes the cached file dictionary every hour.
    """
    global cached_file_dict
    while True:
        await asyncio.sleep(3600) # refresh every hour
        await populate_cache()
        print("Cache refreshed")
