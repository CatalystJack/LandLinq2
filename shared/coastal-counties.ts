// NOAA ENOW coastal county footprint for the three states used by YOC
// insurance pricing. The NOAA list includes the marked inland watershed
// counties, which remain eligible for analyst overrides at the deal level.
const COASTAL_COUNTIES_BY_STATE: Record<string, ReadonlySet<string>> = {
  NC: new Set([
    "BEAUFORT",
    "BERTIE",
    "BRUNSWICK",
    "CAMDEN",
    "CARTERET",
    "CHOWAN",
    "CRAVEN",
    "CURRITUCK",
    "DARE",
    "GATES",
    "HERTFORD",
    "HYDE",
    "NEW HANOVER",
    "ONSLOW",
    "PAMLICO",
    "PASQUOTANK",
    "PENDER",
    "PERQUIMANS",
    "TYRRELL",
    "WASHINGTON",
  ]),
  SC: new Set([
    "BEAUFORT",
    "BERKELEY",
    "CHARLESTON",
    "COLLETON",
    "DORCHESTER",
    "GEORGETOWN",
    "HORRY",
    "JASPER",
  ]),
  GA: new Set([
    "BRANTLEY",
    "BRYAN",
    "CAMDEN",
    "CHARLTON",
    "CHATHAM",
    "GLYNN",
    "LIBERTY",
    "MCINTOSH",
    "WAYNE",
  ]),
};

const COASTAL_STATES = new Set(["FL", "SC"]);

export function normalizeCountyName(county: unknown): string {
  return String(county || "")
    .trim()
    .replace(/\s+COUNTY$/i, "")
    .trim()
    .toUpperCase();
}

export function isAutomaticallyCoastal(state: unknown, county: unknown): boolean {
  const stateKey = String(state || "").trim().toUpperCase();
  if (COASTAL_STATES.has(stateKey)) return true;

  const counties = COASTAL_COUNTIES_BY_STATE[stateKey];
  return counties ? counties.has(normalizeCountyName(county)) : false;
}

export { COASTAL_COUNTIES_BY_STATE, COASTAL_STATES };