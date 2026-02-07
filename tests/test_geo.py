import pathlib
import sys

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.common.geo import haversine_km, normalize_region_name, within_radius


def test_normalize_region_name():
    assert normalize_region_name(" Upper-East ") == "upper east"
    assert normalize_region_name("UPPER_EAST") == "upper east"
    assert normalize_region_name(None) == ""


def test_haversine_distance_basic():
    accra_lat, accra_lon = 5.6037, -0.1870
    kumasi_lat, kumasi_lon = 6.6885, -1.6244
    distance = haversine_km(accra_lat, accra_lon, kumasi_lat, kumasi_lon)
    assert 200 <= distance <= 260  # approx km


def test_within_radius_filters_correctly():
    facilities = pd.DataFrame(
        [
            {"facility_id": "f1", "latitude": 5.6, "longitude": -0.2},
            {"facility_id": "f2", "latitude": 6.7, "longitude": -1.6},
        ]
    )
    filtered = within_radius(
        facilities,
        latitude=5.6,
        longitude=-0.2,
        radius_km=50,
    )
    assert filtered["facility_id"].tolist() == ["f1"]
