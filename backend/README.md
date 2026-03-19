# The Backend
FastAPI for processing and serving temperature data.

## Setup
First, navigate to the backend directory. <br>
```bash
cd backend
```
Then, create a python virtual environment. <br>
```bash
python -m venv .venv
```
After you create the environment, you are going to want to activate it. <br>
Windows: `source .venv/scripts/activate` <br>
Macos: `source .venv/bin/activate`
After activating the environment, install the required dependencies from requirements.txt.
```bash
pip install -r requirements.txt
```
Please note that this also requires a cpp compiler for numpy, and a Cargo, the Rust package manager, for pydantic_core. This can be installed at https://rustup.rs/
After installing the requirements, activate the uvicorn server. <br>
```bash
uvicorn app.main:app --reload
```
The backend is now running locally on your computer!. You can access the api by typing in the url given by uvicorn followed by the api route.

## API Endpoints
### /api
Returns temperature data from start date to end date.

Query parameters:
- `start_date` (required): start of the date range in `YYYY-MM-DD` format
- `end_date` (required): end of the date range in `YYYY-MM-DD` format
example call: /api?start_date=2025-07-01&end_date=2025-07-05

### /cache
Returns available temperature data files from google drive and their respective URLs.

## Testing
Run tests by running the run_tests.py in the backend directory after navigating to the backend directory. <br>
```bash
python run_tests.py
```
