# The Backend
FastAPI for processing and serving temperature data.

## Setup
First, navigate to the backend directory.
`cd backend`
Then, create a python virtual environment.
`python -m venv .venv`
After you create the environment, you are going to want to activate it.
Windows: `source .venv/scripts/activate`
Macos: `source .venv/bin/activate`
After activating the environment, install the required dependencies from requirements.txt.
`pip install -r requirements.txt`
After installing the requirements, activate the uvicorn server.
`uvicorn app.main:app --reload`
The backend is now running locally on your computer!. You can access the api by typing in the url given by uvicorn followed by the api route.

## API Endpoints
### /api
Returns temperature data from start date to end date.
start_date: YYYY-MM-DD
end_date: YYYY-MM-DD
example call: /api?start_date=2025-07-01&end_date=2025-07-05

### /cache
Returns available temperature data files from google drive and their respective URLs.

## Testing
Run tests by running the run_tests.py in the backend directory after navigating to the backend directory.
`python run_tests.py`
