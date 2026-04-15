import sys
import os
import pytest
import pandas as pd

# Ensure backend is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.data_merge_service import get_master_dataset


@pytest.fixture(scope="session")
def master_df() -> pd.DataFrame:
    """Session-scoped fixture providing the master dataset."""
    return get_master_dataset()
