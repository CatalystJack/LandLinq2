import assert from "node:assert/strict";
import test from "node:test";
import { deduplicateContactImportRows } from "./contact-import-dedup";

test("keeps the first email occurrence in file order and reports later duplicates", () => {
  const input = [
    { firstName: "Rick", email: " RickCochran@KW.com " },
    { firstName: "No email", email: "" },
    { firstName: "Repeated Rick", email: "rickcochran@kw.com" },
    { firstName: "Alex", email: "alex@example.com" },
    { firstName: "Repeated Alex", email: "ALEX@example.com" },
  ];

  const result = deduplicateContactImportRows(input);

  assert.deepEqual(result.rows.map(({ row }) => row.firstName), ["Rick", "No email", "Alex"]);
  assert.deepEqual(result.duplicates, [
    { rowNumber: 4, email: "rickcochran@kw.com" },
    { rowNumber: 6, email: "alex@example.com" },
  ]);
});