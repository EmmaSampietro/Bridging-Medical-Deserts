# DHIS2 Database Analysis and Interpretation

## Executive Summary

This analysis explores a DHIS2 (District Health Information Software 2) database from Sierra Leone. DHIS2 is used by over 70 low- and middle-income countries for health information management and is a critical tool for tracking health metrics, including tests performed, deliveries, surgeries, ICU admissions, and other healthcare indicators.

## Database Overview

- **Total Tables**: 337
- **Total Data Values**: 50,000
- **Unique Facilities/Organizations**: 987
- **Unique Time Periods**: 40

### Key Tables

| Table | Rows | Description |
|-------|------|-------------|
| `datavalue` | 4,933,875 | Core health metric values (tests, procedures, admissions, etc.) |
| `dataelement` | 1,037 | Metadata describing what each health metric represents |
| `event` | 373,597 | Event-based health records (patient encounters) |
| `completedatasetregistration` | 241,024 | Dataset completion records (monthly/quarterly reporting) |
| `period` | 384 | Time period definitions (monthly, quarterly, etc.) |
| `organisationunit` | 1,332 | Health facilities and organizational units |
| `enrollment` | 73,133 | Patient program enrollments |
| `trackedentity` | 73,125 | Individual patients or entities being tracked |

## Health Metrics Analysis

### Identified Health Metric Categories

- **Test**: 10 related data elements found
- **Delivery**: 10 related data elements found
- **Surgery**: 7 related data elements found

#### Sample Metrics by Category

**Test Metrics:**
- TB lab Hemoglobin
- CMC FP services available - Male condoms
- Household members tested for malaria
- Foci malaria test
- Malaria tested (people in neighbourhood)

**Delivery Metrics:**
- MNCH Breech/shoulder delivery
- Pregnancy-related deaths (6 weeks of birth) 35+ y in comm.
- Pregnancy-related deaths (6 weeks of birth) 10-19y in comm.
- Low birth weight in community
- PMTCT women received ZDV & 3CT after delivery

**Surgery Metrics:**
- PFS Inadequate procedure room
- PFS Inadequate procedure room - Discussion with off-site management
- PFS Inadequate procedure room - Discussion with on-site management
- MNCH Destructive operations delivery
- CMC Signed consent forms for all PM and CAC procedures conducted during the past two months

### Data Value Statistics

- **Numeric Values**: 49,990 (100.0% of total)
- **Mean Value**: 22.17
- **Median Value**: 6.00
- **Value Range**: -35 to 3948
- **Standard Deviation**: 39.75

## Temporal Patterns

DHIS2 typically collects data on a **monthly or quarterly** basis. The database contains time-series data that allows for tracking trends over time.

- **Total Unique Periods**: 40

### Data Completeness

- **Total Dataset Registrations**: 50,000
- **Date Range**: 2013-09-30 17:46:00.073000 to 2014-06-23 23:30:51.787000

#### Monthly Data Collection Pattern

The following shows the distribution of data collection over time:

| Month | Count |
|-------|-------|
| 2013-09 | 1 |
| 2013-11 | 1 |
| 2013-12 | 1 |
| 2014-02 | 1 |
| 2014-03 | 1 |
| 2014-06 | 3 |

## Geographic and Facility Coverage

The database tracks data from **987 unique facilities/organizations**.

### Top Reporting Facilities

The following facilities have the most data entries:

| Facility ID | Data Entries |
|-------------|--------------|
| 1027 | 170 |
| 830 | 168 |
| 1038 | 157 |
| 73733 | 157 |
| 642 | 156 |
| 73727 | 144 |
| 233370 | 139 |
| 598 | 138 |
| 646 | 133 |
| 193247 | 133 |

## Key Findings

1. **Scale**: The database contains nearly **5 million data values**, representing a comprehensive health information system.

2. **Coverage**: Data is collected from hundreds of facilities across Sierra Leone, enabling district and national-level health monitoring.

3. **Temporal Tracking**: The system supports monthly and quarterly reporting, allowing for trend analysis and seasonal pattern identification.

4. **Health Metrics**: The database includes data elements related to:
   - Laboratory tests and diagnostics
   - Maternal deliveries and childbirth
   - Surgical procedures and operations

5. **Data Structure**: The database follows DHIS2's standard structure with:
   - **Data Values**: Actual metric values (counts, measurements)
   - **Data Elements**: Definitions of what each metric represents
   - **Periods**: Time periods for reporting (monthly/quarterly)
   - **Organisation Units**: Health facilities and administrative units
   - **Events**: Individual patient encounters and program events

## Use Cases

This database supports:

- **Health System Monitoring**: Track key health indicators over time
- **Resource Planning**: Understand facility capacity and utilization
- **Program Evaluation**: Assess effectiveness of health programs
- **Epidemiological Surveillance**: Monitor disease trends and outbreaks
- **Performance Management**: Evaluate facility and district performance
- **Research**: Support health research and policy development

## Technical Notes

- Data is stored in PostgreSQL format
- Primary data storage is in the `datavalue` table with 4.9M+ records
- Metadata tables (`dataelement`, `period`, `organisationunit`) provide context
- Event-based tracking supports individual patient-level data
- Aggregate data supports monthly/quarterly reporting requirements

---

*Analysis generated by DHIS2 exploration script*
