import pytest
from conftest import FakeResponse, FakeSession

from income_insights.acs import (
    MissingApiKeyError,
    fetch_national_median_income,
    fetch_tract_median_incomes,
)


def test_fetch_national_median_income():
    session = FakeSession(
        get_responses=[FakeResponse(payload=[["B19013_001E", "us"], ["77719", "1"]])]
    )
    assert fetch_national_median_income("key", session=session) == 77719


def test_fetch_tract_incomes_with_suppressed_values():
    payload = [
        ["B19013_001E", "state", "county", "tract"],
        ["141238", "11", "001", "006202"],
        ["-666666666", "11", "001", "990000"],
    ]
    session = FakeSession(get_responses=[FakeResponse(payload=payload)])
    incomes = fetch_tract_median_incomes([("11", "001")], "key", session=session)

    assert incomes["11001006202"] == 141238
    assert incomes["11001990000"] is None


def test_one_request_per_unique_county():
    payload = [["B19013_001E", "state", "county", "tract"]]
    session = FakeSession(
        get_responses=[FakeResponse(payload=payload), FakeResponse(payload=payload)]
    )
    fetch_tract_median_incomes(
        [("11", "001"), ("36", "061"), ("11", "001")], "key", session=session
    )
    assert len(session.get_calls) == 2


def test_missing_key_raises():
    with pytest.raises(MissingApiKeyError):
        fetch_national_median_income("", session=FakeSession())
    with pytest.raises(MissingApiKeyError):
        fetch_tract_median_incomes([("11", "001")], "", session=FakeSession())
