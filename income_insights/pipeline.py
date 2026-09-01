"""End-to-end enrichment: address CSV -> tract GEOID -> income -> tier."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

import requests

from .acs import DEFAULT_ACS_YEAR, fetch_national_median_income, fetch_tract_median_incomes
from .geocode import geocode_addresses
from .tiers import UNKNOWN_TIER, income_tier

# Accepted (case-insensitive) column aliases in the input CSV.
_COLUMN_ALIASES = {
    "street": {"street", "address", "address1", "street_address", "addr"},
    "city": {"city", "town"},
    "state": {"state", "state_code", "province"},
    "zip": {"zip", "zipcode", "zip_code", "postal_code", "postalcode"},
}

OUTPUT_COLUMNS = [
    "id",
    "street",
    "city",
    "state",
    "zip",
    "geocode_matched",
    "matched_address",
    "tract_geoid",
    "tract_median_household_income",
    "income_tier",
]


@dataclass
class EnrichedRow:
    id: str
    street: str
    city: str
    state: str
    zip: str
    geocode_matched: bool = False
    matched_address: str = ""
    tract_geoid: str = ""
    tract_median_household_income: int | None = None
    income_tier: str = UNKNOWN_TIER

    def as_output_dict(self) -> dict:
        return {
            "id": self.id,
            "street": self.street,
            "city": self.city,
            "state": self.state,
            "zip": self.zip,
            "geocode_matched": str(self.geocode_matched).lower(),
            "matched_address": self.matched_address,
            "tract_geoid": self.tract_geoid,
            "tract_median_household_income": (
                "" if self.tract_median_household_income is None
                else self.tract_median_household_income
            ),
            "income_tier": self.income_tier,
        }


@dataclass
class EnrichmentResult:
    rows: list[EnrichedRow]
    national_median_income: int | None = None
    acs_year: int | None = None
    warnings: list[str] = field(default_factory=list)


def _resolve_columns(fieldnames: list[str]) -> dict[str, str]:
    """Map canonical column names to the actual CSV header names."""
    lookup = {name.strip().lower(): name for name in fieldnames}
    resolved: dict[str, str] = {}
    for canonical, aliases in _COLUMN_ALIASES.items():
        match = next((lookup[a] for a in aliases if a in lookup), None)
        if match is None:
            raise ValueError(
                f"Input CSV is missing a '{canonical}' column "
                f"(accepted names: {sorted(aliases)}; found: {fieldnames})"
            )
        resolved[canonical] = match
    return resolved


def read_addresses(input_path: str | Path) -> list[dict]:
    """Read the input CSV into address dicts with keys id/street/city/state/zip."""
    with open(input_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError(f"{input_path} is empty")
        columns = _resolve_columns(list(reader.fieldnames))
        id_column = next(
            (name for name in reader.fieldnames if name.strip().lower() == "id"), None
        )
        addresses = []
        for index, row in enumerate(reader, start=1):
            addresses.append(
                {
                    "id": (row[id_column].strip() if id_column else "") or str(index),
                    "street": row[columns["street"]].strip(),
                    "city": row[columns["city"]].strip(),
                    "state": row[columns["state"]].strip(),
                    "zip": row[columns["zip"]].strip(),
                }
            )
    return addresses


def enrich(
    addresses: list[dict],
    api_key: str | None,
    acs_year: int = DEFAULT_ACS_YEAR,
    geocode_only: bool = False,
    session: requests.Session | None = None,
) -> EnrichmentResult:
    """Geocode addresses and attach tract income data and tier labels."""
    session = session or requests.Session()
    geocoded = geocode_addresses(addresses, session=session)

    rows = []
    for addr in addresses:
        row = EnrichedRow(**addr)
        result = geocoded.get(addr["id"])
        if result and result.matched:
            row.geocode_matched = True
            row.matched_address = result.matched_address
            row.tract_geoid = result.tract_geoid
        rows.append(row)

    result = EnrichmentResult(rows=rows)
    matched_rows = [r for r in rows if r.geocode_matched]
    unmatched = len(rows) - len(matched_rows)
    if unmatched:
        result.warnings.append(f"{unmatched} address(es) could not be geocoded")

    if geocode_only or not matched_rows:
        return result

    counties = {(r.tract_geoid[:2], r.tract_geoid[2:5]) for r in matched_rows}
    national_median = fetch_national_median_income(api_key, year=acs_year, session=session)
    tract_incomes = fetch_tract_median_incomes(
        counties, api_key, year=acs_year, session=session
    )
    result.national_median_income = national_median
    result.acs_year = acs_year

    for row in matched_rows:
        row.tract_median_household_income = tract_incomes.get(row.tract_geoid)
        row.income_tier = income_tier(row.tract_median_household_income, national_median)

    suppressed = sum(
        1 for r in matched_rows if r.tract_median_household_income is None
    )
    if suppressed:
        result.warnings.append(
            f"{suppressed} tract(s) have suppressed/unavailable income estimates"
        )
    return result


def write_enriched_csv(result: EnrichmentResult, output_path: str | Path) -> None:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for row in result.rows:
            writer.writerow(row.as_output_dict())
