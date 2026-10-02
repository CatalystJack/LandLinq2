Source: https://www.eia.gov/opendata/documentation.php
Title: 
		EIA's API Technical Documentation -
		U.S. Energy Information Administration (EIA)	
Fetched: 2026-10-02T19:54:11.671Z

# OPEN DATA

Committed to making energy data more accessible, understandable, relevant, and responsive to your needs.

[API](https://www.eia.gov/opendata/index.php) [Add-Ons](https://www.eia.gov/opendata/excel/) [Documentation](https://www.eia.gov/opendata/documentation.php)

In this issue

# API Technical Documentation

* * *

## APIv2 Patch Notes

**March 2026, v 2.1.12: Performance improvements, bugfixes**

- Resolved a bug in the new to/from date series logic that would return the incorrect number of rows in the total: field.

- Optimized internal logic to improve load tolerance on specific API query routes.


**January 2026, v 2.1.11: Improved to/from dates and frequency logic**

- A query that stipulates an identical start and end date (i.e, a year), but the data set has a smaller periodicity (monthly), the API will now return all data _inclusive_ of those identical date bounds. Previously the API would return 0 records.




For example, if an API request stiupates start=2024 and end=2024, but the frequency of that data set is monthly, the API will respond with data points for January 2024, February 2024, and so on.


**October 2025, v 2.1.10: More consistent HTTP status codes**

- HTTP status codes sent in the headers will now match any errors in the human-readable text.


Previously, submitting a bad parameter (i.e, data\[\]=monsters) would produce a choerent error message in the response body (including error 400: bad request), but the HTTP status code for the transaction might not agree (200: ok, 404: not found, etc). This has been made more consistent.


**September 2025, v.2.1.9**

- All returns now include a default sorting order, if none is specified. Previously, requesting paginated data without a `sort` parameter, would sometimes return rows in an unpredicatble sequence.
- APIv1 requests now properly return a 404 if the SeriesID unique identifier is not found.
- The YAML file will now automatically reflect any additions/changes to the API.
- Miscellaneous minor bugfixes from 2.1.7 and 2.1.8.
- Internal optimizations to improve performance.

**January 2024, v2.1.6: JSON data points standardized as strings**

- Added new /electricity/rto data points (sub BAs). These data points required leading zeroes, which could not be expressed as JSON numbers.

- To maintain data type consistency across routes, the API has been standardized to return data values as strings.


**March 2023, v2.1.5: Minor bux fixes**

- Include EIA Excel Add-in version in the data return from the core API function.

**February 2023, v2.1.4: Minor bux fixes**

- Fix for Excel Add-in for International Series.
- OGIRS Query fix to pull specific series for Petroleum/Natural Gas routes.

**February 2023, v2.1.3: Minor bux fixes**

- Fix spelling error.
- Reorder default frequencies.
- Address minor reported issues.

**January 2023, v2.1.2: Minor bux fixes**

- Common data set fix for all data sets.

**January 2023, v2.1.1: Minor bux fixes**

- New "Unit" column for AEO/IEO controller.

**November 2022, v2.1.0: Clementia** _Feature patch to add backward compatibility and migration features for APIv1_.

- Added automatic translation for APIv1 series IDs with the v2 /SeriesID path.
- Introduced in-return warning messages.

**November 2022, v2.0.4: Performance Tuning.**

- Optimized the back-end route processor to improve performance, especially while under load.

**September 2022, v2.0.3: Minor bux fixes**.

- Eliminated a bug where use of the `length` parameter could returm more than the 5,000 row maximum.

**May 2022, v2.0.2: Public Release**

- Added Support for XML output with the `out=xml parameter`.

**February 2022, v2.0.1: Community Release**.

- Released first spec of APIv2; no changes.

## Introduction

EIA launched its original API in 2012. Since then, internet protocols and standards have evolved. To keep pace with these best practices and provide new, modern features, we have released a second version of our public API (APIv2).

### New Features

APIv2's improvements include:

- A fully RESTful implementation, including routes with a more programmatic syntax.

- Datasets that are arranged in a logical hierarchy. Member datasets may be discovered by querying their parent node.

- Modalities, periodicities, and facets, which vary between datasets, that may be specified and queried programmatically.

- Customizable API returns: specify the columns, date range, and facets you wish to receive, thereby removing the need for client-side processing.

- Enhanced metadata, specific to the dataset.


Responses to parameters both in the URL and in the HTTP header.

### APIv1 availability

EIA will maintain support for its legacy API (APIv1) until at least January 2023. Some of APIv1's features are deprecated, meaning that they are available in the API's original data series and interface, but they are not in APIv2.

Table 1 summarizes the differences between the API versions.

| Feature | APIv1 (deprecated; only exists in APIv1) | APIv2 Equivalent |
| --- | --- | --- |
| HTTP protocols | http and https (http to end soon) | Only https |
| Geoset query | Separate query with the command parameter | _Facet_ property with values such as \[stateid\] |
| Relation and category | Separate queries with the command parameter | Relation and category are inherent to the RESTful route or are expressed in metadata if not in a tree hierarchy |
| Sort | N/A | A _sort_ parameter |
| Pagination | _Start_, _end,_ and _num_ parameters in an HTTP header | _Offset_ and _length_ parameters |
| Update query | Quota‐free query that returns all series in category and their last update expressed in datetime | Not supported |

Table 1. APIv2 changes

## Overall Concepts

### Examples in this guide

We will gradually build our API queries to harness the power of our API. To keep things simple, we will remain with a single-use case: the retail sales of electricity in Colorado. However, this command syntax applies to all of our APIv2 datasets.

In this document, italicized code represents deprecated v1 methods that are interacting with our API.

`http://deprecated_code/`

APIv2 call examples are shown in a bolded, fixed-width font:

`https://api.eia.gov/API_route`

API returns or HTTP headers are shown in a bordered call-out:

```json
{
  Return from our API
}
```

In these examples, we've added whitespaces and carriage returns for clarity.

Many of our examples return very large data sets. For brevity, when we omit lines of a return, we'll denote them with ellipsis (…) as follows:

```json
response: {
  Thing 1
  Thing 2
  Thing 3
  …
}
```

We will use highlighted, **bold** to indicate important code and output.

### Using an API key

To call our API, you must use the unique API key assigned to you. Visit our Open Data pages ( [https://www.eia.gov/opendata/](https://www.eia.gov/opendata/)) to register for this free key. EIA will send the key automatically to the email address provided.

To use an API key, place it as a parameter after the route.

`https://api.eia.gov/API_route?api_key=xxxxxxx`

Replace **xxxxxx** with the API key transmitted in your email. You must use the API key.

### Submitting requests to our RESTful API and legacy APIv1 Series ID

In APIv2 and beyond, our data series are now organized in a tree-like hierarchy. Our program requests data by expressing a URL path through this tree, which looks like directories in a URL. This result is called a _route_. _For example, here's the route for retail sales of electricity (note, we always must use our individual API user's key)_:

`https://api.eia.gov/v2/electricity/retail-sales&api_key=xxxxxx`

In APIv1, we had to know the series ID and express it in an URL call as follows:

`http://api.eia.gov/aeries/?series_id=sssssss&api_key=xxxxxx`

For the Colorado data mentioned before, the older v1 requesting call would have been:

`http://api.eia.gov/series/?series_id=ELEC.SALES.CO-RES.A&api_key=xxxxxx`

This APIv1 method is now deprecated .However, if you are fond of APIv1 Series IDs, you may invoke them using the special /series/ route, as follows. Note that we use a full route, but at the end we include the APIv1 Series\_ID:

`https://api.eia.gov/v2/seriesid/ELEC.SALES.CO-RES.A?api_key=xxxxxx`

### Supporting multiple versions of our API

The first node in the route is the version of the API we wish to use. This document invokes our version 2 of the API, so /v2/ appears in all requests.

`https://api.eia.gov/v2/API_route?api_key=xxxxxx`

## Generating an API call

Before we return actual data from the API, we'll review the API's syntax and how to discover all the data available.

### Choosing between parameter locations

Our API looks for parameters in two locations, either in the URL or in the HTTP headers that we send in the GET request.

GET places all of of our request variables in the URL itself. For example:

`http://api.eia.gov/v2/electricity/retail-sales/data/?api_key=xxxxxx&facets[stateid][]=CO&facets[sectorid][]=RES&frequency=monthly`

In this document, we have placed all our API query parameters in the URL. Some systems enforce a maximum length for URLs, so the API also accepts parameters inside the HTTP GET request.

To submit this same API call with parameters in this manner, we place our parameters inside the HTTP headers we submit to our API server. Note that our API Key must always appear in the URL; it will not be detected in the HTTP headers.

```json
https://api.eia.gov/v2/electricity/retail-sales/data?Api_key=xxxxxx
(standard HTTP headers here)
…
Content-Type: application/x-www-form-urlencoded facets[stateid][]=CO
facets[sectorid][]=RES&frequency=monthly
```

### Understanding returned error codes

If our query omits a required parameter or contains other syntax errors, the API will respond with the relevant HTTP error codes and, in some cases, additional JSON text explaining the error. For example, if we have data series by month, quarter, and year and we ask for millennia, the API will respond:

```json
{
  error: "Invalid frequency 'millenially' provided. The only valid frequencies are 'monthly', 'quarterly', and 'annual'.",
  code: 400
}
```

### Debugging information

Similarly, if the API is able to return a data response to our request but is behaving in a potentially unexpected manner, it will include a warning in addition to the data return.

For example, our API only returns a maximum of 5,000 rows, even if more data points are responsive to your request. The API will return as many rows as it can, along with this warning:

```json
{
warning: "parameter out of range"
description: "The API can only return 5000 rows in JSON format. Please consider constraining your request with facet, start, or end, or using offset to paginate results."
}
```

### Iterating through the API's tree and its metadata

At the end of every return, the API will echo back what it understood to be our request. This response may be helpful while debugging advanced queries. The API will also identify the version of the API we are interacting with, so we can pair it with the correct technical documentation and other dependencies.

```json
{
  response: {
    …
  },
  request: {
    command: "/v2/electricity/",
    params: {
      api_key: "xxxxxx"
		…
    }
  }
  apiVersion: "2.1.0"
}
```

### Examining a metadata request

Discovering datasets should be much easier in APIv2 because the API now self-documents and organizes itself in a data hierarchy. Parent datasets have child datasets, which may have children of their own, and so on. To investigate what datasets are available, we request a parent node. The API will respond with the child datasets (routes) for the path we've requested.

In our ongoing example, we're looking for retail sales of electricity in Colorado. Let's start at the top and ask about electricity data, as follows:

`https://api.eia.gov/v2/electricity&api_key=xxxxxx`

If we don't include `/data` as the last node in our route or if we request a parent node with multiple data series as children, the API will return metadata pertaining to our request. Some fields returned (depending on the series) may include:

- A long-form description

- Available frequencies and periodicities

- Optional data facets (such as a state location or PADD region)

- Child data series

```json
response: {
  id: "electricity",
  name: "Electricity",
  description: "EIA electricity survey data",
  routes: [\
    {\
      id: "retail-sales",\
      name: "Electricity Sales to Ultimate Customers",\
      description: "Electricity sales to ultimate customer by state and sector (number of customers, average price, revenue, and megawatthours of sales). Sources: Forms EIA-826, EIA-861, EIA-861M"\
    },\
    {\
      id: "electricity-power-operational-data",\
      name: "Electric Power Operations (Annual and Monthly)",\
      description: "Monthly and annual electric power operations by state, sector, and energy source. Source: Form EIA-923"\
    },\
    {\
      id: "rto",\
      …\
    },\
    {\
      id: "state-electricity-profiles",\
      …\
    },\
    {\
      id: "operating-generator-capacity",\
      …\
    },\
    {\
      id: "facility-fuel",\
      …\
    }\
  ]
},
…
```

In this case, the `/electricity` route has several child routes. No data is specific to the master category of electricity. To explore one step further down our data hierarchy, we added our choice of these nodes to our previous URL routes, like so:

`https://api.eia.gov/v2/electricity/retail-sales?api_key=xxxxxx`

`https://api.eia.gov/v2/electricity/electricity-power-operational-data?api_key=xxxxxx`

`https://api.eia.gov/v2/electricity/rto?api_key=xxxxxx`

`https://api.eia.gov/v2/electricity/state-electricity-profiles?api_key=xxxxxx`

`https://api.eia.gov/v2/electricity/operating-generator-capacity?api_key=xxxxxx`

`https://api.eia.gov/v2/electricity/facility-fuel?api_key=xxxxxx`

Using this mechanic, we can programmatically iterate through our data hierarchy.

#### _A word on API key limits_

Some programmers may create recursion routines to scrape our 2M+ data series automatically. Although they are free to do so, these programs must throttle the number of the requests they make per second and per hour. If you exceed these tolerances, your API key will be automatically but temporarily suspended, and it will be automatically reactivated after a brief cool down period. You will receive an error message informing you if this condition occurs. More specific information about these throttles are documented on our Open Data web pages.

### Facets and their available values

Let's explore one of these paths. We'll search for retail sales of electricity. We're not using **/data** yet, so we wouldn't receive data values. However, we will receive a metadata return. Here's our API call:

`https://api.eia.gov/v2/electricity/retail-sales?api_key=xxxxxx`

```json
response: {
  id: "retail-sales",
  name: "Electricity Sales to Ultimate Customers",
  description: "Electricity sales to ultimate customer by state and sector (number of customers, average price, revenue, and megawatthours of sales).
  Sources: Forms EIA-826, EIA-861, EIA-861M",
  frequency: [\
    {\
      id: "monthly",\
      description: "one data point for each month.",\
      query: "M",\
      format: "YYYY-MM"\
    },\
    {\
      id: "quarterly",\
      …\
    },\
      id: "yearly",\
      …\
    }\
  ],
  facets: [\
    {\
      id: "stateid",\
      description: "State / Census Region"\
    }\
    {\
      id: "sectorid",\
      //metadata for this facet "sector"\
      …\
    }\
  ],
  data: {
    revenue: {
      alias: "Revenue from Sales to Ultimate Customers",
      units: "million dollars"
    },
    sales: {
      alias: "Megawatthours Sold to Ultimate Customers",
      units: "million kilowatthours"
    },
    price: {
      alias: "Average Price of Electricity to Ultimate Customers",
      units: "cents per kilowatthour"
    },
    customers: {
      alias: "Number of Ultimate Customers",
      units: "Number of customers"
    }
  },

  startPeriod: "2001-01",
  endPeriod: "2022-07",
  defaultDateFormat: "YYYY-MM",
  defaultFrequency: "frequency"
  // Additional metadata here, if available
}
```

From this return, we see that the following data dimensions are available:

- Three periodicities (frequencies) of data: monthly, quarterly, and annual

- Two facets for further filtering: location and sector

- Data columns that will contain individual values: revenue, sales, price, and customers

- Additional metadata such as the range of available data, and default parameters should we choose not to explicitly stipulate them


This example return contains the metadata specific to retail sales of electricity. Other routes, many concerning different energy sources, are likely to have different metadata, specific and germane to their context.

### Returning metadata vs. specific data values

#### _Determine the variables we can pass into the API to customize results_

In the previous example, we asked for metadata about retail sales of electricity. We saw two facets: location and sector. To determine what the appropriate values for those are, we query on that facet itself Let's try asking for all available sectors by specifying the `sectorid` facet:

`https://api.eia.gov/v2/electricity/retail sales/facet/sectorid/?api_key=xxxxxx`

```json
response: {
  totalFacets: "6",
  facets: [\
    {\
      id: "COM",\
      name: "commercial", alias: "(COM) commercial"\
    },\
    {\
      id: "RES",\
      name: "residential",\
      alias: "(RES) residential"\
    },\
    {\
      id: "ALL",\
      name: "all sectors",\
      alias: "(ALL) all sectors"\
    },\
    {\
      id: "OTH",\
      name: "other",\
      alias: "(OTH) other"\
    },\
    {\
      id: "TRA",\
      name: "transportation",\
      alias: "(TRA) transportation"\
    },\
    {\
      id: "IND",\
      name: "industrial",\
      alias: "(IND) industrial"\
    }\
  ]
},
…
```

The API reports six available values for the facet `sectorid`: COM, RES, ALL, OTH, TRA, and IND.

We can query on a `sectorid` not in this list, for example _xxx_. The API won't return an error―because that's a valid query. However, we won't receive any data returns either, because the _xxx_ sector doesn't have any data points.

### Parameters

To request data points from the API, we stipulate `/data` as the final node in our API call. For example:

`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx`

The API will now return all data columns relevant to our query.

```json
response: {
  total: "7440",
  dateFormat: "YYYY",
  frequency: "annual",
  data: [\
    {\
      period: "2001",\
      stateid: "AL",\
      stateDescription: "Alabama",\
      sectorid: "ALL",\
      sectorName: "all sectors"\
    },\
    {\
      period: "2001",\
      stateid: "AL",\
      stateDescription: "Alabama",\
      sectorid: "CO",\
      sectorName: "commercial"\
    },\
  …\
  ]
},
…
```

Note that there are no values here, yet. Later, we'll specify the data points we want to receive using the `data[]` parameter, which returns columns of data.

## Data \[\]

Now that we have the API answering our requests and we know how to explore routes, metadata, and facets, let's get some data points out of it.

We may use a variety of parameters in our query to customize the return's results. We'll go over each parameter in turn. By doing so, we'll slowly build a robust API request.

### Facets

#### _(Optional, but required to receive data values) For the given route, specifies the data columns available to be returned_

To retrieve data points and their values from the API, we need to specify the specific columns we are interested in. In this document, we've been asking about electricity residential sales, but many data points about that subject matter are available. As of early 2022, our API has data values on revenue, sales, price, and number of customers.

In earlier examples, when we asked about the metadata, the API responded with these available data points:

`https://api.eia.gov/v2/electricity/retail-sales/?api_key=xxxxxx`

```json
…
data: {
  revenue: {
    units: "dollars"
  },
  sales: {
    units: "kilowatthours"
  },
  price: {
    units: "dollars per kilowatthour"
  }
  //Additional data values, if available
}
```

Given these columns, let's ask for the price. Remember, in addition to specifying the column in the `data[]` parameter, we must also specify `/data` as the last node in the route:

`https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=XXXXXX&data[]=price`

The response is a very large data set. We didn't specify any facets or filters, so the API returned as many values as it could. **The API will not return more than 5,000 rows of data points**. However, it will identify the total number of rows that are responsive to our request in the response header. In this case, 7,440 data rows match the API request we just made.

Here are the first few rows (as data is added and updated, these data points may change):

```json
response: {
  total: "7440",
  dateFormat: "YYYY",
  frequency: "annual",
  data: [\
    {\
      period: "2010",\
      stateid: "AZ",\
      stateDescription: "Arizona",\
      sectorid: "TRA",\
      sectorName: "transportation",\
      price: "0",\
      price-units: "cents per kilowatthour"\
    },\
    {\
      period: "2010",\
      stateid: "AR",\
      stateDescription: "Arkansas",\
      sectorid: "ALL",\
      sectorName: "all sectors", price: "7.28",\
      price-units: "cents per kilowatthour"\
    },\
    … //additional returns\
  ]
}
```

We can request multiple data columns be returned. Let's add the revenue column to our last query:

`https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=XXXXXX&data[0]=price&data[1]=revenue`

```json
data:
  [\
    {\
      period: "2010",\
      stateid: "AZ",\
      stateDescription: "Arizona",\
      sectorid: "TRA",\
      sectorName: "transportation",\
      price: "0",\
      revenue: "0",\
      price-units: "cents per kilowatthour",\
      revenue-units: "million dollars"\
    },\
    …\
  ]
```

We do not need to manually stipulate the members of the array; our API will automatically create it for us. This query also works:

`https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=XXXXXX&data[]=price&data[]=revenue`

and will produce the same return:

```json
data: [\
  {\
    period: "2010",\
    stateid: "AZ",\
    stateDescription: "Arizona",\
    sectorid: "TRA",\
    sectorName: "transportation",\
    price: "0",\
    revenue: "0",\
    price-units: "cents per kilowatthour",\
    revenue-units: "million dollars"\
  },\
  …\
]
```

### Frequency

#### _(Optional) Filters the API's response based on our requested location, sector, or other data filters_ em>

Most of our data series have one or more query facets. If we query a series that has these facets without stipulating one or more of them, the API will respond with all matching data. The result can be a very large return. Facets enable us to filter the data of concern to us, shrinking the size of the returns to a more manageable size.

For example, our retail sales of electricity has the `location` and `sector` facets. If we query the route (without specifying `/data`), the API will tell us the facets that are relevant to that route.

`https://api.eia.gov/v2/electricity/retail-sales/?api_key=xxxxxx`

```json
…
facets: [\
  {\
    id: "stateid",\
    description: "State / Census Region"\
  },\
  {\
    id: "sectorid", description: "Sector"\
    description: "sector"\
  }\
]
```

Let's go back to our data query above and its very large return. To focus on residential sales, we'll add the `sectorid` facet, and set it equal to **RES** ( **RES** is the `sectorid` for residential, as we learned from our metadata queries earlier).

`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES`

Now, we receive data that's only for the residential sector.

We may stipulate more than one facet in a call. Do so by invoking multiple facet parameters. To whittle down our query, let's specify electricity prices in Colorado _and_ those for the residential sector.

To do so, we'll add the `facet[stateid]` and set it to CO. Remember to ask for a column return, in this case, price:

`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO`

And then the API returns only price data for the residential sector in Colorado:

```json
response: {
  total: "20",
  dateFormat: "YYYY",
  frequency: "yearly",
  data: [\
    {\
      period: "2001",\
      stateid: "CO",\
      stateDescription: "Colorado",\
      sectorid: "RES",\
      sectorName: "residential",\
      price: "7.47",\
      price-units: "cents per kilowatthour"\
    },\
    {\
      period: "2002",\
      stateid: "CO",\
      stateDescription: "Colorado",\
      sectorid: "RES",\
      sectorName: "residential",\
      price: "7.37",\
      price-units: "cents per kilowatthour"\
    },\
    …\
  ]
}
…
```

### Date Range

#### _(Optional) Stipulates the periodicity of the data, if multiple options exist_

Many of our data series are assembled in different periodicities - how often an event occurs or is measured. For example, we may have data grouped annually, quarterly, monthly, or even daily. The frequency query parameter stipulates the periodicity we want. Here, we'll ask for residential prices, tabulated monthly.

`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&frequency=monthly`

Note that the period parameters have changed, indicating that we are now viewing monthly data:

```json
response: {
  total: "251",
  dateFormat: "YYYY-MM",
  frequency: "monthly",
  data: [\
    {\
      period: "2001-01",\
      stateid: "CO",\
      stateDescription: "Colorado",\
      sectorid: "RES",\
      sectorName: "residential",\
      price: "6.71",\
      price-units: "cents per kilowatthour"\
  },\
  …\
```\
\
If we omit this parameter, the API will respond with the default periodicity for that series. We can confirm what periodicity we're looking at by looking at the frequency metadata entry.\
\
### Sort Results\
\
#### (Optional) Stipulate a start and end date restriction for the data\
\
We can stipulate that the API only return data that lies within a specific date range. To do so, we add these optional parameters to our query, where _yyyy_ is the year, _mm_ is the month, and _dd_ is the day.\
\
Using our ongoing example, let's stipulate we only want to see February and March 2008 residential retail-sales of electricity in Colorado. The start parameter instructs the API only to return data after a specific point, and the end parameter stipulates the latest date. Using both of them in the same call, we can request data constrained to a specific time span:\
\
#### Start date\
\
`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&frequency=monthly&start=2008-01-31`\
\
#### End date\
\
`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&frequency=monthly&end=2008-03-01`\
\
#### Start and end date together\
\
`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&frequency=monthly&sta rt=2008-01-31&end=2008-03-01`\
\
We receive two rows in return, the data points for February 2008, and March 2008.\
\
In the last example, we specified a start date on January 31. Remember, the first part of this return stipulated that the series was monthly and the format of dates was YYYY-MM:\
\
```json\
response: {\
  total: "2",\
  dateFormat: "YYYY-MM",\
  frequency: "monthly",\
}\
```\
\
The datestamp of the February monthly data point, 2008-02, mathematically occurs before `2008-02-01`. If we were to stipulate `&start=2008-02-01`, or February 1, 2008, we wouldn't receive February's data. That's why we stipulate the day before 2008-02, or 2008-01-31 (January 31st).\
\
\
### Pagination\
\
#### (Optional) Orders the data by the column and in the direction we stipulate\
\
We can request that the results of our query be ordered by any column, or multiple columns, in ascending or descending order.\
\
We invoke the `sort` array with this format:\
\
`[SORT_PRECEDENCE_HERE][column]=COLUMN_NAME_HERE`\
\
starting with a `sort_precedence` of 0.\
\
We can stipulate the element `[direction]` as either`asc` or`desc` to dictate the sort direction. For example, to order our results so that the most-recent data is returned first, we sort on the `period` column in descending order:\
\
`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&frequency=monthly&sort[0][column]=period&sort[0][direction]=desc`\
\
This code changes the order of data points appropriately:\
\
```json\
response: {\
  …\
  [\
    {\
      …\
      period: "2021-11,"\
    },\
    {\
      …\
      period: "2021-10,"\
    },\
    {\
      …\
      period: "2021-09,"\
    },\
    …\
  ]\
  …\
}\
```\
\
If we do not specify an order, the API will use the default sort order for that data series.\
\
#### _(Optional) Returns a subset of eligible rows responsive to the query_\
\
Our request may generate more rows than we'd like to ingest in one API call. EIA's API limits its data returns to the first 5,000 rows responsive to the request (300 rows if we request XML format).\
\
We can override this behavior by using the length parameter. Using our most recent example of sorting by recent data first, let's imagine we only want the most recent year of data. Because we're stipulating a monthly frequency, we'd only want 12 rows of data. We assign the `length` parameter a value of 12:\
\
`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&frequency=monthly&sort[0][column]=period&sort[0][direction]=desc&length=12`\
\
We receive the first 12 rows of data the API can find, based on any sort or facet commands we give it.\
\
`Offset` stipulates the row number the API should begin its return with, out of all the eligible rows our query would otherwise provide. For example, this query would withhold the most recent 24 rows, or months, of the dataset. We know it'll be the most recent data points because we stipulated the sort order previously.\
\
`https://api.eia.gov/v2/electricity/retail sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&frequency=monthly&sort[0][column]=period&sort[0][direction]=desc&offset=24`\
\
In the above example, the API will skip over the first 24 eligible rows (`offset=24`), which translates into 24 months (`frequency=monthly`).\
\
We can combine these two parameters to page through our data. To skip two years (`offset=24`) and request a year of returns (`length=12`), we'd write:\
\
`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&frequency=monthly&sort[ 0][column]=period&sort[0][direction]=desc&offset=24&length=12`\
\
No matter what we stipulate with these two parameters, our API will always return the total number of rows otherwise responsive to our request. Even if we only request 12 rows, as above, the data return informs us of the total rows available:\
\
```json\
response: {\
  total: "251",\
  dateFormat: "YYYY-MM",\
  frequency: "monthly",\
  …\
}\
```\
\
#### _(Optional) Specifies XML or JSON output._\
\
By default, our API will provide data returns in JSON format. However, you may specifically request XML output with the out parameter:\
\
`https://api.eia.gov/v2/electricity/retail-sales/data?api_key=xxxxxx&data[]=price&facets[sectorid][]=RES&facets[stateid][]=CO&out=xml`\
\
```json\
<eia_api>\
  <response>\
    …\
    <row>\
      <period>2009</period>\
      <stateid>CO</stateid>\
      <stateDescription>Colorado</stateDescription>\
      <sectorid>RES</sectorid>\
      <sectorName>residential</sectorName>\
      <price>10</price>\
      <price-units>cents per kilowatthour</price-units>\
    </row>\
  </response>\
  …\
</eia_api>\
```\
\
For performance reasons, the API can only return a `maximum of 300 rows` when producing XML output. You may use the pagination features as described above to parse through the entire data return. You will see a warning embedded in the XML output to alert you of this limitation.\
\
You may also explicitly stipulate JSON output (`out=JSON`), however you don’t need to make this stipulation because omitting the parameter defaults the API to JSON format.\
\
- ## API Documentation\
\
- Versions\
\
\
\
Select Versiondropdown arrow\
\
\
\
\
\
  - [API v2.1.0 (Current)](https://www.eia.gov/opendata/documentation/APIv2.1.0.pdf)\
  - [API v2.0.1](https://www.eia.gov/opendata/documentation/APIv2.0.1.pdf)\
  - [API v1.0](https://www.eia.gov/opendata/v1/commands.php)\
\
- **[Download YAML File](https://www.eia.gov/opendata/eia-api-swagger.zip)**\
- **[FAQ's](https://www.eia.gov/opendata/faqs.php)**\
- **[API v2 webinar](https://www.eia.gov/opendata/pdf/EIA-APIv2-HandsOn-Webinar-11-Jan-23.pdf)**\
\
- ## Application Programming Interface (API)\
\
- #### Access EIA data how you need it\
\
- [Register](https://www.eia.gov/opendata/register.php)\
- [**Forgot API Key**](https://www.eia.gov/opendata/forgot-key.php)\
- Registration and compliance with the [API Terms of Service Agreement](https://www.eia.gov/opendata/terms-of-service.php) help EIA monitor usage and ensure service availability. EIA data is provided free of charge and should be used in compliance with our [Copyrights and Reuse Policy](https://www.eia.gov/about/copyrights_reuse.php).\
- [**FAQ's**](https://www.eia.gov/opendata/faqs.php) \| [**API v2 webinar**](https://www.eia.gov/opendata/pdf/EIA-APIv2-HandsOn-Webinar-11-Jan-23.pdf) \|\
\
[**Open Source Code**](https://www.eia.gov/tools/open-source-code/)\
\
Statistics\
\
Analysis\
\
Tools\
\
Education\
\
News\
\
### [Petroleum & Other Liquids](https://www.eia.gov/petroleum/ "Petroleum & Other Liquids")\
\
Crude oil, gasoline, heating oil, diesel, propane, and other liquids including biofuels and natural gas liquids.\
\
### [Natural Gas](https://www.eia.gov/naturalgas/ "Natural Gas")\
\
Exploration and reserves, storage, imports and exports, production, prices, sales.\
\
### [Electricity](https://www.eia.gov/electricity/ "Electricity")\
\
Sales, revenue and prices, power plants, fuel use, stocks, generation, trade, demand & emissions.\
\
### [Coal](https://www.eia.gov/coal/ "Coal")\
\
Reserves, production, prices, employment and productivity, distribution, stocks, imports and exports.\
\
### [Nuclear & Uranium](https://www.eia.gov/nuclear/ "Nuclear & Uranium")\
\
Uranium fuel, nuclear reactors, generation, spent fuel.\
\
### [Renewable & Alternative Fuels](https://www.eia.gov/renewable/ "Renewable & Alternative Fuels")\
\
Includes hydropower, solar, wind, geothermal, biomass and ethanol.\
\
### [EIA Survey Forms](https://www.eia.gov/survey/ "EIA Survey Forms")\
\
Forms EIA uses to collect energy data including descriptions, links to survey instructions, and additional information.\
\
### [Total Energy](https://www.eia.gov/totalenergy/ "Total Energy")\
\
Comprehensive data summaries, comparisons, analysis, and projections integrated across all energy sources.\
\
- [Monthly Energy Review](https://www.eia.gov/totalenergy/data/monthly/ "Monthly Energy Review")\
\
### [Consumption & Efficiency](https://www.eia.gov/consumption/ "Consumption & Efficiency")\
\
Energy use in homes, commercial buildings, manufacturing, and transportation.\
\
- [Residential Energy Consumption Survey (RECS)](https://www.eia.gov/consumption/residential/ "Residential Energy Consumption Survey (RECS)")\
- [Commercial Buildings Energy Consumption Survey (CBECS)](https://www.eia.gov/consumption/commercial/ "Commercial Buildings Energy Consumption Survey (CBECS)")\
- [Manufacturing Energy Consumption Survey (MECS)](https://www.eia.gov/consumption/manufacturing/ "Manufacturing Energy Consumption Survey (MECS)")\
\
### [U.S. States](https://www.eia.gov/states/ "U.S. States")\
\
State energy information, including overviews, rankings, data, and analyses.\
\
### [International](https://www.eia.gov/international/ "International")\
\
International energy information, including overviews, rankings, data, and analyses.\
\
### [Environment](https://www.eia.gov/environment/ "Environment")\
\
Greenhouse gas data, voluntary reporting, electric power plant emissions.\
\
- [U.S. Energy-Related Carbon Dioxide Emissions](https://www.eia.gov/environment/emissions/carbon/ "U.S. Energy-Related Carbon Dioxide Emissions")\
- [Energy-Related Carbon Dioxide Emissions at the State Level](https://www.eia.gov/environment/emissions/state/ "Energy-Related Carbon Dioxide Emissions at the State Level")\
\
### [Analysis and Projections](https://www.eia.gov/analysis/ "Analysis")\
\
Monthly and yearly energy forecasts, analysis of energy topics, financial analysis, congressional reports.\
\
- [Short-Term Energy Outlook](https://www.eia.gov/outlooks/steo/ "Short-Term Energy Outlook")\
- [Annual Energy Outlook](https://www.eia.gov/outlooks/aeo/ "Annual Energy Outlook")\
\
### [Special Reports](https://www.eia.gov/reports/\#T138 "Special Reports")\
\
Special market analysis and/or data requests.\
\
- [EIA-112 Residential Utility Disconnections](https://www.eia.gov/analysis/requests/residential/utility/ "Residential Utility Disconnections Report")\
- [SHIP Act](https://www.eia.gov/international/analysis/special-topics/SHIP_Act "SHIP Act")\
- [Energy & Financial Markets: What Drives Crude Oil Prices?](https://www.eia.gov/finance/markets/crudeoil/ "Energy & Financial Markets: What Drives Crude Oil Prices?")\
\
### [International](https://www.eia.gov/international/ "International")\
\
International energy analyses.\
\
- [Regional Analysis Briefs](https://www.eia.gov/international/analysis/world "Regional Analysis Briefs")\
- [Country Analysis Briefs](https://www.eia.gov/international/analysis/world "Country Analysis Briefs")\
- [World Oil Transit Chokepoints](https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints "World Oil Transit Chokepoints")\
- [OPEC Revenue](https://www.eia.gov/international/analysis/special-topics/OPEC_Revenues_Fact_Sheet "OPEC Revenue")\
- [Global Energy Security Data](https://www.eia.gov/outlooks/steo/report/energysecurity/article.php "Global Energy Security data")\
\
### [Data Tools, Apps, & Maps](https://www.eia.gov/tools/ "Data Tools, Apps, & Maps")\
\
Tools to customize searches, view specific data sets, study detailed documentation, and access time-series data.\
\
### [Open Data](https://www.eia.gov/opendata/ "Open Data")\
\
EIA's free and open data available as API, Excel add-in, bulk files, and widgets\
\
### [EIA Beta](https://www.eia.gov/beta "EIA Beta")\
\
Come test out some of the products still in development and let us know what you think!\
\
### [Open Source Code](https://www.eia.gov/tools/open-source-code/ "Open Source Code")\
\
EIA's open source code, available on GitHub.\
\
### [All Reports & Products](https://www.eia.gov/reports/ "All Reports & Products")\
\
### [Email Updates](https://www.eia.gov/tools/emailupdates/ "Email Updates")\
\
Sign up for email subscriptions to receive messages about specific EIA products\
\
### [RSS Feeds](https://www.eia.gov/tools/rssfeeds/ "RSS Feeds")\
\
Subscribe to feeds for updates on EIA products including Today in Energy and What's New.\
\
### Follow us. . .\
\
[facebook](http://facebook.com/eiagov/ "facebook")[twitter](http://x.com/eiagov/ "twitter")[youtube](http://youtube.com/eiagov/ "youtube")[linkedin](https://www.linkedin.com/company/u-s-energy-information-administration "linkedin")\
\
### [A-Z Index](https://www.eia.gov/tools/a-z/ "A-Z Index")\
\
[A](https://www.eia.gov/tools/a-z/index.php?id=a "A") \|\
[B](https://www.eia.gov/tools/a-z/index.php?id=b "B") \|\
[C](https://www.eia.gov/tools/a-z/index.php?id=c "C") \|\
[D](https://www.eia.gov/tools/a-z/index.php?id=d "D") \|\
[E](https://www.eia.gov/tools/a-z/index.php?id=e "E") \|\
[F](https://www.eia.gov/tools/a-z/index.php?id=f "F") \|\
[G](https://www.eia.gov/tools/a-z/index.php?id=g "G") \|\
[H](https://www.eia.gov/tools/a-z/index.php?id=h "H") \|\
[I](https://www.eia.gov/tools/a-z/index.php?id=i "I") \|\
[J](https://www.eia.gov/tools/a-z/index.php?id=j "J") \|\
[K](https://www.eia.gov/tools/a-z/index.php?id=k "K") \|\
[L](https://www.eia.gov/tools/a-z/index.php?id=l "L") \|\
[M](https://www.eia.gov/tools/a-z/index.php?id=m "M") \|\
[N](https://www.eia.gov/tools/a-z/index.php?id=n "N") \|\
[O](https://www.eia.gov/tools/a-z/index.php?id=o "O") \|\
[P](https://www.eia.gov/tools/a-z/index.php?id=p "P") \|\
[Q](https://www.eia.gov/tools/a-z/index.php?id=q "Q") \|\
[R](https://www.eia.gov/tools/a-z/index.php?id=r "R") \|\
[S](https://www.eia.gov/tools/a-z/index.php?id=s "S") \|\
[T](https://www.eia.gov/tools/a-z/index.php?id=t "T") \|\
[U](https://www.eia.gov/tools/a-z/index.php?id=u "U") \|\
[V](https://www.eia.gov/tools/a-z/index.php?id=v "V") \|\
[W](https://www.eia.gov/tools/a-z/index.php?id=w "W") \|\
[XYZ](https://www.eia.gov/tools/a-z/index.php?id=xyz "XYZ")\
\
### [Energy Explained](https://www.eia.gov/energyexplained/ "Energy Explained")\
\
- [What is Energy?](https://www.eia.gov/energyexplained/what-is-energy/ "What is Energy?")\
- [Units & Calculators](https://www.eia.gov/energyexplained/units-and-calculators/ "Units & Calculators")\
- [U.S. Energy Facts](https://www.eia.gov/energyexplained/us-energy-facts/ "U.S. Energy Facts")\
- [Use of Energy](https://www.eia.gov/energyexplained/use-of-energy/ "Use of Energy")\
- [Energy & Environment](https://www.eia.gov/energyexplained/energy-and-the-environment/ "Energy & Environment")\
- [Petroleum](https://www.eia.gov/energyexplained/oil-and-petroleum-products/ "Petroleum")\
- [Hydrocarbon Gas Liquids](https://www.eia.gov/energyexplained/hydrocarbon-gas-liquids/ "Hydrocarbon Gas Liquids")\
- [Natural Gas](https://www.eia.gov/energyexplained/natural-gas/ "Natural Gas")\
\
- [Coal](https://www.eia.gov/energyexplained/coal/ "Coal")\
- [Nuclear](https://www.eia.gov/energyexplained/nuclear/ "Nuclear")\
- [Electricity](https://www.eia.gov/energyexplained/electricity/ "Electricity")\
- [Hydrogen](https://www.eia.gov/energyexplained/hydrogen/ "Hydrogen")\
- [Hydropower](https://www.eia.gov/energyexplained/hydropower/ "Hydropower")\
- [Biofuels](https://www.eia.gov/energyexplained/biofuels/ "Biofuels")\
- [Biomass](https://www.eia.gov/energyexplained/biomass/ "Biomass")\
- [Wind](https://www.eia.gov/energyexplained/wind/ "Wind")\
- [Geothermal](https://www.eia.gov/energyexplained/geothermal/ "Geothermal")\
- [Solar](https://www.eia.gov/energyexplained/solar/ "Solar")\
\
### [For Teachers](https://www.eia.gov/kids/energy.php?page=6 "For Teachers")\
\
Lesson plans, science fair experiments, field trips, teacher guide, and career corner.\
\
### [Glossary](https://www.eia.gov/tools/glossary/ "Glossary")\
\
### [FAQs](https://www.eia.gov/tools/faqs/ "FAQs")\
\
- [Coal](https://www.eia.gov/tools/faqs/#coal "Coal")\
- [Conversion & Equivalents](https://www.eia.gov/tools/faqs/#conversion%20equivalents "Conversion & Equivalents")\
- [Oil/Petroleum](https://www.eia.gov/tools/faqs/index.php#oil/petroleum "Oil/Petroleum")\
- [Diesel](https://www.eia.gov/tools/faqs/#diesel "Diesel")\
- [Electricity](https://www.eia.gov/tools/faqs/#electricity "Electricity")\
- [Environment](https://www.eia.gov/tools/faqs/#environment "Environment")\
\
- [Gasoline](https://www.eia.gov/tools/faqs/index.php#gasoline "Gasoline")\
- [General Energy](https://www.eia.gov/tools/faqs/index.php#generalenergy "General Energy")\
- [Natural Gas](https://www.eia.gov/tools/faqs/index.php#naturalgas "Natural Gas")\
- [Nuclear](https://www.eia.gov/tools/faqs/index.php#nuclear "Nuclear")\
- [Prices](https://www.eia.gov/tools/faqs/index.php#prices "Prices")\
- [Renewables](https://www.eia.gov/tools/faqs/index.php#renewables "Renewables")\
\
[energy kids](https://www.eia.gov/kids/ "energy kids")\
\
### [What's New?](https://www.eia.gov/about/new/)\
\
- [Quarterly Coal Report—Second Quarter 2026](https://www.eia.gov/coal/production/quarterly/)\
- Oct 01, 2026\
- [Wholesale Electricity Market Data](https://www.eia.gov/electricity/wholesale/)\
- Oct 01, 2026\
- [Petroleum Marketing Monthly](https://www.eia.gov/petroleum/marketing/monthly/)\
- Oct 01, 2026\
\
### [Press Room](https://www.eia.gov/pressroom/ "Press Room")\
\
- [Press Releases](https://www.eia.gov/pressroom/releases.php "Press Releases")\
- [Congressional Testimony](https://www.eia.gov/pressroom/testimony.php "Congressional Testimony")\
- [Presentations](https://www.eia.gov/pressroom/presentations.php "Presentations")\
- [Events](https://www.eia.gov/pressroom/events/ "Events")