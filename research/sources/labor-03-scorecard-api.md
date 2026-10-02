Source: https://collegescorecard.ed.gov/data/api-documentation
Title: API Documentation | College Scorecard
Fetched: 2026-10-02T19:47:29.708Z

# API Documentation

* * *

The College Scorecard API offers access to a wealth of data about U.S. higher education institutions. This API enables developers to query and retrieve information about schools, programs, costs, graduation rates, admissions, and much more. This documentation will guide you through the process of accessing and utilizing the College Scorecard API.

- Getting Started
- Basic Usage
- Response Format
- Error Handling
- Field Parameters
- Advanced Usage
- Rate Limits

## Getting Started

### What Data is Available

The College Scorecard data is composed of two related datasets. The institution-level data represents the institution as a whole, while the field of study data describes specific fields of study at the institution. Details of the data available in the API can be found in the [Data Dictionary](https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx). Additional context for the data elements can also be found in the documentation reports for [institution-level data](https://collegescorecard.ed.gov/files/InstitutionDataDocumentation.pdf) and [field of study data](https://collegescorecard.ed.gov/files/FieldOfStudyDataDocumentation.pdf).

Depending on the variable, data may not be present across all years. The "cohort map" tabs in the [Data Dictionary](https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx) provide details about where you can expect to find data for a particular variable and what group of students (i.e., what cohort) it describes. The default for the API is provide the latest data available for all variables (i.e., the `latest` object). Since data are published at different times during the year, the latest data available for each metric may not come from the same year as other metrics. Data from specific years can be accessed by specifying a year instead of the `latest` object in your query. For example, the earnings data object from 2018 would be accessed by specifying `2018.earnings` instead of `latest.earnings` . An advantage of using the `latest` object is the data will automatically refresh when new data is released.

### API Access and Authentication

To use the College Scorecard API you must have an API key. An API key is a unique identifier that is used to authenticate data requests associated with your project. Keep your API key secure as it is required for all API requests.

First, please complete the security challenge below.

reCAPTCHA

Recaptcha requires verification.

I'm not a robot

reCAPTCHA is changing its terms of service. [Take action.](https://google.com/recaptcha/admin/migrate)

reCAPTCHA

reCAPTCHA

Recaptcha requires verification.

I'm not a robot

reCAPTCHA is changing its terms of service. [Take action.](https://google.com/recaptcha/admin/migrate)

reCAPTCHA

Second, use the form below to complete the registration process and receive your API key. The key will be emailed to you.

## Basic Usage

### Base URL

All API requests are made to the following base URL:

```
https://api.data.gov/ed/collegescorecard/v1/schools
```

### Request Structure

API requests are made using HTTP GET requests. The basic structure of a request is as follows:

```
https://api.data.gov/ed/collegescorecard/v1/schools?api_key=YOUR_API_KEY&{parameters}
```

### Parameters

The College Scorecard API accepts various parameters to filter and customize the data returned. Example parameters include:

- `school.name` : Filter by school name (e.g., `school.name=Harvard University` ).
- `school.state` : Filter by state (e.g., `school.state=CA` ).
- `school.city` : Filter by city (e.g., `school.city=Boston` ).
- `fields` : Specify which fields to include in the response (e.g., `fields=id,school.name,latest.student.size` ).

#### Example Request

```
https://api.data.gov/ed/collegescorecard/v1/schools?api_key=YOUR_API_KEY&school.name=Harvard University&fields=id,school.name,latest.student.size
```

### Pagination

The API uses pagination to manage large datasets. Use the following parameters for pagination:

- `page` : Specify the page number (default is 0).
- `per_page` : Specify the number of results per page (default is 20, maximum is 100).

#### Example Paginated Request

```
https://api.data.gov/ed/collegescorecard/v1/schools?api_key=YOUR_API_KEY&school.state=CA&page=1&per_page=10
```

### Sorting

To sort results by a given field, use the `sort` option parameter. For example, `sort=latest.student.size` will return records sorted by student size, in ascending order.

By default, using the `sort` option returns records sorted into ascending order, but you can specify ascending or descending order by appending `:asc` or `:desc` to the field name. For example: `sort=latest.student.size:desc`

**Note:** Sorting is only available on specific fields. Make sure the sort parameter is a field in the data set. For more information, please take a look at [data dictionary](https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx). Sorting is only available on fields that have text populated in the `index` column of the respective data dictionary tabs.

## Response Format

The API returns data in JSON format. A typical response includes metadata and results. Here’s an example of a response structure:

```
{
  "metadata": {
    "total": 1,
    "page": 0,
    "per_page": 20
  },
  "results": [\
    {\
      "id": 166027,\
      "school.name": "Harvard University",\
      "latest.student.size": 31145\
    }\
  ]
}
```

## Error Handling

If your request fails, the API will return an error message. Common error codes include:

- `400 Bad Request` : The request was invalid. Check your parameters.
- `401 Unauthorized` : Your API key is missing or invalid.
- `403 Forbidden` : You do not have access to the requested resource.
- `404 Not Found` : The requested resource could not be found.
- `500 Internal Server Error` : An error occurred on the server side.

### Example Error Response

```
{
  "error": {
    "code": 400,
    "message": "Invalid request parameters"
  }
}
```

## Field Parameters

The `fields` parameter allows you to specify which data fields you want to include in the response. This helps minimize the amount of data transferred and makes parsing responses easier.

All variables are listed in the Data Dictionary and are a combination of the `dev-category` and `developer-friendly name` columns. This parameter takes a comma-separated list of field names. For example: `fields=id,school.name,school.state` will return result records that only contain those three fields.

[Download the Data Dictionary (.xlsx, 703 KB)](https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx)

#### Example Field Selection Request

```
https://api.data.gov/ed/collegescorecard/v1/schools?api_key=YOUR_API_KEY&fields=id,school.name,latest.cost.tuition.in_state,latest.completion.rate
```

Wildcard fields are also available. These allow you to return child objects of data without specifying each variable. For example. if you want to get the latest available data, it is possible to specify a query such as `fields=id,school,latest` which will return the ID field, the School object and the Latest object with all the nested objects contained within each category.

When specifying specific fields to be returned from the API, the default response is to have a dotted string of the path to the field returned. You can also append the parameter `keys_nested=true` get back true json objects instead of an object of dotted strings.

## Common Use Cases

### Searching for Schools by Name

```
https://api.data.gov/ed/collegescorecard/v1/schools?api_key=YOUR_API_KEY&school.name=Stanford University
```

### Filtering Schools by State and City

```
https://api.data.gov/ed/collegescorecard/v1/schools?api_key=YOUR_API_KEY&school.state=NY&school.city=New York
```

### Retrieving Specific Data Fields

```
https://api.data.gov/ed/collegescorecard/v1/schools?api_key=YOUR_API_KEY&fields=id,school.name,latest.admissions.admission_rate.overall,latest.student.size
```

### Paginated Requests

```
https://api.data.gov/ed/collegescorecard/v1/schools?api_key=YOUR_API_KEY&school.state=TX&page=2&per_page=10
```

## Advanced Usage

### Value Lists

To filter by a set of strings or integers you can provide a comma-separated list of values. This will query the field for an exact match with _any_ of the supplied values.

For example: `school.degrees_awarded.predominant=2,3,4` will match records with a `school.degrees_awarded.predominant` value of `2` , `3` or `4` .

**Note:** Value lists with wildcards or floating-point numbers are not currently supported.

### Negative matches with the `__not` operator

To exclude a set of records from results, use a negative match (also known as an inverted match). Append the characters `__not` to the parameter name to specify a negative match.

For example: `school.region_id__not=5` matches on records where the `school.region_id` does _not_ equal `5` .

### Range matches with the `__range` operator

To match on field values in a particular numeric range, use a range match. Append the characters `__range` to the parameter name to specify a range match, and provide two numbers separated by two periods ( `..` ).

For example: `2013.student.size__range=100..500` matches on schools which had between 100 and 500 students in 2013.

Open-ended ranges can be performed by omitting one side of the range. For example: `2013.student.size__range=1000..` matches on schools which had over 1000 students.

#### Additional Notes on Ranges

- Both integer and floating-point ranges are supported.
- The left-hand number in a range must be lower than the right-hand number.
- Ranges are inclusive. For example, the range `3..7` matches both `3` and `7` , as well as the numbers in between.

### Geographic Filtering with `zip` and `distance`

When the dataset includes a `location` at the root level ( `location.lat` and `location.lon` ) then the documents will be indexed geographically. You can use the `zip` and `distance` options to narrow query results down to those within a geographic area. For example, `zip=12345&distance=10mi` will return only those results within 10 miles of the center of the given zip code.

Additionally, you can request `location.lat` and `location.lon` in a search that includes a `fields` filter and it will return the record(s) with respective lat and/or lon coordinates.

#### Additional Notes on Geographic Filtering

- By default, any number passed in the `distance` parameter is treated as a number of miles, but you can specify miles or kilometers by appending `mi` or `km` respectively.
- Distances are calculated from the center of the given zip code, not the boundary.
- Only U.S. zip codes are supported.

### Nesting Field of Study Results

The field of study data is included as an array of objects nested under a specified key. These objects may be queried just like any other data. However, there is an additional parameter to add to your API call to manage what is returned. By default, if specifying a search parameter, only objects of the array that match that parameter will be returned. You can pass `&all_programs_nested=true` to return all the items in the array instead of just those that match.

## Rate Limits

The API enforces rate limiting to ensure fair usage. If you exceed the allowed number of requests, you will receive a `429 Too Many Requests` response. The default rate limit is **1,000 requests per IP address per hour** . If you find that you are running into rate limit issues and would like to request an increase, please contact [scorecarddata@rti.org](mailto:scorecarddata@rti.org).

* * *

**Looking for Help?**

Visit [StackExchange](http://opendata.stackexchange.com/questions/tagged/collegescorecard) or email the help desk at [scorecarddata@rti.org](mailto:scorecarddata@rti.org).

For inquiries by members of the press, please contact [press@ed.gov](mailto:press@ed.gov).

- [Home](https://collegescorecard.ed.gov/)
- Search
[Search Colleges](https://collegescorecard.ed.gov/search/) [Search Fields of Study](https://collegescorecard.ed.gov/search/fos-landing/)
- Compare
[Compare Colleges](https://collegescorecard.ed.gov/compare/?toggle=institutions) [Compare Fields of Study](https://collegescorecard.ed.gov/compare/?toggle=fos)
- [Resources](https://collegescorecard.ed.gov/resources/)
- About the Data
[Download the Data](https://collegescorecard.ed.gov/data/) [Data Documentation](https://collegescorecard.ed.gov/data/data-documentation/) [API Documentation](https://collegescorecard.ed.gov/data/api-documentation/) [Change Log](https://collegescorecard.ed.gov/data/changelog/) [Glossary](https://collegescorecard.ed.gov/data/glossary/)

Powered by [College Scorecard Data](https://collegescorecard.ed.gov/data/)

[3.6.1](https://github.com/RTICWDT/college-scorecard/releases) \| [Contact Us](mailto:scorecarddata@rti.org) \| [Notices](https://www.ed.gov/about/ed-overview/required-notices) \| [Glossary](https://collegescorecard.ed.gov/data/glossary/)

[U.S. Department of Education](http://www.ed.gov/)

Ready to Compare:

0 Colleges

0 Fields of Study