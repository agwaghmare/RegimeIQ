"""Tests for Phase 1 — data_merge_service."""

import pandas as pd
import pytest


class TestMasterDataset:
    """Tests for get_master_dataset()."""

    def test_shape_has_enough_rows(self, master_df):
        assert master_df.shape[0] > 4000, f"Only {master_df.shape[0]} rows"

    def test_index_is_datetime(self, master_df):
        assert isinstance(master_df.index, pd.DatetimeIndex)

    def test_no_duplicate_columns(self, master_df):
        assert master_df.columns.duplicated().sum() == 0

    def test_critical_columns_present(self, master_df):
        required = ["sp500", "vix", "unemployment", "cpi_yoy",
                     "yield_curve_10y2y", "credit_spread_hy"]
        for col in required:
            assert col in master_df.columns, f"Missing critical column: {col}"

    def test_enrichment_columns_present(self, master_df):
        derived = ["unemp_3m_change", "cpi_3m_change",
                    "credit_spread_3m_change", "nominal_10y",
                    "nominal_10y_3m_change", "nominal_2y"]
        for col in derived:
            assert col in master_df.columns, f"Missing derived column: {col}"

    def test_no_nan_in_critical_columns(self, master_df):
        critical = ["sp500", "vix", "unemployment", "cpi_yoy"]
        for col in critical:
            nan_count = master_df[col].isna().sum()
            assert nan_count == 0, f"{col} has {nan_count} NaNs"

    def test_date_range(self, master_df):
        assert master_df.index[0] <= pd.Timestamp("2006-07-01"), \
            f"Start date too late: {master_df.index[0]}"
        assert master_df.index[-1] >= pd.Timestamp("2025-12-01"), \
            f"End date too early: {master_df.index[-1]}"

    def test_index_sorted(self, master_df):
        assert master_df.index.is_monotonic_increasing

    def test_forward_fill_worked(self, master_df):
        """Macro columns should have no NaN after initial warmup (first 3 months)."""
        warmup = master_df.iloc[63:]  # ~3 months of biz days
        for col in ["unemployment", "cpi_yoy", "yield_curve_10y2y"]:
            nan_count = warmup[col].isna().sum()
            assert nan_count == 0, f"{col} has {nan_count} NaNs after warmup"


class TestLatestRow:
    """Tests for get_latest_row()."""

    def test_returns_series(self):
        from services.data_merge_service import get_latest_row
        latest = get_latest_row()
        assert isinstance(latest, pd.Series)

    def test_latest_date_is_recent(self):
        from services.data_merge_service import get_latest_row
        latest = get_latest_row()
        assert latest.name >= pd.Timestamp("2025-12-01"), \
            f"Latest date {latest.name} is too old"


class TestCacheFile:
    """Tests for CSV cache."""

    def test_master_csv_exists_on_disk(self):
        import os
        from services.data_merge_service import MASTER_CSV
        assert os.path.exists(MASTER_CSV), "master_dataset.csv not found on disk"
