"""Compatibility entry for the common artifact verifier."""
import runpy,sys
from pathlib import Path
sys.argv=[sys.argv[0],"premium"]
runpy.run_path(str(Path(__file__).with_name("verify-consolidation-apk.py")),run_name="__main__")
