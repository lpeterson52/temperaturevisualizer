# run_tests.py
import os
import sys
import subprocess

# Add your app path to PYTHONPATH env var
env = os.environ.copy()
env["PYTHONPATH"] = os.path.abspath("app")

# Run pytest with the updated env
subprocess.run([sys.executable, "-m", "pytest", "app/tests"], env=env)
