import { isUsStateCode, normalizeUsStateCode } from "./us-states";

const OUT_OF_STATE_COUNTY = /^out of state\s*\(([a-z]{2})\)$/i;

export function getOutOfStateCodeFromCounty(value: unknown): string | null {
  const match = String(value ?? "").trim().match(OUT_OF_STATE_COUNTY);
  if (!match) return null;

  const stateCode = normalizeUsStateCode(match[1]);
  return isUsStateCode(stateCode) ? stateCode : null;
}

export function getBrokerStateCodes(stateRegion: unknown, contactCounty: unknown): string[] {
  const states = String(stateRegion ?? "")
    .split(",")
    .map((value) => normalizeUsStateCode(value))
    .filter(Boolean);
  const outOfStateCode = getOutOfStateCodeFromCounty(contactCounty);
  if (outOfStateCode) states.push(outOfStateCode);
  return Array.from(new Set(states));
}