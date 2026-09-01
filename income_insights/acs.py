"""Tract-level median household income from the ACS 5-year estimates API.

The Census Data API requires a free API key (https://api.census.gov/data/key_signup.html),
passed via the ``CENSUS_API_KEY`` environment variable or the ``api_key`` argument.
"""

from __future__ import annotations

from typing import Iterable

import requests

ACS_BASE_URL = "https://api.census.gov/data/{year}/acs/acs5"
MEDIAN_HH_INCOME_VAR = "B19013_001E"
DEFAULT_ACS_YEAR = 2023

# ACS sentinel values for suppressed / unavailable estimates.
_SUPPRESSED_VALUES = {"-666666666", "-999999999", "-888888888", "", "null", None}


class MissingApiKeyError(RuntimeError):
    pass


def _parse_income(raw: str | None) -> int | None:
    if raw in _SUPPRESSED_VALUES:
        return None
    value = int(raw)
    return value if value >= 0 else None


def fetch_national_median_income(
    api_key: str,
    year: int = DEFAULT_ACS_YEAR,
    session: requests.Session | None = None,
    timeout: float = 60.0,
) -> int:
    """National median household income, used to normalize tract incomes into tiers."""
    if not api_key:
        raise MissingApiKeyError("CENSUS_API_KEY is required for ACS queries")
    session = session or requests.Session()
    response = session.get(
        ACS_BASE_URL.format(year=year),
        params={"get": MEDIAN_HH_INCOME_VAR, "for": "us:1", "key": api_key},
        timeout=timeout,
    )
    response.raise_for_status()
    header, row = response.json()
    return int(row[header.index(MEDIAN_HH_INCOME_VAR)])


def fetch_tract_median_incomes(
    state_county_pairs: Iterable[tuple[str, str]],
    api_key: str,
    year: int = DEFAULT_ACS_YEAR,
    session: requests.Session | None = None,
    timeout: float = 60.0,
) -> dict[str, int | None]:
    """Median household income for every tract in the given (state, county) FIPS pairs.

    Returns a mapping of 11-digit tract GEOID -> income in dollars (None if the
    estimate is suppressed for that tract). One API call is made per county,
    which keeps request counts low even for large address files.
    """
    if not api_key:
        raise MissingApiKeyError("CENSUS_API_KEY is required for ACS queries")
    session = session or requests.Session()
    incomes: dict[str, int | None] = {}
    for state_fips, county_fips in sorted(set(state_county_pairs)):
        response = session.get(
            ACS_BASE_URL.format(year=year),
            params={
                "get": MEDIAN_HH_INCOME_VAR,
                "for": "tract:*",
                "in": [f"state:{state_fips}", f"county:{county_fips}"],
                "key": api_key,
            },
            timeout=timeout,
        )
        response.raise_for_status()
        rows = response.json()
        header, data_rows = rows[0], rows[1:]
        income_idx = header.index(MEDIAN_HH_INCOME_VAR)
        state_idx = header.index("state")
        county_idx = header.index("county")
        tract_idx = header.index("tract")
        for row in data_rows:
            geoid = f"{row[state_idx]}{row[county_idx]}{row[tract_idx]}"
            incomes[geoid] = _parse_income(row[income_idx])
    return incomes
