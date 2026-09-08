"""Batch geocoding of US addresses to census tracts via the Census Geocoder API.

The Census Geocoder is free and requires no API key. The batch endpoint accepts
up to 10,000 addresses per request as a headerless CSV of
(unique id, street, city, state, zip).
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Iterable, Sequence

import requests

GEOCODER_BATCH_URL = (
    "https://geocoding.geo.census.gov/geocoder/geographies/addressbatch"
)
BENCHMARK = "Public_AR_Current"
VINTAGE = "Current_Current"
BATCH_LIMIT = 10_000


@dataclass
class GeocodeResult:
    record_id: str
    input_address: str
    matched: bool
    matched_address: str = ""
    longitude: float | None = None
    latitude: float | None = None
    state_fips: str = ""
    county_fips: str = ""
    tract_code: str = ""

    @property
    def tract_geoid(self) -> str:
        """11-digit census tract GEOID (state + county + tract), or "" if unmatched."""
        if not self.matched:
            return ""
        return f"{self.state_fips}{self.county_fips}{self.tract_code}"


def _build_batch_csv(addresses: Sequence[dict]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    for addr in addresses:
        writer.writerow(
            [addr["id"], addr["street"], addr["city"], addr["state"], addr["zip"]]
        )
    return buffer.getvalue()


def parse_batch_response(text: str) -> list[GeocodeResult]:
    """Parse the geocoder's batch response CSV.

    Matched rows have 12 fields:
    id, input address, "Match", match type, matched address, "lon,lat",
    TIGER line id, side, state FIPS, county FIPS, tract code, block code.
    Unmatched ("No_Match"/"Tie") rows are truncated after the status field.
    """
    results: list[GeocodeResult] = []
    for row in csv.reader(io.StringIO(text)):
        if not row:
            continue
        record_id, input_address, status = row[0], row[1], row[2]
        if status != "Match" or len(row) < 12:
            results.append(
                GeocodeResult(record_id=record_id, input_address=input_address, matched=False)
            )
            continue
        lon_str, _, lat_str = row[5].partition(",")
        results.append(
            GeocodeResult(
                record_id=record_id,
                input_address=input_address,
                matched=True,
                matched_address=row[4],
                longitude=float(lon_str) if lon_str else None,
                latitude=float(lat_str) if lat_str else None,
                state_fips=row[8],
                county_fips=row[9],
                tract_code=row[10],
            )
        )
    return results


def geocode_addresses(
    addresses: Iterable[dict],
    session: requests.Session | None = None,
    timeout: float = 300.0,
) -> dict[str, GeocodeResult]:
    """Geocode addresses to census tracts, returning a mapping of record id -> result.

    Each address dict needs keys: id, street, city, state, zip.
    """
    session = session or requests.Session()
    addresses = list(addresses)
    results: dict[str, GeocodeResult] = {}
    for start in range(0, len(addresses), BATCH_LIMIT):
        chunk = addresses[start : start + BATCH_LIMIT]
        payload = _build_batch_csv(chunk)
        response = session.post(
            GEOCODER_BATCH_URL,
            data={"benchmark": BENCHMARK, "vintage": VINTAGE},
            files={"addressFile": ("addresses.csv", payload, "text/csv")},
            timeout=timeout,
        )
        response.raise_for_status()
        for result in parse_batch_response(response.text):
            results[result.record_id] = result
    return results
