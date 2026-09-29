import { Buffer } from "buffer";
import {
  getOffMarketFileExtension,
  isOffMarketFileNameAllowed,
} from "../shared/off-market-upload";

export function validateOffMarketFileContents(file: {
  originalname: string;
  buffer: Buffer;
}): string | null {
  if (!isOffMarketFileNameAllowed(file.originalname)) {
    return "Only CSV, XLS, and XLSX files are supported.";
  }
  if (file.originalname.length > 255) return "The filename must be 255 characters or fewer.";

  const extension = getOffMarketFileExtension(file.originalname);
  const signature = file.buffer.subarray(0, 8);
  if (
    extension === ".xlsx" &&
    !(signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 0x03 && signature[3] === 0x04)
  ) {
    return "The file contents do not match an XLSX workbook.";
  }
  if (
    extension === ".xls" &&
    !signature.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  ) {
    return "The file contents do not match an XLS workbook.";
  }
  if (extension === ".csv") {
    const prefix = file.buffer.subarray(0, 8);
    const isUtf16 =
      (prefix[0] === 0xff && prefix[1] === 0xfe) ||
      (prefix[0] === 0xfe && prefix[1] === 0xff);
    const beginsWithKnownBinarySignature =
      (prefix[0] === 0x50 && prefix[1] === 0x4b) ||
      signature.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) ||
      file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    const sample = file.buffer.subarray(0, Math.min(file.buffer.length, 64 * 1024));
    if (beginsWithKnownBinarySignature || (!isUtf16 && sample.includes(0))) {
      return "The file contents do not appear to be a CSV text file.";
    }
  }
  return null;
}