import yfinance as yf
import pandas as pd
import numpy as np
import os

TICKERS = {
    "sp500": "^GSPC",
    "nasdaq": "^IXIC",
    "tlt": "TLT",
    "gld": "GLD",
    "vix": "^VIX"
}

# Resolve path to data/marketData/ relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKET_DATA_DIR = os.path.join(BASE_DIR, "data", "marketData")
os.makedirs(MARKET_DATA_DIR, exist_ok=True)


def fetch_market_data(start="2005-01-01"):
    data = {}

    for name, ticker in TICKERS.items():
        df = yf.download(ticker, start=start, progress=False, auto_adjust=True)

        # Flatten MultiIndex columns returned by newer yfinance versions
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df = df[["Close"]].rename(columns={"Close": name})
        data[name] = df

    merged = pd.concat(data.values(), axis=1)
    merged.columns = [str(c) for c in merged.columns]
    merged = merged.dropna()

    # Save to CSV
    csv_path = os.path.join(MARKET_DATA_DIR, "market_raw.csv")
    merged.to_csv(csv_path)

    return merged


def compute_market_features(start="2005-01-01"):
    df = fetch_market_data(start)

    returns = df.pct_change()

    df["sp500_1m_mom"] = df["sp500"].pct_change(21)
    df["sp500_realized_vol"] = (
        returns["sp500"].rolling(21).std() * np.sqrt(252)
    )

    rolling_max = df["sp500"].cummax()
    df["sp500_drawdown"] = (
        (df["sp500"] - rolling_max) / rolling_max
    )

    df = df.dropna()

    # Save features to CSV
    csv_path = os.path.join(MARKET_DATA_DIR, "market_features.csv")
    df.to_csv(csv_path)

    return df
