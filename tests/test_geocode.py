from conftest import FakeResponse, FakeSession

from income_insights.geocode import geocode_addresses, parse_batch_response

BATCH_RESPONSE = (
    '"1","1600 Pennsylvania Ave NW, Washington, DC, 20500","Match","Exact",'
    '"1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500","-77.03535,38.898754",'
    '"76225813","L","11","001","006202","1031"\n'
    '"2","123 Nonexistent Blvd, Nowhere, ZZ, 00000","No_Match"\n'
)


def test_parse_batch_response():
    results = parse_batch_response(BATCH_RESPONSE)
    assert len(results) == 2

    matched = results[0]
    assert matched.matched
    assert matched.tract_geoid == "11001006202"
    assert matched.state_fips == "11"
    assert matched.county_fips == "001"
    assert matched.longitude == -77.03535
    assert matched.latitude == 38.898754

    unmatched = results[1]
    assert not unmatched.matched
    assert unmatched.tract_geoid == ""


def test_geocode_addresses_posts_batch_csv():
    session = FakeSession(post_response=FakeResponse(text=BATCH_RESPONSE))
    addresses = [
        {"id": "1", "street": "1600 Pennsylvania Ave NW", "city": "Washington", "state": "DC", "zip": "20500"},
        {"id": "2", "street": "123 Nonexistent Blvd", "city": "Nowhere", "state": "ZZ", "zip": "00000"},
    ]
    results = geocode_addresses(addresses, session=session)

    assert results["1"].matched and results["1"].tract_geoid == "11001006202"
    assert not results["2"].matched

    (url, kwargs), = session.post_calls
    assert "addressbatch" in url
    uploaded_csv = kwargs["files"]["addressFile"][1]
    assert "1600 Pennsylvania Ave NW" in uploaded_csv
    assert kwargs["data"]["benchmark"] == "Public_AR_Current"
