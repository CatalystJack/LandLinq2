---
name: Multer multipart webhook handling
description: How SendGrid Inbound Parse delivers attachments and how multer splits the request
---

When SendGrid Inbound Parse (Send Raw OFF) POSTs an inbound email to the webhook:
- Text fields (from, to, subject, text, html, attachment-info, envelope) land in `req.body`
- Attachment files (attachment1, attachment2, …) land in `req.files` as multer File objects with `.buffer`, `.mimetype`, `.originalname`, `.fieldname`

**Why:** multer.any() (or multer.fields()) processes multipart/form-data and separates binary file parts from text parts. The binary parts never appear in `req.body`, so any handler that only reads `req.body` silently drops all attachments.

**How to apply:** Any webhook route using `emailWebhookUpload.any()` must forward `req.files` to downstream service methods. In `emailIntakeService.ts`, `processInboundEmail(rawBody, files)` and `parseAttachments(body, files)` now accept an optional `files` array and read attachment content from `file.buffer.toString('base64')`. The `req.files` array should be passed as `req.files || []` from the route handler.
