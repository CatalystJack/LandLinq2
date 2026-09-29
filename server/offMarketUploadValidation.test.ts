import assert from "node:assert/strict";
import { test } from "node:test";
import { Buffer } from "buffer";
import {
  OFF_MARKET_MAX_IMPORT_ROWS,
  OFF_MARKET_MAX_UPLOAD_BYTES,
  getOffMarketFileExtension,
  isOffMarketFileNameAllowed,
} from "../shared/off-market-upload";
import { validateOffMarketFileContents } from "./offMarketUploadValidation";

test("off-market uploads allow only CSV, XLS, and XLSX extensions", () => {
  for (const filename of ["owners.csv", "Owners.XLS", "C:\\exports\\owners.xlsx"]) {
    assert.equal(isOffMarketFileNameAllowed(filename), true);
  }
  for (const filename of ["owners.pdf", "owners.csv.exe", "owners", ".xlsx"]) {
    assert.equal(isOffMarketFileNameAllowed(filename), false);
  }
  assert.equal(getOffMarketFileExtension("C:\\exports\\Owners.XLSX"), ".xlsx");
});

test("off-market upload limits are shared with the client", () => {
  assert.equal(OFF_MARKET_MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
  assert.equal(OFF_MARKET_MAX_IMPORT_ROWS, 20_000);
});

test("server validates spreadsheet signatures and rejects binary files renamed as CSV", () => {
  assert.equal(validateOffMarketFileContents({
    originalname: "owners.xlsx",
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]),
  }), null);
  assert.equal(validateOffMarketFileContents({
    originalname: "owners.xls",
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  }), null);
  assert.equal(validateOffMarketFileContents({
    originalname: "owners.csv",
    buffer: Buffer.from("owner_name,city\nSample Owner,Charlotte\n"),
  }), null);
  assert.match(validateOffMarketFileContents({
    originalname: "owners.xlsx",
    buffer: Buffer.from("%PDF-1.7"),
  }) || "", /do not match an XLSX/);
  assert.match(validateOffMarketFileContents({
    originalname: "owners.csv",
    buffer: Buffer.from("%PDF-1.7"),
  }) || "", /CSV text file/);
});