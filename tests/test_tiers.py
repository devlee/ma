from income_insights.tiers import UNKNOWN_TIER, income_tier

NATIONAL = 80_000


def test_tier_bands():
    assert income_tier(30_000, NATIONAL) == "low"          # 0.375x
    assert income_tier(40_000, NATIONAL) == "lower_middle"  # exactly 0.5x
    assert income_tier(80_000, NATIONAL) == "middle"        # 1.0x
    assert income_tier(120_000, NATIONAL) == "upper_middle" # 1.5x
    assert income_tier(160_000, NATIONAL) == "high"         # exactly 2.0x
    assert income_tier(300_000, NATIONAL) == "high"


def test_band_edges_are_lower_inclusive():
    assert income_tier(63_999, NATIONAL) == "lower_middle"
    assert income_tier(64_000, NATIONAL) == "middle"        # 0.8x boundary is inclusive above
    assert income_tier(95_999, NATIONAL) == "middle"
    assert income_tier(96_000, NATIONAL) == "upper_middle"  # 1.2x boundary


def test_unknown_for_missing_income():
    assert income_tier(None, NATIONAL) == UNKNOWN_TIER
    assert income_tier(50_000, 0) == UNKNOWN_TIER
