import { db } from './server/db.js';
import { acquisitionMarkets } from './shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// Active Adult MSA data from PDF
const activeAdultCounties = [
  // New York MSA
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'New York', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Kings', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Queens', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Bronx', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Richmond', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Nassau', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Suffolk', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Westchester', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Rockland', state: 'NY' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Bergen', state: 'NJ' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Hudson', state: 'NJ' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Essex', state: 'NJ' },
  { msa: 'New York-Newark-Jersey City, NY-NJ-PA', county: 'Union', state: 'NJ' },
  
  // Dallas-Fort Worth MSA
  { msa: 'Dallas-Fort Worth-Arlington, TX', county: 'Dallas', state: 'TX' },
  { msa: 'Dallas-Fort Worth-Arlington, TX', county: 'Tarrant', state: 'TX' },
  { msa: 'Dallas-Fort Worth-Arlington, TX', county: 'Collin', state: 'TX' },
  { msa: 'Dallas-Fort Worth-Arlington, TX', county: 'Denton', state: 'TX' },
  { msa: 'Dallas-Fort Worth-Arlington, TX', county: 'Rockwall', state: 'TX' },
  { msa: 'Dallas-Fort Worth-Arlington, TX', county: 'Kaufman', state: 'TX' },
  
  // Los Angeles MSA
  { msa: 'Los Angeles-Long Beach-Anaheim, CA', county: 'Los Angeles', state: 'CA' },
  { msa: 'Los Angeles-Long Beach-Anaheim, CA', county: 'Orange', state: 'CA' },
  
  // Atlanta MSA - some overlap with existing BTR/Conventional
  { msa: 'Atlanta-Sandy Springs-Roswell, GA', county: 'Fulton', state: 'GA' },
  { msa: 'Atlanta-Sandy Springs-Roswell, GA', county: 'DeKalb', state: 'GA' },
  { msa: 'Atlanta-Sandy Springs-Roswell, GA', county: 'Cobb', state: 'GA' },
  { msa: 'Atlanta-Sandy Springs-Roswell, GA', county: 'Gwinnett', state: 'GA' },
  { msa: 'Atlanta-Sandy Springs-Roswell, GA', county: 'Clayton', state: 'GA' },
  { msa: 'Atlanta-Sandy Springs-Roswell, GA', county: 'Cherokee', state: 'GA' },
  { msa: 'Atlanta-Sandy Springs-Roswell, GA', county: 'Henry', state: 'GA' },
  
  // Chicago MSA
  { msa: 'Chicago-Naperville-Elgin, IL-IN-WI', county: 'Cook', state: 'IL' },
  { msa: 'Chicago-Naperville-Elgin, IL-IN-WI', county: 'DuPage', state: 'IL' },
  { msa: 'Chicago-Naperville-Elgin, IL-IN-WI', county: 'Lake', state: 'IL' },
  { msa: 'Chicago-Naperville-Elgin, IL-IN-WI', county: 'Will', state: 'IL' },
  { msa: 'Chicago-Naperville-Elgin, IL-IN-WI', county: 'Kane', state: 'IL' },
  
  // Houston MSA
  { msa: 'Houston-The Woodlands-Sugar Land, TX', county: 'Harris', state: 'TX' },
  { msa: 'Houston-The Woodlands-Sugar Land, TX', county: 'Fort Bend', state: 'TX' },
  { msa: 'Houston-The Woodlands-Sugar Land, TX', county: 'Montgomery', state: 'TX' },
  { msa: 'Houston-The Woodlands-Sugar Land, TX', county: 'Brazoria', state: 'TX' },
  
  // Washington D.C. MSA
  { msa: 'Washington-Arlington-Alexandria, DC-VA-MD-WV', county: 'District of Columbia', state: 'DC' },
  { msa: 'Washington-Arlington-Alexandria, DC-VA-MD-WV', county: 'Arlington', state: 'VA' },
  { msa: 'Washington-Arlington-Alexandria, DC-VA-MD-WV', county: 'Alexandria City', state: 'VA' },
  { msa: 'Washington-Arlington-Alexandria, DC-VA-MD-WV', county: 'Fairfax', state: 'VA' },
  { msa: 'Washington-Arlington-Alexandria, DC-VA-MD-WV', county: 'Montgomery', state: 'MD' },
  { msa: 'Washington-Arlington-Alexandria, DC-VA-MD-WV', county: 'Prince George\'s', state: 'MD' },
  
  // Miami MSA
  { msa: 'Miami-Fort Lauderdale-West Palm Beach, FL', county: 'Miami-Dade', state: 'FL' },
  { msa: 'Miami-Fort Lauderdale-West Palm Beach, FL', county: 'Broward', state: 'FL' },
  { msa: 'Miami-Fort Lauderdale-West Palm Beach, FL', county: 'Palm Beach', state: 'FL' },
  
  // Phoenix MSA
  { msa: 'Phoenix-Mesa-Scottsdale, AZ', county: 'Maricopa', state: 'AZ' },
  { msa: 'Phoenix-Mesa-Scottsdale, AZ', county: 'Pinal', state: 'AZ' },
  
  // Seattle MSA
  { msa: 'Seattle-Tacoma-Bellevue, WA', county: 'King', state: 'WA' },
  { msa: 'Seattle-Tacoma-Bellevue, WA', county: 'Snohomish', state: 'WA' },
  { msa: 'Seattle-Tacoma-Bellevue, WA', county: 'Pierce', state: 'WA' },
  
  // Denver MSA
  { msa: 'Denver-Aurora-Lakewood, CO', county: 'Denver', state: 'CO' },
  { msa: 'Denver-Aurora-Lakewood, CO', county: 'Arapahoe', state: 'CO' },
  { msa: 'Denver-Aurora-Lakewood, CO', county: 'Jefferson', state: 'CO' },
  { msa: 'Denver-Aurora-Lakewood, CO', county: 'Adams', state: 'CO' },
  { msa: 'Denver-Aurora-Lakewood, CO', county: 'Douglas', state: 'CO' },
  
  // San Diego MSA
  { msa: 'San Diego-Carlsbad, CA', county: 'San Diego', state: 'CA' },
  
  // Tampa MSA
  { msa: 'Tampa-St. Petersburg-Clearwater, FL', county: 'Hillsborough', state: 'FL' },
  { msa: 'Tampa-St. Petersburg-Clearwater, FL', county: 'Pinellas', state: 'FL' },
  { msa: 'Tampa-St. Petersburg-Clearwater, FL', county: 'Pasco', state: 'FL' },
  { msa: 'Tampa-St. Petersburg-Clearwater, FL', county: 'Hernando', state: 'FL' },
  
  // Orlando MSA
  { msa: 'Orlando-Kissimmee-Sanford, FL', county: 'Orange', state: 'FL' },
  { msa: 'Orlando-Kissimmee-Sanford, FL', county: 'Seminole', state: 'FL' },
  { msa: 'Orlando-Kissimmee-Sanford, FL', county: 'Osceola', state: 'FL' },
  { msa: 'Orlando-Kissimmee-Sanford, FL', county: 'Lake', state: 'FL' },
  
  // Charlotte MSA - overlaps with existing
  { msa: 'Charlotte-Concord-Gastonia, NC-SC', county: 'Mecklenburg', state: 'NC' },
  { msa: 'Charlotte-Concord-Gastonia, NC-SC', county: 'Union', state: 'NC' },
  { msa: 'Charlotte-Concord-Gastonia, NC-SC', county: 'Cabarrus', state: 'NC' },
  { msa: 'Charlotte-Concord-Gastonia, NC-SC', county: 'Gaston', state: 'NC' },
  { msa: 'Charlotte-Concord-Gastonia, NC-SC', county: 'York', state: 'SC' },
  
  // Raleigh-Durham MSA - overlaps with existing
  { msa: 'Raleigh-Durham-Chapel Hill, NC', county: 'Wake', state: 'NC' },
  { msa: 'Raleigh-Durham-Chapel Hill, NC', county: 'Durham', state: 'NC' },
  { msa: 'Raleigh-Durham-Chapel Hill, NC', county: 'Orange', state: 'NC' },
  { msa: 'Raleigh-Durham-Chapel Hill, NC', county: 'Johnston', state: 'NC' },
  
  // Charleston MSA - overlaps with existing
  { msa: 'Charleston-North Charleston, SC', county: 'Charleston', state: 'SC' },
  { msa: 'Charleston-North Charleston, SC', county: 'Berkeley', state: 'SC' },
  { msa: 'Charleston-North Charleston, SC', county: 'Dorchester', state: 'SC' },
  
  // Asheville MSA - overlaps with existing
  { msa: 'Asheville, NC', county: 'Buncombe', state: 'NC' },
  { msa: 'Asheville, NC', county: 'Henderson', state: 'NC' },
  { msa: 'Asheville, NC', county: 'Haywood', state: 'NC' },
  
  // Greenville MSA - overlaps with existing
  { msa: 'Greenville-Anderson, SC', county: 'Greenville', state: 'SC' },
  { msa: 'Greenville-Anderson, SC', county: 'Spartanburg', state: 'SC' },
  { msa: 'Greenville-Anderson, SC', county: 'Anderson', state: 'SC' },
  { msa: 'Greenville-Anderson, SC', county: 'Pickens', state: 'SC' },
  { msa: 'Greenville-Anderson, SC', county: 'Laurens', state: 'SC' },
  
  // Savannah MSA - overlaps with existing
  { msa: 'Savannah, GA', county: 'Chatham', state: 'GA' },
  { msa: 'Savannah, GA', county: 'Effingham', state: 'GA' },
  { msa: 'Savannah, GA', county: 'Bryan', state: 'GA' },
  
  // Nashville MSA - overlaps with existing
  { msa: 'Nashville-Davidson--Murfreesboro--Franklin, TN', county: 'Davidson', state: 'TN' },
  { msa: 'Nashville-Davidson--Murfreesboro--Franklin, TN', county: 'Williamson', state: 'TN' },
  { msa: 'Nashville-Davidson--Murfreesboro--Franklin, TN', county: 'Rutherford', state: 'TN' },
  { msa: 'Nashville-Davidson--Murfreesboro--Franklin, TN', county: 'Sumner', state: 'TN' },
  { msa: 'Nashville-Davidson--Murfreesboro--Franklin, TN', county: 'Wilson', state: 'TN' },
  
  // Chattanooga MSA - overlaps with existing
  { msa: 'Chattanooga, TN-GA', county: 'Hamilton', state: 'TN' },
  { msa: 'Chattanooga, TN-GA', county: 'Bradley', state: 'TN' },
  { msa: 'Chattanooga, TN-GA', county: 'Walker', state: 'GA' },
  { msa: 'Chattanooga, TN-GA', county: 'Catoosa', state: 'GA' },
  
  // Birmingham MSA - overlaps with existing
  { msa: 'Birmingham-Hoover, AL', county: 'Jefferson', state: 'AL' },
  { msa: 'Birmingham-Hoover, AL', county: 'Shelby', state: 'AL' },
  { msa: 'Birmingham-Hoover, AL', county: 'St. Clair', state: 'AL' },
  { msa: 'Birmingham-Hoover, AL', county: 'Blount', state: 'AL' },
  
  // Austin MSA
  { msa: 'Austin-Round Rock, TX', county: 'Travis', state: 'TX' },
  { msa: 'Austin-Round Rock, TX', county: 'Williamson', state: 'TX' },
  { msa: 'Austin-Round Rock, TX', county: 'Hays', state: 'TX' },
  
  // Huntsville MSA - overlaps with existing
  { msa: 'Huntsville, AL', county: 'Madison', state: 'AL' },
  { msa: 'Huntsville, AL', county: 'Limestone', state: 'AL' },
  
  // Richmond MSA
  { msa: 'Richmond, VA', county: 'Henrico', state: 'VA' },
  { msa: 'Richmond, VA', county: 'Chesterfield', state: 'VA' },
  { msa: 'Richmond, VA', county: 'Hanover', state: 'VA' },
  { msa: 'Richmond, VA', county: 'Richmond City', state: 'VA' },
  { msa: 'Richmond, VA', county: 'Goochland', state: 'VA' },
  
  // Sacramento MSA
  { msa: 'Sacramento--Roseville--Arden-Arcade, CA', county: 'Sacramento', state: 'CA' },
  { msa: 'Sacramento--Roseville--Arden-Arcade, CA', county: 'Placer', state: 'CA' },
  { msa: 'Sacramento--Roseville--Arden-Arcade, CA', county: 'El Dorado', state: 'CA' },
  { msa: 'Sacramento--Roseville--Arden-Arcade, CA', county: 'Yolo', state: 'CA' },
  
  // Columbus MSA
  { msa: 'Columbus, OH', county: 'Franklin', state: 'OH' },
  { msa: 'Columbus, OH', county: 'Delaware', state: 'OH' },
  { msa: 'Columbus, OH', county: 'Fairfield', state: 'OH' },
  { msa: 'Columbus, OH', county: 'Licking', state: 'OH' },
  { msa: 'Columbus, OH', county: 'Union', state: 'OH' },
  
  // Kansas City MSA
  { msa: 'Kansas City, MO-KS', county: 'Jackson', state: 'MO' },
  { msa: 'Kansas City, MO-KS', county: 'Clay', state: 'MO' },
  { msa: 'Kansas City, MO-KS', county: 'Platte', state: 'MO' },
  { msa: 'Kansas City, MO-KS', county: 'Cass', state: 'MO' },
  { msa: 'Kansas City, MO-KS', county: 'Johnson', state: 'KS' },
  { msa: 'Kansas City, MO-KS', county: 'Wyandotte', state: 'KS' },
  { msa: 'Kansas City, MO-KS', county: 'Leavenworth', state: 'KS' },
  
  // Jacksonville MSA
  { msa: 'Jacksonville, FL', county: 'Duval', state: 'FL' },
  { msa: 'Jacksonville, FL', county: 'Clay', state: 'FL' },
  { msa: 'Jacksonville, FL', county: 'St. Johns', state: 'FL' },
  { msa: 'Jacksonville, FL', county: 'Nassau', state: 'FL' },
  { msa: 'Jacksonville, FL', county: 'Baker', state: 'FL' },
  
  // Pittsburgh MSA
  { msa: 'Pittsburgh, PA', county: 'Allegheny', state: 'PA' },
  { msa: 'Pittsburgh, PA', county: 'Butler', state: 'PA' },
  { msa: 'Pittsburgh, PA', county: 'Washington', state: 'PA' },
  { msa: 'Pittsburgh, PA', county: 'Westmoreland', state: 'PA' },
  { msa: 'Pittsburgh, PA', county: 'Beaver', state: 'PA' },
  
  // Cincinnati MSA
  { msa: 'Cincinnati, OH-KY-IN', county: 'Hamilton', state: 'OH' },
  { msa: 'Cincinnati, OH-KY-IN', county: 'Butler', state: 'OH' },
  { msa: 'Cincinnati, OH-KY-IN', county: 'Warren', state: 'OH' },
  { msa: 'Cincinnati, OH-KY-IN', county: 'Clermont', state: 'OH' },
  { msa: 'Cincinnati, OH-KY-IN', county: 'Boone', state: 'KY' },
  { msa: 'Cincinnati, OH-KY-IN', county: 'Kenton', state: 'KY' },
  { msa: 'Cincinnati, OH-KY-IN', county: 'Campbell', state: 'KY' },
  
  // St. Louis MSA
  { msa: 'St. Louis, MO-IL', county: 'St. Louis', state: 'MO' },
  { msa: 'St. Louis, MO-IL', county: 'St. Charles', state: 'MO' },
  { msa: 'St. Louis, MO-IL', county: 'Jefferson', state: 'MO' },
  { msa: 'St. Louis, MO-IL', county: 'Franklin', state: 'MO' },
  { msa: 'St. Louis, MO-IL', county: 'St. Clair', state: 'IL' },
  { msa: 'St. Louis, MO-IL', county: 'Madison', state: 'IL' },
  
  // Oklahoma City MSA
  { msa: 'Oklahoma City, OK', county: 'Oklahoma', state: 'OK' },
  { msa: 'Oklahoma City, OK', county: 'Cleveland', state: 'OK' },
  { msa: 'Oklahoma City, OK', county: 'Canadian', state: 'OK' },
  { msa: 'Oklahoma City, OK', county: 'Logan', state: 'OK' },
  { msa: 'Oklahoma City, OK', county: 'Grady', state: 'OK' },
  
  // Louisville MSA
  { msa: 'Louisville/Jefferson County, KY-IN', county: 'Jefferson', state: 'KY' },
  { msa: 'Louisville/Jefferson County, KY-IN', county: 'Oldham', state: 'KY' },
  { msa: 'Louisville/Jefferson County, KY-IN', county: 'Bullitt', state: 'KY' },
  { msa: 'Louisville/Jefferson County, KY-IN', county: 'Shelby', state: 'KY' },
  { msa: 'Louisville/Jefferson County, KY-IN', county: 'Clark', state: 'IN' },
  { msa: 'Louisville/Jefferson County, KY-IN', county: 'Floyd', state: 'IN' },
  
  // Providence MSA
  { msa: 'Providence-Warwick, RI-MA', county: 'Providence', state: 'RI' },
  { msa: 'Providence-Warwick, RI-MA', county: 'Kent', state: 'RI' },
  { msa: 'Providence-Warwick, RI-MA', county: 'Washington', state: 'RI' },
  { msa: 'Providence-Warwick, RI-MA', county: 'Bristol', state: 'RI' },
  
  // Hartford MSA
  { msa: 'Hartford-West Hartford-East Hartford, CT', county: 'Hartford', state: 'CT' },
  { msa: 'Hartford-West Hartford-East Hartford, CT', county: 'Tolland', state: 'CT' },
  { msa: 'Hartford-West Hartford-East Hartford, CT', county: 'Middlesex', state: 'CT' },
  
  // Albuquerque MSA
  { msa: 'Albuquerque, NM', county: 'Bernalillo', state: 'NM' },
  { msa: 'Albuquerque, NM', county: 'Sandoval', state: 'NM' },
  { msa: 'Albuquerque, NM', county: 'Valencia', state: 'NM' },
  { msa: 'Albuquerque, NM', county: 'Torrance', state: 'NM' },
  
  // Boise MSA
  { msa: 'Boise City, ID', county: 'Ada', state: 'ID' },
  { msa: 'Boise City, ID', county: 'Canyon', state: 'ID' },
  { msa: 'Boise City, ID', county: 'Boise', state: 'ID' },
  { msa: 'Boise City, ID', county: 'Gem', state: 'ID' },
  { msa: 'Boise City, ID', county: 'Owyhee', state: 'ID' },
  
  // Des Moines MSA
  { msa: 'Des Moines-West Des Moines, IA', county: 'Polk', state: 'IA' },
  { msa: 'Des Moines-West Des Moines, IA', county: 'Dallas', state: 'IA' },
  { msa: 'Des Moines-West Des Moines, IA', county: 'Warren', state: 'IA' },
  { msa: 'Des Moines-West Des Moines, IA', county: 'Madison', state: 'IA' },
  
  // Omaha MSA
  { msa: 'Omaha-Council Bluffs, NE-IA', county: 'Douglas', state: 'NE' },
  { msa: 'Omaha-Council Bluffs, NE-IA', county: 'Sarpy', state: 'NE' },
  { msa: 'Omaha-Council Bluffs, NE-IA', county: 'Washington', state: 'NE' },
  { msa: 'Omaha-Council Bluffs, NE-IA', county: 'Cass', state: 'NE' },
  { msa: 'Omaha-Council Bluffs, NE-IA', county: 'Pottawattamie', state: 'IA' },
  
  // Grand Rapids MSA
  { msa: 'Grand Rapids-Wyoming, MI', county: 'Kent', state: 'MI' },
  { msa: 'Grand Rapids-Wyoming, MI', county: 'Ottawa', state: 'MI' },
  { msa: 'Grand Rapids-Wyoming, MI', county: 'Allegan', state: 'MI' },
  
  // New Orleans MSA
  { msa: 'New Orleans-Metairie, LA', county: 'Orleans', state: 'LA' },
  { msa: 'New Orleans-Metairie, LA', county: 'Jefferson', state: 'LA' },
  { msa: 'New Orleans-Metairie, LA', county: 'St. Tammany', state: 'LA' },
  { msa: 'New Orleans-Metairie, LA', county: 'St. Bernard', state: 'LA' },
  { msa: 'New Orleans-Metairie, LA', county: 'Plaquemines', state: 'LA' },
  
  // Buffalo MSA
  { msa: 'Buffalo-Cheektowaga-Niagara Falls, NY', county: 'Erie', state: 'NY' },
  { msa: 'Buffalo-Cheektowaga-Niagara Falls, NY', county: 'Niagara', state: 'NY' },
  
  // Rochester MSA
  { msa: 'Rochester, NY', county: 'Monroe', state: 'NY' },
  { msa: 'Rochester, NY', county: 'Ontario', state: 'NY' },
  { msa: 'Rochester, NY', county: 'Wayne', state: 'NY' },
  { msa: 'Rochester, NY', county: 'Livingston', state: 'NY' },
  
  // Tucson MSA
  { msa: 'Tucson, AZ', county: 'Pima', state: 'AZ' },
  
  // Fresno MSA
  { msa: 'Fresno, CA', county: 'Fresno', state: 'CA' },
  { msa: 'Fresno, CA', county: 'Madera', state: 'CA' },
];

async function loadActiveAdult() {
  console.log('🚀 Starting Active Adult MSA load...');
  console.log(`📊 Processing ${activeAdultCounties.length} counties...`);
  
  let updatedCount = 0;
  let insertedCount = 0;
  
  for (const { msa, county, state } of activeAdultCounties) {
    try {
      // Check if county already exists
      const existing = await db
        .select()
        .from(acquisitionMarkets)
        .where(and(
          eq(acquisitionMarkets.county, county),
          eq(acquisitionMarkets.state, state)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing - add Active Adult if not already there
        const currentTypes = existing[0].productTypes || [];
        if (!currentTypes.includes('Active Adult')) {
          await db
            .update(acquisitionMarkets)
            .set({
              productTypes: [...currentTypes, 'Active Adult'],
              updatedAt: new Date()
            })
            .where(eq(acquisitionMarkets.id, existing[0].id));
          updatedCount++;
          console.log(`  ✅ Updated ${county}, ${state} - added Active Adult`);
        }
      } else {
        // Insert new county with Active Adult
        await db
          .insert(acquisitionMarkets)
          .values({
            msaName: msa,
            county,
            state,
            productTypes: ['Active Adult'],
            isActive: true
          });
        insertedCount++;
        console.log(`  ✨ Inserted ${county}, ${state} - Active Adult`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${county}, ${state}:`, error);
    }
  }
  
  console.log(`\n🎉 Active Adult load complete!`);
  console.log(`  📊 ${insertedCount} new counties inserted`);
  console.log(`  🔄 ${updatedCount} existing counties updated`);
  console.log(`  🎯 Total processed: ${insertedCount + updatedCount}/${activeAdultCounties.length}`);
}

// Run the loader
loadActiveAdult()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
