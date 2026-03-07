""" Schemas for API responses

This module contains the Pydantic models that define the structure of the 
responses for the API endpoints in the temperature visualizer backend. These 
models ensure that the API responses are consistent and well-defined, making 
it easier for clients to understand and use the API effectively.

"""

from pydantic import BaseModel, Field, RootModel
from typing import Optional, Any, Dict, List, TypeAlias


class JobIDResponse(BaseModel):
    """
        Response model for the start-merge endpoint, containing the job ID of the created merge job.

        ## Fields
        - `job_id`: The unique identifier for the merge job, represented as a string (e.g., "2382ad08-bb26-43c2-bdb3-0104d4c7331e").

        ## Example
        ```
        {
            "job_id": "2382ad08-bb26-43c2-bdb3-0104d4c7331e"
        }
        ```
    """
    job_id: str = Field(
        ...,
        description="The unique identifier for the job",
        example="2382ad08-bb26-43c2-bdb3-0104d4c7331e",
    )


class MergeStatusResponse(BaseModel):
    """
        Response model for the merge-status endpoint, containing the current status, progress, and any error message of a merge job.
        ## Fields
        - `status`: The current status of the job (e.g., "running", "completed", "failed").
        - `progress`: The progress of the job as a percentage (e.g., 30.0).
        - `error`: An optional error message if the job failed (e.g., "File not found").
        ## Example
        ```
        {
            "status": "running",
            "progress": 30.0,
            "error": null
        }
        ```
    """
    status: str = Field(..., description="The current status of the job", example="running")
    progress: float = Field(..., description="The progress of the job as a percentage", example=30.0)
    error: Optional[str] = Field(None, description="Error message if the job failed", example="File not found")

    class Config:
        json_schema_extra = {
            "example": {"status": "running", "progress": 30.0, "error": None}
        }


class MergeResultResponse(BaseModel):
    """
        `MergeResultResponse` model for the merge-result endpoint, containing the merged result of the csvs as a list of dictionaries.
        ## Fields
        - `result`: The merged result of the csvs as a list of dictionaries, where each dictionary represents a row of the merged CSV 
        data with column names as keys and corresponding values.

        ## Example
        ```
        {
            "result": [
                {
                    "Date-Time": "02/22/2026 00:00:36",
                    "Timecode": 46075.0004252315,
                    "Tank A1 Warm (C)": 14.6496,
                    "Tank A1 Cool (C)": 14.804
                },
                {
                    "Date-Time": "02/22/2026 00:10:36",
                    "Timecode": 46075.0073702431,
                    "Tank A1 Warm (C)": 14.6299,
                    "Tank A1 Cool (C)": 14.7249
                }
            ]
        }
        ```
    """
    result: List[Dict[str, Any]] = Field(..., description="The merged result of the csvs as a list of dictionaries", example=[
        {
            "Date-Time": "02/22/2026 00:00:36",
            "Timecode": 46075.0004252315,
            "Tank A1 Warm (C)": 14.6496,
            "Tank A1 Cool (C)": 14.804
        },
        {
            "Date-Time": "02/22/2026 00:10:36",
            "Timecode": 46075.0073702431,
            "Tank A1 Warm (C)": 14.6299,
            "Tank A1 Cool (C)": 14.7249
        }
    ])

    class Config:
        json_schema_extra = {
            "example": {
                "result": [
                    {
                        "Date-Time": "02/22/2026 00:00:36",
                        "Timecode": 46075.0004252315,
                        "Tank A1 Warm (C)": 14.6496,
                        "Tank A1 Cool (C)": 14.804
                    },
                    {
                        "Date-Time": "02/22/2026 00:10:36",
                        "Timecode": 46075.0073702431,
                        "Tank A1 Warm (C)": 14.6299,
                        "Tank A1 Cool (C)": 14.7249
                    }
                ]
            }
        }
