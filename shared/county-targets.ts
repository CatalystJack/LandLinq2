import { normalizeUsStateCode } from "./us-states";

export function formatCountyTarget(county: string, state: string): string {
  const countyName = county.trim();
  if (!countyName) return "";

  const stateCode = normalizeUsStateCode(state);
  return stateCode ? `${countyName}, ${stateCode}` : countyName;
}

export function parseCountyTarget(raw: string): { county: string; state: string | null } {
  const commaIndex = raw.lastIndexOf(",");
  if (commaIndex === -1) {
    return { county: raw.trim(), state: null };
  }

  const county = raw.slice(0, commaIndex).trim();
  const state = raw.slice(commaIndex + 1).trim();
  return { county, state: state || null };
}

export function countyTargetMatchesDeal(
  target: string,
  dealCounty: string | null | undefined,
  dealState: string | null | undefined,
): boolean {
  const parsedTarget = parseCountyTarget(target);
  const targetCounty = parsedTarget.county.trim().toLowerCase();
  const candidateCounty = (dealCounty ?? "").trim().toLowerCase();

  if (!targetCounty || targetCounty !== candidateCounty) return false;
  if (!parsedTarget.state) return true;

  const targetState = normalizeUsStateCode(parsedTarget.state);
  const candidateState = normalizeUsStateCode(dealState);
  return Boolean(targetState && candidateState && targetState === candidateState);
}