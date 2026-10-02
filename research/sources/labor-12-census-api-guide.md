Source: https://www.census.gov/data/developers/guidance/api-user-guide.html
Title: Census Data API User Guide
Fetched: 2026-10-02T19:54:18.954Z

# Census Data API User Guide

[Skip Navigation](https://www.census.gov/data/developers/guidance/api-user-guide.html#content)

[Within Developers](https://www.census.gov/data/developers.html)

[![Form to request a key](https://www.census.gov/data/developers/_jcr_content/root/responsivegrid/responsivegrid/inheritedreference/inheritRefWrap/teasercore.coreimg.png/1706824126682/request-a-key.png)](https://www.census.gov/data/developers/api-key.html)

# Census Data API User Guide

May 12, 2026


[![Census Data API User Guide](https://www.census.gov/data/developers/guidance/api-user-guide/_jcr_content/root/responsivegrid/responsivegrid/responsivegrid/responsivegrid/imagecore.coreimg.png/1772214041149/api-user-guidance-thumbnail.png)](https://www2.census.gov/data/api-documentation/api-user-guide.pdf)

- ![pdf.svg](https://www.census.gov/etc.clientlibs/census/clientlibs/census-pattern-library/resources/images/pdf.svg)



[Census Data API User Guide](https://www2.census.gov/data/api-documentation/api-user-guide.pdf)\[1.1 MB\]


The purpose of this user guide is to instruct developers and researchers on how to use the Census Data Application Programming Interface (API) to request data from U.S. Census Bureau datasets.

- [Overview](https://www.census.gov/data/developers/guidance/api-user-guide.Overview.html#list-tab-559651575)
- [What is the API](https://www.census.gov/data/developers/guidance/api-user-guide.What_is_the_API.html#list-tab-559651575)
- [Query Limits](https://www.census.gov/data/developers/guidance/api-user-guide.Query_Limits.html#list-tab-559651575)
- [API Key](https://www.census.gov/data/developers/guidance/api-user-guide.API_Key.html#list-tab-559651575)
- [Available Data](https://www.census.gov/data/developers/guidance/api-user-guide.Available_Data.html#list-tab-559651575)
- More
![](https://www.census.gov/etc.clientlibs/census/clientlibs/census-pattern-library/resources/images/downward-chevron.svg)  - [Core Concepts](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575)
  - [Example API Queries](https://www.census.gov/data/developers/guidance/api-user-guide.Example_API_Queries.html#list-tab-559651575)
  - [Ucgid Predicate](https://www.census.gov/data/developers/guidance/api-user-guide.Ucgid_Predicate.html#list-tab-559651575)
  - [Help & Contact Us](https://www.census.gov/data/developers/guidance/api-user-guide.Help_&_Contact_Us.html#list-tab-559651575)

Overview


- Overview
- What is the API
- Query Limits
- API Key
- Available Data
- Core Concepts
- Example API Queries
- Ucgid Predicate
- Help & Contact Us

## Overview

Applications built on Census data typically take advantage of three underlying services: Census Data API, TIGERweb REST Services and the Geocoder REST Services:

### Census Data API

[The Census Data Application Programming Interface (API)](https://www.census.gov/data/developers/updates/new-discovery-tool.html) is an API that gives the public access to raw statistical data from various Census Bureau data programs. In terms of space, we aggregate the data and usually associate them with a certain Census geographic boundary/area defined by a FIPS code. In terms of time, we associate the data with a specific vintage (reference year).

### TIGERweb

[TIGERweb GeoServices REST API](https://www.census.gov/data/developers/data-sets/TIGERweb-map-service.html) provides Census area boundaries/shapes referenced by FIPS codes. This service can take two types of parameters to return one or more Census boundaries: a FIPS code or a latitude/longitude pair. FIPS codes are 12-digit codes that are hierarchical in code so that the higher numbers define higher-level geographies and lower numbers define lower-level geographies.

### Geocoder

Our publicly available [Geocoding Services API](https://www.census.gov/data/developers/data-sets/Geocoding-services.html)  translates addresses and other location formats into latitude/longitude parameters, which are then fed into the TIGERweb REST services to request a Census boundary.

### Focus: Census Data API

The primary purpose of this guide is to cover the Census Data API. To learn more about the geography APIs, please visit the links included above.

## Related Information

- * * *

[How-to Materials for Using the Census API\\
\\
Do you have questions on how to use the Census API? Check out our step-by-step guidance to learn how to use the Census API to find the data you need.](https://www.census.gov/data/what-is-data-census-gov/guidance-for-data-users/how-to-materials-for-using-the-census-api.html "How-to Materials for Using the Census API")

* * *

- * * *

[Data Tool\\
\\
Explore Census Data\\
\\
This new platform on data.census.gov is based on overwhelming feedback to streamline the way you get data and digital content from the Census Bureau.](https://www.census.gov/data/data-tools/data-cedsci.html "Explore Census Data")

* * *


### You May Be Interested In

Data [Census Bureau Data and Maps\\
\\
\\
Access demographic, economic and population data from the U.S. Census Bureau. Explore census data with visualizations and view tutorials.](https://www.census.gov/data)

no-tag [Data Tools and Applications\\
\\
\\
Find information using interactive applications to get statistics from multiple surveys.](https://www.census.gov/data/data-tools.html)

no-tag [Emergency Management Hub\\
\\
\\
The U.S. Census Bureau produces timely local data that are critical to emergency planning, preparedness and recovery efforts.](https://www.census.gov/disasters)

Page Last Revised - May 14, 2026

loading