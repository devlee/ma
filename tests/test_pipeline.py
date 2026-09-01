import csv

from conftest import FakeResponse, FakeSession

from income_insights.pipeline import enrich, read_addresses, write_enriched_csv
from income_insights.report import build_report

GEOCODE_RESPONSE = (
    '"1","1600 Pennsylvania Ave NW, Washington, DC, 20500","Match","Exact",'
    '"1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500","-77.03535,38.898754",'
    '"76225813","L","11","001","006202","1031"\n'
    '"2","749 Howard Ave, Biloxi, MS, 39530","Match","Exact",'
    '"749 HOWARD AVE, BILOXI, MS, 39530","-88.885,30.396",'
    '"123","L","28","047","003800","2001"\n'
    '"3","123 Nonexistent Blvd, Nowhere, ZZ, 00000","No_Match"\n'
)

NATIONAL_PAYLOAD = [["B19013_001E", "us"], ["80000", "1"]]
DC_PAYLOAD = [
    ["B19013_001E", "state", "county", "tract"],
    ["170000", "11", "001", "006202"],
]
MS_PAYLOAD = [
    ["B19013_001E", "state", "county", "tract"],
    ["30000", "28", "047", "003800"],
]

ADDRESSES = [
    {"id": "1", "street": "1600 Pennsylvania Ave NW", "city": "Washington", "state": "DC", "zip": "20500"},
    {"id": "2", "street": "749 Howard Ave", "city": "Biloxi", "state": "MS", "zip": "39530"},
    {"id": "3", "street": "123 Nonexistent Blvd", "city": "Nowhere", "state": "ZZ", "zip": "00000"},
]


def _fake_session():
    return FakeSession(
        post_response=FakeResponse(text=GEOCODE_RESPONSE),
        # Counties are fetched in sorted order: (11, 001) before (28, 047).
        get_responses=[
            FakeResponse(payload=NATIONAL_PAYLOAD),
            FakeResponse(payload=DC_PAYLOAD),
            FakeResponse(payload=MS_PAYLOAD),
        ],
    )


def test_enrich_end_to_end(tmp_path):
    result = enrich(ADDRESSES, api_key="key", session=_fake_session())

    by_id = {row.id: row for row in result.rows}
    assert by_id["1"].tract_geoid == "11001006202"
    assert by_id["1"].tract_median_household_income == 170000
    assert by_id["1"].income_tier == "high"  # 170000 / 80000 = 2.125x
    assert by_id["2"].income_tier == "low"   # 30000 / 80000 = 0.375x
    assert not by_id["3"].geocode_matched
    assert by_id["3"].income_tier == "unknown"
    assert result.national_median_income == 80000
    assert any("could not be geocoded" in w for w in result.warnings)

    out_path = tmp_path / "enriched.csv"
    write_enriched_csv(result, out_path)
    with open(out_path, newline="") as f:
        rows = list(csv.DictReader(f))
    assert rows[0]["income_tier"] == "high"
    assert rows[2]["tract_median_household_income"] == ""

    report = build_report(result)
    assert "Total addresses: 3" in report
    assert "| high |" in report
    assert "| low |" in report
    assert "national median household income" in report.lower()


def test_geocode_only_skips_acs():
    session = FakeSession(post_response=FakeResponse(text=GEOCODE_RESPONSE))
    result = enrich(ADDRESSES, api_key=None, geocode_only=True, session=session)

    assert session.get_calls == []
    assert result.rows[0].tract_geoid == "11001006202"
    assert result.rows[0].income_tier == "unknown"


def test_read_addresses_with_aliased_columns(tmp_path):
    csv_path = tmp_path / "input.csv"
    csv_path.write_text(
        "Address,City,State,Zip_Code\n"
        "1600 Pennsylvania Ave NW,Washington,DC,20500\n",
        encoding="utf-8",
    )
    addresses = read_addresses(csv_path)
    assert addresses == [
        {
            "id": "1",
            "street": "1600 Pennsylvania Ave NW",
            "city": "Washington",
            "state": "DC",
            "zip": "20500",
        }
    ]
