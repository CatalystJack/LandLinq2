export function replaceBrokerCountyToken(
  content: string,
  county: unknown,
  escapeForHtml = false,
): string {
  const countyText = String(county ?? "").replace(/[\r\n]+/g, " ").trim();
  const replacement = escapeForHtml
    ? countyText.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] || character)
    : countyText;

  return content.replace(/\{\{(?:broker\.)?county\}\}/gi, () => replacement);
}
