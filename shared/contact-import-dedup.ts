export interface DuplicateContactImportRow {
  rowNumber: number;
  email: string;
}

export interface DeduplicatedContactImportRows<T> {
  rows: Array<{ row: T; rowNumber: number }>;
  duplicates: DuplicateContactImportRow[];
}

export function deduplicateContactImportRows<T extends { email?: unknown }>(
  rows: readonly T[],
): DeduplicatedContactImportRows<T> {
  const seenEmails = new Set<string>();
  const uniqueRows: DeduplicatedContactImportRows<T>["rows"] = [];
  const duplicates: DuplicateContactImportRow[] = [];

  rows.forEach((row, index) => {
    const email = String(row?.email ?? "").trim().toLowerCase();
    const rowNumber = index + 2;

    if (email && seenEmails.has(email)) {
      duplicates.push({ rowNumber, email });
      return;
    }

    if (email) seenEmails.add(email);
    uniqueRows.push({ row, rowNumber });
  });

  return { rows: uniqueRows, duplicates };
}