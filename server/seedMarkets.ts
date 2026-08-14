import { db } from "./db";
import { acquisitionMarkets } from "@shared/schema";
import { sql } from "drizzle-orm";

// MSA seed data from the three PDFs provided
export const marketData = [
  // Active Adult MSA's (205 counties nationwide)
  // New York MSA
  { msaName: "New York MSA", county: "New York", state: "NY", fullCountyName: "New York County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Kings", state: "NY", fullCountyName: "Kings County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Queens", state: "NY", fullCountyName: "Queens County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Bronx", state: "NY", fullCountyName: "Bronx County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Richmond", state: "NY", fullCountyName: "Richmond County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Nassau", state: "NY", fullCountyName: "Nassau County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Suffolk", state: "NY", fullCountyName: "Suffolk County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Westchester", state: "NY", fullCountyName: "Westchester County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Rockland", state: "NY", fullCountyName: "Rockland County, NY", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Bergen", state: "NJ", fullCountyName: "Bergen County, NJ", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Hudson", state: "NJ", fullCountyName: "Hudson County, NJ", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Essex", state: "NJ", fullCountyName: "Essex County, NJ", productTypes: ["Active Adult"] },
  { msaName: "New York MSA", county: "Union", state: "NJ", fullCountyName: "Union County, NJ", productTypes: ["Active Adult"] },
  
  // Dallas–Fort Worth MSA
  { msaName: "Dallas–Fort Worth MSA", county: "Dallas", state: "TX", fullCountyName: "Dallas County, TX", productTypes: ["Active Adult"] },
  { msaName: "Dallas–Fort Worth MSA", county: "Tarrant", state: "TX", fullCountyName: "Tarrant County, TX", productTypes: ["Active Adult"] },
  { msaName: "Dallas–Fort Worth MSA", county: "Collin", state: "TX", fullCountyName: "Collin County, TX", productTypes: ["Active Adult"] },
  { msaName: "Dallas–Fort Worth MSA", county: "Denton", state: "TX", fullCountyName: "Denton County, TX", productTypes: ["Active Adult"] },
  { msaName: "Dallas–Fort Worth MSA", county: "Rockwall", state: "TX", fullCountyName: "Rockwall County, TX", productTypes: ["Active Adult"] },
  { msaName: "Dallas–Fort Worth MSA", county: "Kaufman", state: "TX", fullCountyName: "Kaufman County, TX", productTypes: ["Active Adult"] },
  
  // Los Angeles MSA
  { msaName: "Los Angeles MSA", county: "Los Angeles", state: "CA", fullCountyName: "Los Angeles County, CA", productTypes: ["Active Adult"] },
  { msaName: "Los Angeles MSA", county: "Orange", state: "CA", fullCountyName: "Orange County, CA", productTypes: ["Active Adult"] },
  
  // Atlanta MSA
  { msaName: "Atlanta MSA", county: "Fulton", state: "GA", fullCountyName: "Fulton County, GA", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "DeKalb", state: "GA", fullCountyName: "DeKalb County, GA", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Cobb", state: "GA", fullCountyName: "Cobb County, GA", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Gwinnett", state: "GA", fullCountyName: "Gwinnett County, GA", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Clayton", state: "GA", fullCountyName: "Clayton County, GA", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Cherokee", state: "GA", fullCountyName: "Cherokee County, GA", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Henry", state: "GA", fullCountyName: "Henry County, GA", productTypes: ["Active Adult"] },
  { msaName: "Atlanta MSA", county: "Forsyth", state: "GA", fullCountyName: "Forsyth County, GA", cityNote: "(Cumming, Gainesville)", productTypes: ["BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Hall", state: "GA", fullCountyName: "Hall County, GA", cityNote: "(Gainesville)", productTypes: ["BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Paulding", state: "GA", fullCountyName: "Paulding County, GA", cityNote: "(various)", productTypes: ["BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Coweta", state: "GA", fullCountyName: "Coweta County, GA", cityNote: "(Newnan)", productTypes: ["BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Fayette", state: "GA", fullCountyName: "Fayette County, GA", cityNote: "(Fayetteville, Peachtree City)", productTypes: ["BTR", "Conventional Apartments"] },
  { msaName: "Atlanta MSA", county: "Clark", state: "GA", fullCountyName: "Clark County, GA", cityNote: "(Athens)", productTypes: ["BTR", "Conventional Apartments"] },
  
  // Chicago MSA
  { msaName: "Chicago MSA", county: "Cook", state: "IL", fullCountyName: "Cook County, IL", productTypes: ["Active Adult"] },
  { msaName: "Chicago MSA", county: "DuPage", state: "IL", fullCountyName: "DuPage County, IL", productTypes: ["Active Adult"] },
  { msaName: "Chicago MSA", county: "Lake", state: "IL", fullCountyName: "Lake County, IL", productTypes: ["Active Adult"] },
  { msaName: "Chicago MSA", county: "Will", state: "IL", fullCountyName: "Will County, IL", productTypes: ["Active Adult"] },
  { msaName: "Chicago MSA", county: "Kane", state: "IL", fullCountyName: "Kane County, IL", productTypes: ["Active Adult"] },
  
  // Houston MSA
  { msaName: "Houston MSA", county: "Harris", state: "TX", fullCountyName: "Harris County, TX", productTypes: ["Active Adult"] },
  { msaName: "Houston MSA", county: "Fort Bend", state: "TX", fullCountyName: "Fort Bend County, TX", productTypes: ["Active Adult"] },
  { msaName: "Houston MSA", county: "Montgomery", state: "TX", fullCountyName: "Montgomery County, TX", productTypes: ["Active Adult"] },
  { msaName: "Houston MSA", county: "Brazoria", state: "TX", fullCountyName: "Brazoria County, TX", productTypes: ["Active Adult"] },
  
  // Washington, D.C. MSA
  { msaName: "Washington, D.C. MSA", county: "District of Columbia", state: "DC", fullCountyName: "District of Columbia", productTypes: ["Active Adult"] },
  { msaName: "Washington, D.C. MSA", county: "Arlington", state: "VA", fullCountyName: "Arlington County, VA", productTypes: ["Active Adult"] },
  { msaName: "Washington, D.C. MSA", county: "Alexandria City", state: "VA", fullCountyName: "Alexandria City, VA", productTypes: ["Active Adult"] },
  { msaName: "Washington, D.C. MSA", county: "Fairfax", state: "VA", fullCountyName: "Fairfax County, VA", productTypes: ["Active Adult"] },
  { msaName: "Washington, D.C. MSA", county: "Montgomery", state: "MD", fullCountyName: "Montgomery County, MD", productTypes: ["Active Adult"] },
  { msaName: "Washington, D.C. MSA", county: "Prince George's", state: "MD", fullCountyName: "Prince George's County, MD", productTypes: ["Active Adult"] },
  
  // Miami MSA
  { msaName: "Miami MSA", county: "Miami-Dade", state: "FL", fullCountyName: "Miami-Dade County, FL", productTypes: ["Active Adult"] },
  { msaName: "Miami MSA", county: "Broward", state: "FL", fullCountyName: "Broward County, FL", productTypes: ["Active Adult"] },
  { msaName: "Miami MSA", county: "Palm Beach", state: "FL", fullCountyName: "Palm Beach County, FL", productTypes: ["Active Adult"] },
  
  // Phoenix MSA
  { msaName: "Phoenix MSA", county: "Maricopa", state: "AZ", fullCountyName: "Maricopa County, AZ", productTypes: ["Active Adult"] },
  { msaName: "Phoenix MSA", county: "Pinal", state: "AZ", fullCountyName: "Pinal County, AZ", productTypes: ["Active Adult"] },
  
  // Seattle MSA
  { msaName: "Seattle MSA", county: "King", state: "WA", fullCountyName: "King County, WA", productTypes: ["Active Adult"] },
  { msaName: "Seattle MSA", county: "Snohomish", state: "WA", fullCountyName: "Snohomish County, WA", productTypes: ["Active Adult"] },
  { msaName: "Seattle MSA", county: "Pierce", state: "WA", fullCountyName: "Pierce County, WA", productTypes: ["Active Adult"] },
  
  // Denver MSA
  { msaName: "Denver MSA", county: "Denver", state: "CO", fullCountyName: "Denver County, CO", productTypes: ["Active Adult"] },
  { msaName: "Denver MSA", county: "Arapahoe", state: "CO", fullCountyName: "Arapahoe County, CO", productTypes: ["Active Adult"] },
  { msaName: "Denver MSA", county: "Jefferson", state: "CO", fullCountyName: "Jefferson County, CO", productTypes: ["Active Adult"] },
  { msaName: "Denver MSA", county: "Adams", state: "CO", fullCountyName: "Adams County, CO", productTypes: ["Active Adult"] },
  { msaName: "Denver MSA", county: "Douglas", state: "CO", fullCountyName: "Douglas County, CO", productTypes: ["Active Adult"] },
  
  // San Diego MSA
  { msaName: "San Diego MSA", county: "San Diego", state: "CA", fullCountyName: "San Diego County, CA", productTypes: ["Active Adult"] },
  
  // Tampa MSA
  { msaName: "Tampa MSA", county: "Hillsborough", state: "FL", fullCountyName: "Hillsborough County, FL", productTypes: ["Active Adult"] },
  { msaName: "Tampa MSA", county: "Pinellas", state: "FL", fullCountyName: "Pinellas County, FL", productTypes: ["Active Adult"] },
  { msaName: "Tampa MSA", county: "Pasco", state: "FL", fullCountyName: "Pasco County, FL", productTypes: ["Active Adult"] },
  { msaName: "Tampa MSA", county: "Hernando", state: "FL", fullCountyName: "Hernando County, FL", productTypes: ["Active Adult"] },
  
  // Orlando MSA
  { msaName: "Orlando MSA", county: "Orange", state: "FL", fullCountyName: "Orange County, FL", productTypes: ["Active Adult"] },
  { msaName: "Orlando MSA", county: "Seminole", state: "FL", fullCountyName: "Seminole County, FL", productTypes: ["Active Adult"] },
  { msaName: "Orlando MSA", county: "Osceola", state: "FL", fullCountyName: "Osceola County, FL", productTypes: ["Active Adult"] },
  { msaName: "Orlando MSA", county: "Lake", state: "FL", fullCountyName: "Lake County, FL", productTypes: ["Active Adult"] },
  
  // Charlotte MSA (BTR, Conventional, Lot Development)
  { msaName: "Charlotte MSA", county: "Mecklenburg", state: "NC", fullCountyName: "Mecklenburg County, NC", cityNote: "(Charlotte)", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Charlotte MSA", county: "Union", state: "NC", fullCountyName: "Union County, NC", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Charlotte MSA", county: "Cabarrus", state: "NC", fullCountyName: "Cabarrus County, NC", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Charlotte MSA", county: "Gaston", state: "NC", fullCountyName: "Gaston County, NC", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Charlotte MSA", county: "York", state: "SC", fullCountyName: "York County, SC", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Charlotte MSA", county: "Rowan", state: "NC", fullCountyName: "Rowan County, NC", productTypes: ["Lot Development"] },
  { msaName: "Charlotte MSA", county: "Iredell", state: "NC", fullCountyName: "Iredell County, NC", productTypes: ["Lot Development", "BTR", "Conventional Apartments"] },
  { msaName: "Charlotte MSA", county: "Wilks", state: "NC", fullCountyName: "Wilks County, NC", productTypes: ["Lot Development"] },
  { msaName: "Charlotte MSA", county: "Catawba", state: "NC", fullCountyName: "Catawba County, NC", productTypes: ["Lot Development"] },
  { msaName: "Charlotte MSA", county: "Lincoln", state: "NC", fullCountyName: "Lincoln County, NC", productTypes: ["Lot Development", "BTR", "Conventional Apartments"] },
  { msaName: "Charlotte MSA", county: "Lancaster", state: "SC", fullCountyName: "Lancaster County, SC", productTypes: ["Lot Development"] },
  { msaName: "Charlotte MSA", county: "Richland", state: "SC", fullCountyName: "Richland County, SC", productTypes: ["Lot Development"] },
  { msaName: "Charlotte MSA", county: "Greenville", state: "SC", fullCountyName: "Greenville County, SC", productTypes: ["Lot Development", "BTR", "Conventional Apartments"] },
  { msaName: "Charlotte MSA", county: "Spartanburg", state: "SC", fullCountyName: "Spartanburg County, SC", productTypes: ["Lot Development", "BTR", "Conventional Apartments"] },
  
  // Raleigh–Durham MSA (BTR, Conventional, Lot Development)
  { msaName: "Raleigh–Durham MSA", county: "Wake", state: "NC", fullCountyName: "Wake County, NC", cityNote: "(Raleigh)", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Raleigh–Durham MSA", county: "Durham", state: "NC", fullCountyName: "Durham County, NC", cityNote: "(Durham)", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Raleigh–Durham MSA", county: "Orange", state: "NC", fullCountyName: "Orange County, NC", cityNote: "(Hillsboro)", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Raleigh–Durham MSA", county: "Johnston", state: "NC", fullCountyName: "Johnston County, NC", cityNote: "(Clayton)", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Raleigh–Durham MSA", county: "Chatham", state: "NC", fullCountyName: "Chatham County, NC", cityNote: "(Pittsboro)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Raleigh–Durham MSA", county: "Franklin", state: "NC", fullCountyName: "Franklin County, NC", cityNote: "(Franklinton)", productTypes: ["Lot Development"] },
  
  // Greensboro MSA and Triad (BTR, Conventional, Lot Development)
  { msaName: "Greensboro MSA and Triad", county: "Forsyth", state: "NC", fullCountyName: "Forsyth County, NC", cityNote: "(Winston Salem)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Greensboro MSA and Triad", county: "Davie", state: "NC", fullCountyName: "Davie County, NC", cityNote: "(Mocksville)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Greensboro MSA and Triad", county: "Davidson", state: "NC", fullCountyName: "Davidson County, NC", cityNote: "(Lexington)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Greensboro MSA and Triad", county: "Guilford", state: "NC", fullCountyName: "Guilford County, NC", cityNote: "(Greensboro)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Greensboro MSA and Triad", county: "Alamance", state: "NC", fullCountyName: "Alamance County, NC", cityNote: "(Burlington)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Greensboro MSA and Triad", county: "Randolph", state: "NC", fullCountyName: "Randolph County, NC", cityNote: "(Asheboro)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  
  // Charleston, SC MSA
  { msaName: "Charleston, SC MSA", county: "Charleston", state: "SC", fullCountyName: "Charleston County, SC", cityNote: "(Charleston)", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Charleston, SC MSA", county: "Berkeley", state: "SC", fullCountyName: "Berkeley County, SC", cityNote: "(Goose Creek)", productTypes: ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Charleston, SC MSA", county: "Dorchester", state: "SC", fullCountyName: "Dorchester County, SC", cityNote: "(Summerville)", productTypes: ["Active Adult", "Lot Development"] },
  
  // Coastal Region
  { msaName: "Coastal", county: "New Hanover", state: "NC", fullCountyName: "New Hanover County, NC", cityNote: "(Wilmington)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Coastal", county: "Brunswick", state: "NC", fullCountyName: "Brunswick County, NC", cityNote: "(Shallotte)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Coastal", county: "Horry", state: "SC", fullCountyName: "Horry County, SC", cityNote: "(Myrtle Beach)", productTypes: ["BTR", "Conventional Apartments", "Lot Development"] },
  { msaName: "Coastal", county: "Georgetown", state: "SC", fullCountyName: "Georgetown County, SC", cityNote: "(Pawleys)", productTypes: ["Lot Development"] },
  
  // Asheville, NC MSA
  { msaName: "Asheville, NC MSA", county: "Buncombe", state: "NC", fullCountyName: "Buncombe County, NC", cityNote: "(Asheville)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Asheville, NC MSA", county: "Henderson", state: "NC", fullCountyName: "Henderson County, NC", productTypes: ["Active Adult"] },
  { msaName: "Asheville, NC MSA", county: "Haywood", state: "NC", fullCountyName: "Haywood County, NC", productTypes: ["Active Adult"] },
  
  // Greenville, SC MSA
  { msaName: "Greenville, SC MSA", county: "Greenville", state: "SC", fullCountyName: "Greenville County, SC", productTypes: ["Active Adult"] },
  { msaName: "Greenville, SC MSA", county: "Spartanburg", state: "SC", fullCountyName: "Spartanburg County, SC", productTypes: ["Active Adult"] },
  { msaName: "Greenville, SC MSA", county: "Anderson", state: "SC", fullCountyName: "Anderson County, SC", productTypes: ["Active Adult"] },
  { msaName: "Greenville, SC MSA", county: "Pickens", state: "SC", fullCountyName: "Pickens County, SC", productTypes: ["Active Adult"] },
  { msaName: "Greenville, SC MSA", county: "Laurens", state: "SC", fullCountyName: "Laurens County, SC", productTypes: ["Active Adult"] },
  
  // Savannah, GA MSA
  { msaName: "Savannah, GA MSA", county: "Chatham", state: "GA", fullCountyName: "Chatham County, GA", cityNote: "(Savannah)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Savannah, GA MSA", county: "Effingham", state: "GA", fullCountyName: "Effingham County, GA", productTypes: ["Active Adult"] },
  { msaName: "Savannah, GA MSA", county: "Bryan", state: "GA", fullCountyName: "Bryan County, GA", productTypes: ["Active Adult"] },
  
  // Nashville MSA (BTR, Conventional)
  { msaName: "Nashville MSA", county: "Davidson", state: "TN", fullCountyName: "Davidson County, TN", cityNote: "(Nashville)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Nashville MSA", county: "Williamson", state: "TN", fullCountyName: "Williamson County, TN", cityNote: "(Brentwood / Franklin / Springhill)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Nashville MSA", county: "Rutherford", state: "TN", fullCountyName: "Rutherford County, TN", cityNote: "(Murfreesboro)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Nashville MSA", county: "Sumner", state: "TN", fullCountyName: "Sumner County, TN", cityNote: "(Gallatin)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Nashville MSA", county: "Wilson", state: "TN", fullCountyName: "Wilson County, TN", cityNote: "(Lebanon)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  
  // Tennessee - Additional Counties
  { msaName: "Tennessee", county: "Hamilton", state: "TN", fullCountyName: "Hamilton County, TN", cityNote: "(Chattanooga)", productTypes: ["BTR", "Conventional Apartments"] },
  { msaName: "Tennessee", county: "Knox", state: "TN", fullCountyName: "Knox County, TN", cityNote: "(Knoxville)", productTypes: ["BTR", "Conventional Apartments"] },
  
  // Chattanooga MSA
  { msaName: "Chattanooga MSA", county: "Hamilton", state: "TN", fullCountyName: "Hamilton County, TN", productTypes: ["Active Adult"] },
  { msaName: "Chattanooga MSA", county: "Bradley", state: "TN", fullCountyName: "Bradley County, TN", productTypes: ["Active Adult"] },
  { msaName: "Chattanooga MSA", county: "Walker", state: "GA", fullCountyName: "Walker County, GA", productTypes: ["Active Adult"] },
  { msaName: "Chattanooga MSA", county: "Catoosa", state: "GA", fullCountyName: "Catoosa County, GA", productTypes: ["Active Adult"] },
  
  // Birmingham, AL MSA
  { msaName: "Birmingham, AL MSA", county: "Jefferson", state: "AL", fullCountyName: "Jefferson County, AL", cityNote: "(Birmingham)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Birmingham, AL MSA", county: "Shelby", state: "AL", fullCountyName: "Shelby County, AL", cityNote: "(Birmingham)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Birmingham, AL MSA", county: "St. Clair", state: "AL", fullCountyName: "St. Clair County, AL", productTypes: ["Active Adult"] },
  { msaName: "Birmingham, AL MSA", county: "Blount", state: "AL", fullCountyName: "Blount County, AL", productTypes: ["Active Adult"] },
  
  // Austin MSA
  { msaName: "Austin MSA", county: "Travis", state: "TX", fullCountyName: "Travis County, TX", productTypes: ["Active Adult"] },
  { msaName: "Austin MSA", county: "Williamson", state: "TX", fullCountyName: "Williamson County, TX", productTypes: ["Active Adult"] },
  { msaName: "Austin MSA", county: "Hays", state: "TX", fullCountyName: "Hays County, TX", productTypes: ["Active Adult"] },
  
  // Huntsville, AL MSA
  { msaName: "Huntsville, AL MSA", county: "Madison", state: "AL", fullCountyName: "Madison County, AL", cityNote: "(Huntsville)", productTypes: ["Active Adult", "BTR", "Conventional Apartments"] },
  { msaName: "Huntsville, AL MSA", county: "Limestone", state: "AL", fullCountyName: "Limestone County, AL", productTypes: ["Active Adult"] },
  
  // Richmond, VA MSA
  { msaName: "Richmond, VA MSA", county: "Henrico", state: "VA", fullCountyName: "Henrico County, VA", productTypes: ["Active Adult"] },
  { msaName: "Richmond, VA MSA", county: "Chesterfield", state: "VA", fullCountyName: "Chesterfield County, VA", productTypes: ["Active Adult"] },
  { msaName: "Richmond, VA MSA", county: "Hanover", state: "VA", fullCountyName: "Hanover County, VA", productTypes: ["Active Adult"] },
  { msaName: "Richmond, VA MSA", county: "Richmond City", state: "VA", fullCountyName: "Richmond City, VA", productTypes: ["Active Adult"] },
  { msaName: "Richmond, VA MSA", county: "Goochland", state: "VA", fullCountyName: "Goochland County, VA", productTypes: ["Active Adult"] },
  
  // Sacramento, CA MSA
  { msaName: "Sacramento, CA MSA", county: "Sacramento", state: "CA", fullCountyName: "Sacramento County", productTypes: ["Active Adult"] },
  { msaName: "Sacramento, CA MSA", county: "Placer", state: "CA", fullCountyName: "Placer County", productTypes: ["Active Adult"] },
  { msaName: "Sacramento, CA MSA", county: "El Dorado", state: "CA", fullCountyName: "El Dorado County", productTypes: ["Active Adult"] },
  { msaName: "Sacramento, CA MSA", county: "Yolo", state: "CA", fullCountyName: "Yolo County", productTypes: ["Active Adult"] },
  
  // Columbus, OH MSA
  { msaName: "Columbus, OH MSA", county: "Franklin", state: "OH", fullCountyName: "Franklin County", productTypes: ["Active Adult"] },
  { msaName: "Columbus, OH MSA", county: "Delaware", state: "OH", fullCountyName: "Delaware County", productTypes: ["Active Adult"] },
  { msaName: "Columbus, OH MSA", county: "Fairfield", state: "OH", fullCountyName: "Fairfield County", productTypes: ["Active Adult"] },
  { msaName: "Columbus, OH MSA", county: "Licking", state: "OH", fullCountyName: "Licking County", productTypes: ["Active Adult"] },
  { msaName: "Columbus, OH MSA", county: "Union", state: "OH", fullCountyName: "Union County", productTypes: ["Active Adult"] },
  
  // Kansas City, MO-KS MSA
  { msaName: "Kansas City, MO-KS MSA", county: "Jackson", state: "MO", fullCountyName: "Jackson County, MO", productTypes: ["Active Adult"] },
  { msaName: "Kansas City, MO-KS MSA", county: "Clay", state: "MO", fullCountyName: "Clay County, MO", productTypes: ["Active Adult"] },
  { msaName: "Kansas City, MO-KS MSA", county: "Platte", state: "MO", fullCountyName: "Platte County, MO", productTypes: ["Active Adult"] },
  { msaName: "Kansas City, MO-KS MSA", county: "Cass", state: "MO", fullCountyName: "Cass County, MO", productTypes: ["Active Adult"] },
  { msaName: "Kansas City, MO-KS MSA", county: "Johnson", state: "KS", fullCountyName: "Johnson County, KS", productTypes: ["Active Adult"] },
  { msaName: "Kansas City, MO-KS MSA", county: "Wyandotte", state: "KS", fullCountyName: "Wyandotte County, KS", productTypes: ["Active Adult"] },
  { msaName: "Kansas City, MO-KS MSA", county: "Leavenworth", state: "KS", fullCountyName: "Leavenworth County, KS", productTypes: ["Active Adult"] },
  
  // Jacksonville, FL MSA
  { msaName: "Jacksonville, FL MSA", county: "Duval", state: "FL", fullCountyName: "Duval County", productTypes: ["Active Adult"] },
  { msaName: "Jacksonville, FL MSA", county: "Clay", state: "FL", fullCountyName: "Clay County", productTypes: ["Active Adult"] },
  { msaName: "Jacksonville, FL MSA", county: "St. Johns", state: "FL", fullCountyName: "St. Johns County", productTypes: ["Active Adult"] },
  { msaName: "Jacksonville, FL MSA", county: "Nassau", state: "FL", fullCountyName: "Nassau County", productTypes: ["Active Adult"] },
  { msaName: "Jacksonville, FL MSA", county: "Baker", state: "FL", fullCountyName: "Baker County", productTypes: ["Active Adult"] },
  
  // Pittsburgh, PA MSA
  { msaName: "Pittsburgh, PA MSA", county: "Allegheny", state: "PA", fullCountyName: "Allegheny County", productTypes: ["Active Adult"] },
  { msaName: "Pittsburgh, PA MSA", county: "Butler", state: "PA", fullCountyName: "Butler County", productTypes: ["Active Adult"] },
  { msaName: "Pittsburgh, PA MSA", county: "Washington", state: "PA", fullCountyName: "Washington County", productTypes: ["Active Adult"] },
  { msaName: "Pittsburgh, PA MSA", county: "Westmoreland", state: "PA", fullCountyName: "Westmoreland County", productTypes: ["Active Adult"] },
  { msaName: "Pittsburgh, PA MSA", county: "Beaver", state: "PA", fullCountyName: "Beaver County", productTypes: ["Active Adult"] },
  
  // Cincinnati, OH-KY MSA
  { msaName: "Cincinnati, OH-KY MSA", county: "Hamilton", state: "OH", fullCountyName: "Hamilton County, OH", productTypes: ["Active Adult"] },
  { msaName: "Cincinnati, OH-KY MSA", county: "Butler", state: "OH", fullCountyName: "Butler County, OH", productTypes: ["Active Adult"] },
  { msaName: "Cincinnati, OH-KY MSA", county: "Warren", state: "OH", fullCountyName: "Warren County, OH", productTypes: ["Active Adult"] },
  { msaName: "Cincinnati, OH-KY MSA", county: "Clermont", state: "OH", fullCountyName: "Clermont County, OH", productTypes: ["Active Adult"] },
  { msaName: "Cincinnati, OH-KY MSA", county: "Boone", state: "KY", fullCountyName: "Boone County, KY", productTypes: ["Active Adult"] },
  { msaName: "Cincinnati, OH-KY MSA", county: "Kenton", state: "KY", fullCountyName: "Kenton County, KY", productTypes: ["Active Adult"] },
  { msaName: "Cincinnati, OH-KY MSA", county: "Campbell", state: "KY", fullCountyName: "Campbell County, KY", productTypes: ["Active Adult"] },
  
  // St. Louis, MO-IL MSA
  { msaName: "St. Louis, MO-IL MSA", county: "St. Louis", state: "MO", fullCountyName: "St. Louis County, MO", productTypes: ["Active Adult"] },
  { msaName: "St. Louis, MO-IL MSA", county: "St. Charles", state: "MO", fullCountyName: "St. Charles County, MO", productTypes: ["Active Adult"] },
  { msaName: "St. Louis, MO-IL MSA", county: "Jefferson", state: "MO", fullCountyName: "Jefferson County, MO", productTypes: ["Active Adult"] },
  { msaName: "St. Louis, MO-IL MSA", county: "Franklin", state: "MO", fullCountyName: "Franklin County, MO", productTypes: ["Active Adult"] },
  { msaName: "St. Louis, MO-IL MSA", county: "St. Clair", state: "IL", fullCountyName: "St. Clair County, IL", productTypes: ["Active Adult"] },
  { msaName: "St. Louis, MO-IL MSA", county: "Madison", state: "IL", fullCountyName: "Madison County, IL", productTypes: ["Active Adult"] },
  
  // Oklahoma City, OK MSA
  { msaName: "Oklahoma City, OK MSA", county: "Oklahoma", state: "OK", fullCountyName: "Oklahoma County", productTypes: ["Active Adult"] },
  { msaName: "Oklahoma City, OK MSA", county: "Cleveland", state: "OK", fullCountyName: "Cleveland County", productTypes: ["Active Adult"] },
  { msaName: "Oklahoma City, OK MSA", county: "Canadian", state: "OK", fullCountyName: "Canadian County", productTypes: ["Active Adult"] },
  { msaName: "Oklahoma City, OK MSA", county: "Logan", state: "OK", fullCountyName: "Logan County", productTypes: ["Active Adult"] },
  { msaName: "Oklahoma City, OK MSA", county: "Grady", state: "OK", fullCountyName: "Grady County", productTypes: ["Active Adult"] },
  
  // Louisville, KY-IN MSA
  { msaName: "Louisville, KY-IN MSA", county: "Jefferson", state: "KY", fullCountyName: "Jefferson County, KY", productTypes: ["Active Adult"] },
  { msaName: "Louisville, KY-IN MSA", county: "Oldham", state: "KY", fullCountyName: "Oldham County, KY", productTypes: ["Active Adult"] },
  { msaName: "Louisville, KY-IN MSA", county: "Bullitt", state: "KY", fullCountyName: "Bullitt County, KY", productTypes: ["Active Adult"] },
  { msaName: "Louisville, KY-IN MSA", county: "Shelby", state: "KY", fullCountyName: "Shelby County, KY", productTypes: ["Active Adult"] },
  { msaName: "Louisville, KY-IN MSA", county: "Clark", state: "IN", fullCountyName: "Clark County, IN", productTypes: ["Active Adult"] },
  { msaName: "Louisville, KY-IN MSA", county: "Floyd", state: "IN", fullCountyName: "Floyd County, IN", productTypes: ["Active Adult"] },
  
  // Providence, RI MSA
  { msaName: "Providence, RI MSA", county: "Providence", state: "RI", fullCountyName: "Providence County, RI", productTypes: ["Active Adult"] },
  { msaName: "Providence, RI MSA", county: "Kent", state: "RI", fullCountyName: "Kent County, RI", productTypes: ["Active Adult"] },
  { msaName: "Providence, RI MSA", county: "Washington", state: "RI", fullCountyName: "Washington County, RI", productTypes: ["Active Adult"] },
  { msaName: "Providence, RI MSA", county: "Bristol", state: "RI", fullCountyName: "Bristol County, RI", productTypes: ["Active Adult"] },
  
  // Hartford, CT MSA
  { msaName: "Hartford, CT MSA", county: "Hartford", state: "CT", fullCountyName: "Hartford County", productTypes: ["Active Adult"] },
  { msaName: "Hartford, CT MSA", county: "Tolland", state: "CT", fullCountyName: "Tolland County", productTypes: ["Active Adult"] },
  { msaName: "Hartford, CT MSA", county: "Middlesex", state: "CT", fullCountyName: "Middlesex County", productTypes: ["Active Adult"] },
  
  // Albuquerque, NM MSA
  { msaName: "Albuquerque, NM MSA", county: "Bernalillo", state: "NM", fullCountyName: "Bernalillo County", productTypes: ["Active Adult"] },
  { msaName: "Albuquerque, NM MSA", county: "Sandoval", state: "NM", fullCountyName: "Sandoval County", productTypes: ["Active Adult"] },
  { msaName: "Albuquerque, NM MSA", county: "Valencia", state: "NM", fullCountyName: "Valencia County", productTypes: ["Active Adult"] },
  { msaName: "Albuquerque, NM MSA", county: "Torrance", state: "NM", fullCountyName: "Torrance County", productTypes: ["Active Adult"] },
  
  // Boise, ID MSA
  { msaName: "Boise, ID MSA", county: "Ada", state: "ID", fullCountyName: "Ada County", productTypes: ["Active Adult"] },
  { msaName: "Boise, ID MSA", county: "Canyon", state: "ID", fullCountyName: "Canyon County", productTypes: ["Active Adult"] },
  { msaName: "Boise, ID MSA", county: "Boise", state: "ID", fullCountyName: "Boise County", productTypes: ["Active Adult"] },
  { msaName: "Boise, ID MSA", county: "Gem", state: "ID", fullCountyName: "Gem County", productTypes: ["Active Adult"] },
  { msaName: "Boise, ID MSA", county: "Owyhee", state: "ID", fullCountyName: "Owyhee County", productTypes: ["Active Adult"] },
  
  // Des Moines, IA MSA
  { msaName: "Des Moines, IA MSA", county: "Polk", state: "IA", fullCountyName: "Polk County", productTypes: ["Active Adult"] },
  { msaName: "Des Moines, IA MSA", county: "Dallas", state: "IA", fullCountyName: "Dallas County", productTypes: ["Active Adult"] },
  { msaName: "Des Moines, IA MSA", county: "Warren", state: "IA", fullCountyName: "Warren County", productTypes: ["Active Adult"] },
  { msaName: "Des Moines, IA MSA", county: "Madison", state: "IA", fullCountyName: "Madison County", productTypes: ["Active Adult"] },
  
  // Omaha, NE MSA
  { msaName: "Omaha, NE MSA", county: "Douglas", state: "NE", fullCountyName: "Douglas County, NE", productTypes: ["Active Adult"] },
  { msaName: "Omaha, NE MSA", county: "Sarpy", state: "NE", fullCountyName: "Sarpy County, NE", productTypes: ["Active Adult"] },
  { msaName: "Omaha, NE MSA", county: "Washington", state: "NE", fullCountyName: "Washington County, NE", productTypes: ["Active Adult"] },
  { msaName: "Omaha, NE MSA", county: "Cass", state: "NE", fullCountyName: "Cass County, NE", productTypes: ["Active Adult"] },
  { msaName: "Omaha, NE MSA", county: "Pottawattamie", state: "IA", fullCountyName: "Pottawattamie County, IA", productTypes: ["Active Adult"] },
  
  // Grand Rapids, MI MSA
  { msaName: "Grand Rapids, MI MSA", county: "Kent", state: "MI", fullCountyName: "Kent County", productTypes: ["Active Adult"] },
  { msaName: "Grand Rapids, MI MSA", county: "Ottawa", state: "MI", fullCountyName: "Ottawa County", productTypes: ["Active Adult"] },
  { msaName: "Grand Rapids, MI MSA", county: "Allegan", state: "MI", fullCountyName: "Allegan County", productTypes: ["Active Adult"] },
  
  // New Orleans, LA MSA
  { msaName: "New Orleans, LA MSA", county: "Orleans Parish", state: "LA", fullCountyName: "Orleans Parish", productTypes: ["Active Adult"] },
  { msaName: "New Orleans, LA MSA", county: "Jefferson Parish", state: "LA", fullCountyName: "Jefferson Parish", productTypes: ["Active Adult"] },
  { msaName: "New Orleans, LA MSA", county: "St. Tammany Parish", state: "LA", fullCountyName: "St. Tammany Parish", productTypes: ["Active Adult"] },
  { msaName: "New Orleans, LA MSA", county: "St. Bernard Parish", state: "LA", fullCountyName: "St. Bernard Parish", productTypes: ["Active Adult"] },
  { msaName: "New Orleans, LA MSA", county: "Plaquemines Parish", state: "LA", fullCountyName: "Plaquemines Parish", productTypes: ["Active Adult"] },
  
  // Buffalo, NY MSA
  { msaName: "Buffalo, NY MSA", county: "Erie", state: "NY", fullCountyName: "Erie County", productTypes: ["Active Adult"] },
  { msaName: "Buffalo, NY MSA", county: "Niagara", state: "NY", fullCountyName: "Niagara County", productTypes: ["Active Adult"] },
  
  // Rochester, NY MSA
  { msaName: "Rochester, NY MSA", county: "Monroe", state: "NY", fullCountyName: "Monroe County", productTypes: ["Active Adult"] },
  { msaName: "Rochester, NY MSA", county: "Ontario", state: "NY", fullCountyName: "Ontario County", productTypes: ["Active Adult"] },
  { msaName: "Rochester, NY MSA", county: "Wayne", state: "NY", fullCountyName: "Wayne County", productTypes: ["Active Adult"] },
  { msaName: "Rochester, NY MSA", county: "Livingston", state: "NY", fullCountyName: "Livingston County", productTypes: ["Active Adult"] },
  
  // Tucson, AZ MSA
  { msaName: "Tucson, AZ MSA", county: "Pima", state: "AZ", fullCountyName: "Pima County", productTypes: ["Active Adult"] },
  
  // Fresno, CA MSA
  { msaName: "Fresno, CA MSA", county: "Fresno", state: "CA", fullCountyName: "Fresno County", productTypes: ["Active Adult"] },
  { msaName: "Fresno, CA MSA", county: "Madera", state: "CA", fullCountyName: "Madera County", productTypes: ["Active Adult"] },
];

export async function seedAcquisitionMarkets() {
  console.log("🌱 Starting acquisition markets seed...");
  
  try {
    // Clear existing data
    await db.execute(sql`TRUNCATE TABLE acquisition_markets CASCADE`);
    console.log("✅ Cleared existing acquisition markets");
    
    // Insert all market data
    for (const market of marketData) {
      await db.insert(acquisitionMarkets).values(market);
    }
    
    console.log(`✅ Seeded ${marketData.length} acquisition market entries`);
    
    // Show summary by product type
    const summary: Record<string, number> = {};
    for (const market of marketData) {
      for (const productType of market.productTypes) {
        summary[productType] = (summary[productType] || 0) + 1;
      }
    }
    
    console.log("\n📊 Market Summary by Product Type:");
    for (const [productType, count] of Object.entries(summary)) {
      console.log(`   ${productType}: ${count} counties`);
    }
    
    return { success: true, count: marketData.length, summary };
  } catch (error) {
    console.error("❌ Error seeding acquisition markets:", error);
    throw error;
  }
}

// Auto-run when imported
seedAcquisitionMarkets()
  .then(() => {
    console.log("\n✅ Seed completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  });
