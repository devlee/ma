"""Command-line interface.

Usage:
    python -m income_insights.cli --input sample_data/addresses.csv \
        --output out/enriched.csv --report out/report.md

Requires the CENSUS_API_KEY environment variable (free key from
https://api.census.gov/data/key_signup.html) unless --geocode-only is passed.
"""

from __future__ import annotations

import argparse
import os
import sys

from .acs import DEFAULT_ACS_YEAR
from .pipeline import enrich, read_addresses, write_enriched_csv
from .report import write_report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="income_insights",
        description="Enrich US shipping addresses with census-tract income data "
        "for aggregate market analysis.",
    )
    parser.add_argument("--input", required=True, help="Input CSV with street/city/state/zip columns")
    parser.add_argument("--output", required=True, help="Path for the enriched CSV")
    parser.add_argument("--report", help="Optional path for the aggregate markdown report")
    parser.add_argument(
        "--acs-year", type=int, default=DEFAULT_ACS_YEAR, help="ACS 5-year vintage (default: %(default)s)"
    )
    parser.add_argument(
        "--geocode-only",
        action="store_true",
        help="Skip the income lookup (no API key needed); only attach tract GEOIDs",
    )
    args = parser.parse_args(argv)

    api_key = os.environ.get("CENSUS_API_KEY", "")
    if not args.geocode_only and not api_key:
        parser.error(
            "CENSUS_API_KEY is not set. Get a free key at "
            "https://api.census.gov/data/key_signup.html, or pass --geocode-only."
        )

    addresses = read_addresses(args.input)
    print(f"Read {len(addresses)} addresses from {args.input}")

    result = enrich(
        addresses, api_key=api_key, acs_year=args.acs_year, geocode_only=args.geocode_only
    )
    for warning in result.warnings:
        print(f"Warning: {warning}", file=sys.stderr)

    write_enriched_csv(result, args.output)
    print(f"Wrote enriched CSV to {args.output}")
    if args.report:
        write_report(result, args.report)
        print(f"Wrote aggregate report to {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
