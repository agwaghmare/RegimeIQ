import pandas as pd

def classify_regime(market_df, macro_df):
    df = market_df.join(macro_df, how="inner")

    conditions = []

    for _, row in df.iterrows():
        if row["yield_curve"] < 0:
            conditions.append("Recession Risk")
        elif row["sp500_drawdown"] < -0.2:
            conditions.append("Crisis")
        elif row["cpi_yoy"] > 4:
            conditions.append("Inflation Regime")
        else:
            conditions.append("Expansion")

    df["regime"] = conditions

    return df