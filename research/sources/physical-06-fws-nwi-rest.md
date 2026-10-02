Source: https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services
Title: Wetland Web Mapping Services | U.S. Fish & Wildlife Service
Fetched: 2026-10-02T19:49:35.075Z

[Skip to main content](https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services#main-content)

![](https://www.fws.gov/themes/custom/fws/images/uswds/icon-dot-gov.svg)

**Official websites use .gov**

A **.gov** website belongs to an official government organization in the United States.

![](https://www.fws.gov/themes/custom/fws/images/uswds/icon-https.svg)

**Secure .gov websites use HTTPS**

A **lock** ( LockLocked padlock icon) or **https://** means you’ve safely connected to the .gov website. Share sensitive information only on official, secure websites.

# Wetland Web Mapping Services

# Wetlands Data

![](https://www.fws.gov/sites/default/files/styles/banner_image_xs/public/banner_images/2022-08/Banner%20for%20Coloring%20Banner_0.jpg?h=1b997ad3&itok=3yyvcDbg)

[Image Details](https://www.fws.gov/media/coastal-delta-kodiak-refuge-alaska)

## Wetland Web Mapping Services

[National Wetland Inventory](https://www.fws.gov/program/national-wetlands-inventory "National Wetlands Inventory") (NWI) geospatial wetlands data and reference layers can be accessed by web-based applications and mapping software using the following [Open GIS Consortium](https://www.opengeospatial.org/) (OGC) compliant web mapping services. These services allow GIS users to display and query wetlands data without the overhead of data management. Additionally, web developers can consume these services to include NWI wetland data into their own mapping applications. These services are updated biannually along with the Wetlands Mapper.

## Representational State Transfer (REST)

Software developers can incorporate our REST services within their map applications using the link provided.

GIS users can connect to these services using mapping software such as ESRI's ArcGIS by following the directions provided.

**REST Service address**: [https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest)

### Connecting to the Wetlands REST services in ESRI' ArcGIS

1. Launch ArcPro.
2. In the 'Contents' window, right click and select New -> New Server -> New ArcGIS Server.
3. Enter the following REST address in the Server URL box: [https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest)
4. Click 'OK'.
5. Click Finish.
6. In ArcPro under Servers, double click on 'wetlandsmapservice on fwspublicservices.wim.usgs.gov.ags'
7. Select the layers you would like to add to ArcPro.

## Web Map Services (WMS)

Software developers can incorporate our WMS services within their applications using the service information and links provided. GIS users can connect to these services using mapping software such as ESRI's ArcGIS by following the directions provided.

**WMS Service Name**: Wetlands

**Projection**: GCS, NAD83

**OGC Version**: 1.3

**Wetlands Data\***: [https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetl…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetlands/MapServer/WMSServer?request=GetCapabilities&service=WMS)

**Data Source:** [https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Data…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Data_Source/MapServer/WMSServer)?

**Wetlands Raster\***: [https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetl…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/WetlandsRaster/ImageServer/WMSServer?request=GetCapabilities&service=WMS)

**Wetlands Status**: [https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetl…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetlands_Status/MapServer/WMSServer?request=GetCapabilities&service=WMS)

**Riparian Data**: [https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Ripa…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Riparian/MapServer/WMSServer?request=GetCapabilities&service=WMS)

### Connecting to the Wetlands WMS in ESRI' ArcGIS

1. Launch ArcPro.
2. In the 'Contents' window, right click and select New -> New Server -> New WMS Server.
3. Enter the following WMS address in the URL text box:

**Wetlands Data WMS address:**

[https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetl…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetlands/MapServer/WMSServer?request=GetCapabilities&service=WMS&nbsp);

**Data Source WMS address:**

[https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Data…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Data_Source/MapServer/WMSServer?request=GetCapabilities&service=WMS&nbsp);

**Wetlands Raster WMS address:**

[https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetl…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/WetlandsRaster/ImageServer/WMSServer?request=GetCapabilities&service=WMS&nbsp);

**Wetlands Status WMS address:**

[https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetl…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Wetlands_Status/MapServer/WMSServer?request=GetCapabilities&service=WMS&nbsp);

**Riparian Data WMS address:**

[https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Ripa…](https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/services/Riparian/MapServer/WMSServer?request=GetCapabilities&service=WMS&nbsp);

4. Click on the “Get Layers” button to view the service and layer information.