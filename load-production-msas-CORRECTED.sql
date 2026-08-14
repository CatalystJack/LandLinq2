-- Load 232 Acquisition Markets for Catalyst Capital Partners
-- CORRECTED VERSION with proper PostgreSQL array syntax
-- Run this in your Production database after publishing

INSERT INTO acquisition_markets (msa_name, county, state, full_county_name, city_note, product_types, is_active, latitude, longitude, notes) VALUES ('Birmingham, AL MSA', 'Blount', 'AL', 'Blount County, AL', NULL, ARRAY['Active Adult'], true, '33.9773580', '-86.5664400', NULL);
INSERT INTO acquisition_markets (msa_name, county, state, full_county_name, city_note, product_types, is_active, latitude, longitude, notes) VALUES ('Birmingham, AL MSA', 'Jefferson', 'AL', 'Jefferson County, AL', '(Birmingham)', ARRAY['Active Adult','BTR','Conventional Apartments'], true, '33.5534440', '-86.8965360', NULL);
INSERT INTO acquisition_markets (msa_name, county, state, full_county_name, city_note, product_types, is_active, latitude, longitude, notes) VALUES ('Birmingham, AL MSA', 'Shelby', 'AL', 'Shelby County, AL', '(Birmingham)', ARRAY['Active Adult','BTR','Conventional Apartments'], true, '33.2668930', '-86.6610070', NULL);
INSERT INTO acquisition_markets (msa_name, county, state, full_county_name, city_note, product_types, is_active, latitude, longitude, notes) VALUES ('Birmingham, AL MSA', 'St. Clair', 'AL', 'St. Clair County, AL', NULL, ARRAY['Active Adult'], true, '33.7194910', '-86.3113270', NULL);
INSERT INTO acquisition_markets (msa_name, county, state, full_county_name, city_note, product_types, is_active, latitude, longitude, notes) VALUES ('Huntsville, AL MSA', 'Limestone', 'AL', 'Limestone County, AL', NULL, ARRAY['Active Adult'], true, '34.8102390', '-86.9814000', NULL);
INSERT INTO acquisition_markets (msa_name, county, state, full_county_name, city_note, product_types, is_active, latitude, longitude, notes) VALUES ('Huntsville, AL MSA', 'Madison', 'AL', 'Madison County, AL', '(Huntsville)', ARRAY['Active Adult','BTR','Conventional Apartments'], true, '34.7642380', '-86.5510800', NULL);
