import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Object storage client for file uploads
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Object storage service for deal file uploads
export class ObjectStorageService {
  constructor() {}

  // Gets the private object directory for file uploads
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Object storage not configured."
      );
    }
    return dir;
  }

  // Gets the public object directory for public assets (logos, etc)
  getPublicObjectDir(): string {
    const searchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    if (!searchPaths) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Object storage not configured."
      );
    }
    // Handle both JSON array format and plain string format
    try {
      const paths = JSON.parse(searchPaths);
      return paths[0] || "";
    } catch {
      // If not JSON, treat as plain string path
      return searchPaths;
    }
  }

  // Gets upload URL for deal files - USE EXACT ORIGINAL FILENAME (Dec 11, 2025)
  // User requirement: Files must show exact original filename, not UUID prefix
  async getUploadURL(originalFilename?: string): Promise<{ uploadURL: string; objectPath: string }> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    
    // USER FIX: Use EXACT original filename without UUID prefix
    // Add timestamp suffix ONLY if no extension, to ensure uniqueness
    let fileName: string;
    if (originalFilename) {
      // Sanitize: keep alphanumeric, dots, hyphens, underscores, spaces
      const sanitized = originalFilename.replace(/[^a-zA-Z0-9._ -]/g, '_');
      
      // Add small timestamp to ensure uniqueness (but filename stays readable)
      const timestamp = Date.now().toString(36); // Short alphanumeric timestamp
      const ext = sanitized.includes('.') ? sanitized.slice(sanitized.lastIndexOf('.')) : '';
      const baseName = sanitized.includes('.') ? sanitized.slice(0, sanitized.lastIndexOf('.')) : sanitized;
      
      // Format: "Investment Profile_abc123.pdf" - keeps name readable, ensures uniqueness
      fileName = `${baseName}_${timestamp}${ext}`;
    } else {
      fileName = objectId;
    }
    
    const fullPath = `${privateObjectDir}/deals/${fileName}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
    });

    return {
      uploadURL,
      objectPath: fullPath
    };
  }

  // Download object file
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on("error", (err: any) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Get file from object path
  async getObjectFile(objectPath: string): Promise<File> {
    const { bucketName, objectName } = parseObjectPath(objectPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  // Get file content as Buffer (for email attachments)
  async getFileAsBuffer(objectPath: string): Promise<Buffer> {
    // Handle full URLs from the database (e.g., https://catalyst.landlinq.ai/api/private/storage/.private/...)
    let cleanPath = objectPath;
    if (objectPath.includes('/api/private/storage/')) {
      cleanPath = objectPath.split('/api/private/storage/')[1];
      console.log(`📎 [STORAGE] Extracted path from URL: ${cleanPath}`);
    }
    
    // Handle relative paths that start with / or .private/
    let fullPath = cleanPath;
    if (cleanPath.startsWith('.private/') || cleanPath.startsWith('/.private/')) {
      const privateObjectDir = this.getPrivateObjectDir();
      const relativePath = cleanPath.replace(/^\.?\/?\.private\//, '');
      fullPath = `${privateObjectDir}/${relativePath}`;
    }
    
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    
    // Download file content
    const [buffer] = await objectFile.download();
    return buffer;
  }

  // Upload email attachment to object storage
  async uploadAttachment(
    buffer: Buffer,
    filename: string,
    contentType: string,
    dealId: string
  ): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fileExtension = filename.split('.').pop() || 'bin';
    const objectId = randomUUID();
    const storedFilename = `${objectId}.${fileExtension}`;
    const fullPath = `${privateObjectDir}/deals/${dealId}/attachments/${storedFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      metadata: {
        contentType: contentType || 'application/octet-stream',
        metadata: {
          originalFilename: filename,
          dealId: dealId,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    console.log(`✅ Uploaded attachment: ${filename} → ${fullPath}`);
    return fullPath;
  }

  // Get public download URL for an attachment
  async getAttachmentDownloadURL(objectPath: string): Promise<string> {
    const { bucketName, objectName } = parseObjectPath(objectPath);
    
    return signObjectURL({
      bucketName,
      objectName,
      method: "GET",
      ttlSec: 3600, // 1 hour
    });
  }

  // Upload an attachment during email intake (before a deal exists)
  async uploadIntakeAttachment(
    buffer: Buffer,
    filename: string,
    contentType: string,
    intakeId: string
  ): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fileExtension = filename.split('.').pop() || 'bin';
    const objectId = randomUUID();
    const storedFilename = `${objectId}.${fileExtension}`;
    const fullPath = `${privateObjectDir}/email-intake/${intakeId}/${storedFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      metadata: {
        contentType: contentType || 'application/octet-stream',
        metadata: {
          originalFilename: filename,
          intakeId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`✅ [INTAKE] Stored attachment: ${filename} → ${fullPath}`);
    return fullPath;
  }

  // Upload public asset (logos, etc) to public object storage
  async uploadPublicAsset(
    buffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    const publicObjectDir = this.getPublicObjectDir();
    const fullPath = `${publicObjectDir}/${filename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      metadata: {
        contentType: contentType || 'image/png',
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
      public: true // Make publicly accessible
    });

    console.log(`✅ Uploaded public asset: ${filename} → ${fullPath}`);
    
    // Return public URL (works in emails)
    return `https://storage.googleapis.com/${bucketName}/${objectName}`;
  }
}

export function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}