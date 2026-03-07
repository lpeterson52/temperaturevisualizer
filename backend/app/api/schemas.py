from pydantic import BaseModel, Field, RootModel
from typing import Optional, Any, Dict, List, TypeAlias


class JobIDResponse(BaseModel):
    job_id: str = Field(
        ...,
        description="The unique identifier for the job",
        example="2382ad08-bb26-43c2-bdb3-0104d4c7331e",
    )


class MergeStatusResponse(BaseModel):
    status: str = Field(..., description="The current status of the job", example="running")
    progress: float = Field(..., description="The progress of the job as a percentage", example=30.0)
    error: Optional[str] = Field(None, description="Error message if the job failed", example="File not found")

    class Config:
        json_schema_extra = {
            "example": {"status": "running", "progress": 30.0, "error": None}
        }
        

# TODO: Fix the response model to not conflict with existing formatting
class MergeResultResponse(RootModel[Dict[str, Any]]):
    pass
    class Config:
        json_schema_extra = {
            "example": [
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
