Source: https://www.bls.gov/developers/api_faqs.htm
Title: Frequently Asked Questions (FAQs) : U.S. Bureau of Labor Statistics
Fetched: 2026-10-02T19:47:23.747Z

- [Bureau of Labor Statistics](https://www.bls.gov/)
- [Developers](https://www.bls.gov/developers/)

| - [BROWSE \<br>DEVELOPER'S SITE](https://www.bls.gov/developers/home.htm)<br>- [API Signatures v2](https://www.bls.gov/developers/api_signature_v2.htm)<br>  - [Single Series](https://www.bls.gov/developers/api_signature_v2.htm#single)<br>  - [Multiple Series](https://www.bls.gov/developers/api_signature_v2.htm#multiple)<br>  - [One or More Series with Optional Parameters](https://www.bls.gov/developers/api_signature_v2.htm#parameters)<br>  - [Latest Series](https://www.bls.gov/developers/api_signature_v2.htm#latest)<br>  - [Popular Series](https://www.bls.gov/developers/api_signature_v2.htm#popular)<br>  - [All Surveys](https://www.bls.gov/developers/api_signature_v2.htm#all)<br>  - [Single Survey](https://www.bls.gov/developers/api_signature_v2.htm#singlesurvey)<br>- [API Signatures v1](https://www.bls.gov/developers/api_signature.htm)<br>  - [Single Series](https://www.bls.gov/developers/api_signature.htm#single)<br>  - [Multiple Series](https://www.bls.gov/developers/api_signature.htm#multiple)<br>  - [One or More Series, Specifying Years](https://www.bls.gov/developers/api_signature.htm#years)<br>- [Sample Code](https://www.bls.gov/developers/api_sample_code.htm)<br>  - [C#](https://www.bls.gov/developers/api_c.htm)<br>  - [Java](https://www.bls.gov/developers/api_java.htm)<br>  - [PHP](https://www.bls.gov/developers/api_php.htm)<br>  - [Python](https://www.bls.gov/developers/api_python.htm)<br>  - [R Script](https://www.bls.gov/developers/api_r.htm)<br>  - [Ruby/Ruby on Rails](https://www.bls.gov/developers/api_ruby.htm)<br>  - [SAS](https://www.bls.gov/developers/api_sas.htm)<br>  - [Unix Command Line](https://www.bls.gov/developers/api_unix.htm)<br>  - [Matlab](http://www.github.com/micahjsmith/bls-matlab#readme)<br>  - [Julia](https://github.com/micahjsmith/BlsData.jl/blob/master/README.md)<br>- [Terms Of Service](https://www.bls.gov/developers/termsOfService.htm)<br>- [FAQs](https://www.bls.gov/developers/api_faqs.htm)<br>- [Release Notes](https://www.bls.gov/bls/api_features.htm)<br>- [Contact Us](https://data.bls.gov/cgi-bin/forms/lab?/developers/api_faqs.htm)<br>SEARCH DEVELOPER'S SITE | # Frequently Asked Questions (FAQs)

### API Basics

1. [What is an API?](https://www.bls.gov/developers/api_faqs.htm#basics1)
2. [What is JSON?](https://www.bls.gov/developers/api_faqs.htm#basics2)
3. [What is REST?](https://www.bls.gov/developers/api_faqs.htm#basics3)
4. [What is x-www-form-urlencoded?](https://www.bls.gov/developers/api_faqs.htm#basics4)

### Registration

1. [How is BLS Public Data API Version 2.0 different from Version 1.0?](https://www.bls.gov/developers/api_faqs.htm#register1)
2. [Do I have to register to use the BLS Public Data API?](https://www.bls.gov/developers/api_faqs.htm#register2)
3. [How do I register for BLS Public Data API Version 2.0?](https://www.bls.gov/developers/api_faqs.htm#register3)
4. [Do I have to renew my registration?](https://www.bls.gov/developers/api_faqs.htm#register4)

### Signatures and Responses

1. [Which API Signature do I use?](https://www.bls.gov/developers/api_faqs.htm#signatures1)
2. [Can I use API 1.0 signatures with API 2.0?](https://www.bls.gov/developers/api_faqs.htm#signatures2)
3. [I don't know the series ID(s) for the data I want to access. How do I find the ID(s)?](https://www.bls.gov/developers/api_faqs.htm#signatures3)
4. [How many requests can I make daily?](https://www.bls.gov/developers/api_faqs.htm#signatures4)
5. [How many series can I include in a query?](https://www.bls.gov/developers/api_faqs.htm#signatures5)
6. [How many years can I request per query?](https://www.bls.gov/developers/api_faqs.htm#signatures6)
7. [How do I request net and percent changes in a signature?](https://www.bls.gov/developers/api_faqs.htm#signatures7)
8. [Will my JSON response include metadata?](https://www.bls.gov/developers/api_faqs.htm#signatures8)

### Errors and Response Codes

1. ["Series does not exist" error.](https://www.bls.gov/developers/api_faqs.htm#errors1)
2. ["Database is locked for Series" error.](https://www.bls.gov/developers/api_faqs.htm#errors2)
3. ["No Data Available for Series" error.](https://www.bls.gov/developers/api_faqs.htm#errors3)
4. [How do I format the year for my request?](https://www.bls.gov/developers/api_faqs.htm#errors4)
5. ["415 Unsupported Media Type" error.](https://www.bls.gov/developers/api_faqs.htm#errors5)
6. [I received an HTTP status/response code with my request. What does the code mean?](https://www.bls.gov/developers/api_faqs.htm#errors6)
7. [My request won't return "catalog" data. What happened?](https://www.bls.gov/developers/api_faqs.htm#errors7)
8. [I received an 'Unknown SSL protocol error in connection to api.bls.gov:443'](https://www.bls.gov/developers/api_faqs.htm#errors8).
9. [I received a "429 Too Many Requests" error. What does this mean?](https://www.bls.gov/developers/api_faqs.htm#errors9)

### Other

1. [I didn't see sample code for my language.](https://www.bls.gov/developers/api_faqs.htm#others2)

**What is an API?**

An API (Application Programming Interface) is a tool that allows third party developers and organizations to access and manipulate data. The BLS Public Data API allows such users to access and manipulate published BLS survey data.

**What is JSON?**

JSON (JavaScript Object Notation) is a user-friendly, text-based data-interchange format of communication, used primarily to transmit data between applications and servers over network connections. It is an independent language, and there are parsers available for many languages, including [Java](https://www.bls.gov/developers/api_java.htm), [Ruby/Ruby on Rails](https://www.bls.gov/developers/api_ruby.htm), and [Unix Command Line](https://www.bls.gov/developers/api_unix.htm), for which we have provided sample code.

**What is REST?**

REST (Representational state transfer) is a type of software architecture, in which clients send requests to servers, and servers return responses after processing requests. It is the most commonly used architecture for APIs. The BLS Public Data API uses REST architecture.

**What is x-www-form-urlencoded?**

x-www-form-urlencoded is a content type for an HTTP request where the body of the request is composed of name/value pairs separated by the ampersand (&), and the names are separated from the values by the equals symbol (=).

**How is API Version 2.0 different from Version 1.0?**

API Version 2.0 requires registration, and it offers greater query limits. It also allows users to request net and percent changes and series description information. See below for more details.

| Service | Version 2.0<br>(Registered) | Version 1.0<br>(Unregistered) |
| :-: | :-: | :-: |
| Daily query limit | 500 | 25 |
| Series per query limit | 50 | 25 |
| Years per query limit | 20 | 10 |
| Request rate limit | 50 requests per 10 seconds | 50 requests per 10 seconds |
| Net/Percent Changes | Yes | No |
| Optional annual averages | Yes | No |
| Series description information (catalog) | Yes | No |

**Do I have to register to use the BLS Public Data API?**

Registration is required for Version 2.0 of the BLS Public Data API. Registered users are offered higher usage API limits as shown in the table above and access to additional capabilities.

**How do I register to for BLS Public Data API Version 2.0?**

To register, go to the BLS Public Data API 2.0 [registration page](https://data.bls.gov/registrationEngine/), and enter your email address and organization name. Complete the CAPTCHA. You will receive an email from labstat@bls.gov with your registration key. Be sure to use this registration key in your requests to receive the expanded access that Version 2.0 provides.

**Do I have to renew my registration?**

Yes. Users must renew registration with the BLS Public Data API at least once a year.

**Which API Signature do I use?**

If you would like to return data for a single timeseries, you should use the [Single Series signature](https://www.bls.gov/developers/api_signature_v2.htm#single). If you would like to return data for multiple timeseries, you should use the [Multiple Series signature](https://www.bls.gov/developers/api_signature_v2.htm#multiple). The Single Series and Multiple Series signatures will return a three-year period of data by default.

If you would like to return data for a set period of time, you should use the [One or More Series with Optional Parameters signature](https://www.bls.gov/developers/api_signature_v2.htm#parameters). For Version 1.0 signatures, click [here](https://www.bls.gov/developers/api_signature.htm).

**Can I use API 1.0 signatures with API 2.0?**

Yes, API 1.0 signature are compatible with API Version 2.0.

**I don't know the series ID(s) for the data I want to access. How do I find the ID(s)?**

The BLS Public Data API requires users to know the series ID to request data. We do not currently have a catalogue of series IDs, but all BLS series IDs follow a similar [format](https://www.bls.gov/help/hlpforma.htm).

**How many requests can I make daily?**

Registered users may request up to 500 queries daily. Unregistered users may request up to 25 queries daily.

**How many series can I include in a query?**

Registered users may request up to 50 series per query. Unregistered users may request up to 25 series per query.

**How many years can I request per query?**

Registered users may request up to 20 years per query. Unregistered users may request up to 10 years per query.

**How do I request net and percent changes in a signature?**

You can request net and percent changes with any API Version 2.0 POST request. Net and percent calculations are available for one, three, six, and twelve month(s) for certain series. To request calculations, simply add`"calculations":true` to the signature. Visit the [API Signatures](https://www.bls.gov/developers/api_signature_v2.htm) page for more information.

Net and percent changes are **not** available via API Version 1.0.

**Will my JSON response include metadata?**

API Version 2.0 does return series descriptive information. You can register for Version 2.0 at [https://data.bls.gov/registrationEngine/](https://data.bls.gov/registrationEngine/).

At this time, version 1.0 of the BLS Public Data API only returns raw data from BLS surveys; it does not include metadata.

If you have not formatted your series ID or your request correctly, you may receive an error message. For example:

1{"status":"REQUEST\_SUCCEEDED","responseTime":104,"message":\["Invalid Series for Series laucn21219003!"\], "Results":\[{"series": \[{"seriesID":"laucn21219003!","data":\[\]}\] }\]}

We have provided solutions for some of the most common error messages.

**I received a** _**"Series does not exist"**_ **error. What does this mean?**

Please check to make sure that you typed your series ID in the correct [format](https://www.bls.gov/help/hlpforma.htm). Your series ID must include all capital letters and must not have any special characters.

**I received a** _**"Database is locked for Series"**_ **error. What does this mean?**

The data you requested is currently not available.

**I received a** _**"No Data Available for Series"**_ **error. What does this mean?**

You have requested data for a year that is not in our database. Please adjust your request.

**How do I format the year for my request?**

If you would like to specify a time frame in your request, you must include a startyear and an endyear within the request. Each four-digit year should be formatted in numeric characters –YYYY (e.g. "2013", not "aaaa" or "13"). Your request must not exceed a 10 year period.

**I received a** _**"415 Unsupported Media Type"**_ **error. What does this mean?**

If you are sending a JSON request, you must set your HTTP Content-Type to "application/json". You can do this using our [sample code](https://www.bls.gov/developers/api_sample_code.htm).

**I received an HTTP status/response code with my request. What does the code mean?**

- 200: Your request was successful.
- 202: Your request is processing.
- 400: Your request did not follow the correct syntax.
- 401: You're not authorized to make this request.
- 404: Your request was not found and/or does not exist.
- 429: You have made too many requests.
- 500: The server has encountered an unexpected condition, and the request cannot be completed.

**My request won't return "catalog" data. What happened?**

Catalog data is only available for a select number of surveys. The available surveys can be found in the [BLS Data Finder](https://data.bls.gov/dataQuery/find) tool.

**I received an 'Unknown SSL protocol error in connection to api.bls.gov:443'.**

The Bureau of Labor Statistics (BLS) stopped supporting Transport Layer Security (TLS) 1.0 effective October 1, 2018. Users must interact with BLS websites using TLS 1.1 and higher (preferably TLS 1.2 and higher). Users may have to update or configure their client libraries and browsers.

Transport Layer Security (TLS) is an internet protocol that ensures secure communications. It’s the most common security protocol used for web browsers and other applications that require data to be securely exchanged over a network. TLS ensures that a connection to a remote endpoint is the intended endpoint through encryption and endpoint identity verification. TLS 1.0 has vulnerabilities.

**I received a "429 Too Many Requests" error. What does this mean?**

You have exceeded our limit on the number of queries that can be executed within a specific period of time. Please refer to our [query limits](https://www.bls.gov/developers/api_faqs.htm#register1) for further information.

**I don't have sample code for my language.**

We have provided examples of sample code for the most common languages, including [Java](https://www.bls.gov/developers/api_java.htm), [PHP](https://www.bls.gov/developers/api_php.htm), [Python](https://www.bls.gov/developers/api_python.htm), [R](https://www.bls.gov/developers/api_r.htm), [Ruby/Ruby on Rails](https://www.bls.gov/developers/api_ruby.htm), [SAS](https://www.bls.gov/developers/api_sas.htm), and [Unix Command Line](https://www.bls.gov/developers/api_unix.htm).

Didn't see your question? Please send us your [feedback](https://data.bls.gov/forms/lab.htm?/developers/api_faqs.htm). We look forward to hearing from you.

**Last Modified Date:** August 30, 2023

- [Developers](https://www.bls.gov/developers/) |

selectselectselectselect