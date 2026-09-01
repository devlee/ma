"""Neighborhood income enrichment for US shipping addresses, for aggregate market analysis.

Pipeline: address -> Census Tract (free Census Geocoder) -> tract median household
income (ACS 5-year estimates) -> income tier label -> aggregate report.
"""

__version__ = "0.1.0"
