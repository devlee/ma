"""Income tier labeling based on the ratio of tract income to the national median.

Bands are loosely based on the Pew Research Center convention (middle class =
2/3x to 2x of median income), with the middle band split for finer analysis.
"""

from __future__ import annotations

import math

# (label, lower bound inclusive, upper bound exclusive) as ratios to national median.
DEFAULT_TIERS: list[tuple[str, float, float]] = [
    ("low", 0.0, 0.5),
    ("lower_middle", 0.5, 0.8),
    ("middle", 0.8, 1.2),
    ("upper_middle", 1.2, 2.0),
    ("high", 2.0, math.inf),
]

UNKNOWN_TIER = "unknown"


def income_tier(
    tract_income: int | None,
    national_median: int,
    tiers: list[tuple[str, float, float]] = DEFAULT_TIERS,
) -> str:
    """Label a tract's median income relative to the national median."""
    if tract_income is None or national_median <= 0:
        return UNKNOWN_TIER
    ratio = tract_income / national_median
    for label, lower, upper in tiers:
        if lower <= ratio < upper:
            return label
    return UNKNOWN_TIER
