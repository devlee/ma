"""Aggregate market-analysis report over enriched address rows.

The report only contains aggregate statistics; it is intended for market
analysis, not for automated decisions about individual customers.
"""

from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from pathlib import Path

from .pipeline import EnrichmentResult
from .tiers import DEFAULT_TIERS, UNKNOWN_TIER

_TIER_ORDER = [label for label, _, _ in DEFAULT_TIERS] + [UNKNOWN_TIER]

_TIER_DESCRIPTIONS = {
    "low": "< 50% of national median",
    "lower_middle": "50% - 80% of national median",
    "middle": "80% - 120% of national median",
    "upper_middle": "120% - 200% of national median",
    "high": ">= 200% of national median",
    UNKNOWN_TIER: "unmatched address or suppressed estimate",
}


def _pct(part: int, whole: int) -> str:
    return f"{100 * part / whole:.1f}%" if whole else "n/a"


def build_report(result: EnrichmentResult) -> str:
    rows = result.rows
    total = len(rows)
    matched = [r for r in rows if r.geocode_matched]
    with_income = [r for r in matched if r.tract_median_household_income is not None]
    incomes = [r.tract_median_household_income for r in with_income]

    lines = ["# Neighborhood Income Market Analysis", ""]
    lines += ["## Coverage", ""]
    lines.append(f"- Total addresses: {total}")
    lines.append(f"- Geocoded to a census tract: {len(matched)} ({_pct(len(matched), total)})")
    lines.append(
        f"- With tract income estimate: {len(with_income)} ({_pct(len(with_income), total)})"
    )
    if result.acs_year:
        lines.append(f"- ACS vintage: {result.acs_year} 5-year estimates")
    if result.national_median_income:
        lines.append(
            f"- National median household income: ${result.national_median_income:,}"
        )
    for warning in result.warnings:
        lines.append(f"- Warning: {warning}")
    lines.append("")

    if incomes:
        lines += ["## Tract income across customers", ""]
        lines.append(f"- Median of tract medians: ${statistics.median(incomes):,.0f}")
        lines.append(f"- Mean of tract medians: ${statistics.mean(incomes):,.0f}")
        lines.append(f"- Range: ${min(incomes):,} - ${max(incomes):,}")
        lines.append("")

    tier_counts = Counter(r.income_tier for r in rows)
    lines += ["## Income tier distribution", ""]
    lines.append("| Tier | Definition | Addresses | Share |")
    lines.append("| --- | --- | ---: | ---: |")
    for tier in _TIER_ORDER:
        count = tier_counts.get(tier, 0)
        if count == 0 and tier == UNKNOWN_TIER:
            continue
        lines.append(
            f"| {tier} | {_TIER_DESCRIPTIONS[tier]} | {count} | {_pct(count, total)} |"
        )
    lines.append("")

    by_state: dict[str, list] = defaultdict(list)
    for row in matched:
        by_state[row.state.upper()].append(row)
    if by_state:
        lines += ["## By state", ""]
        lines.append("| State | Addresses | Median tract income |")
        lines.append("| --- | ---: | ---: |")
        for state, state_rows in sorted(
            by_state.items(), key=lambda kv: len(kv[1]), reverse=True
        ):
            state_incomes = [
                r.tract_median_household_income
                for r in state_rows
                if r.tract_median_household_income is not None
            ]
            median_str = (
                f"${statistics.median(state_incomes):,.0f}" if state_incomes else "n/a"
            )
            lines.append(f"| {state} | {len(state_rows)} | {median_str} |")
        lines.append("")

    lines += [
        "## Methodology & caveats",
        "",
        "- Income figures are ACS census-tract median household incomes, i.e. "
        "neighborhood-level statistics, not the actual income of any customer.",
        "- Tract medians are subject to the ecological fallacy: individual households "
        "within a tract vary widely.",
        "- Shipping addresses may be workplaces, freight forwarders, or gift recipients.",
        "- Intended for aggregate market analysis only; do not use for individual-level "
        "automated decisions (pricing, credit, eligibility).",
        "",
    ]
    return "\n".join(lines)


def write_report(result: EnrichmentResult, report_path: str | Path) -> None:
    report_path = Path(report_path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(build_report(result), encoding="utf-8")
