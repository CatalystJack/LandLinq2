export const OFF_MARKET_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const OFF_MARKET_MAX_IMPORT_ROWS = 20_000;
export const OFF_MARKET_ALLOWED_FILE_EXTENSIONS = [".csv", ".xls", ".xlsx"] as const;

export function getOffMarketFileExtension(filename: string): string {
  const baseName = filename.split(/[\\/]/).pop() || "";
  const extensionIndex = baseName.lastIndexOf(".");
  return extensionIndex > 0 ? baseName.slice(extensionIndex).toLowerCase() : "";
}

export function isOffMarketFileNameAllowed(filename: string): boolean {
  return OFF_MARKET_ALLOWED_FILE_EXTENSIONS.includes(
    getOffMarketFileExtension(filename) as typeof OFF_MARKET_ALLOWED_FILE_EXTENSIONS[number],
  );
}