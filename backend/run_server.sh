#!/bin/bash
# run_server.sh
# This script starts the FastAPI server for the temperature visualizer backend.

# Activate the virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start the FastAPI server using uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000