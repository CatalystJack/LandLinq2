import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Upload, File, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onUploadComplete?: (urls: string[]) => void;
  buttonClassName?: string;
  children?: ReactNode;
  acceptedTypes?: string[];
}

/**
 * File upload component for deal documents
 */
export function ObjectUploader({
  maxNumberOfFiles = 5,
  maxFileSize = 10485760, // 10MB default
  onUploadComplete,
  buttonClassName,
  children,
  acceptedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".xls", ".xlsx"]
}: ObjectUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file count
    if (files.length > maxNumberOfFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxNumberOfFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    const oversizedFiles = files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${(maxFileSize / 1048576).toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of selectedFiles) {
        // Get presigned upload URL
        const response = await fetch("/api/objects/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadURL } = await response.json();

        // Upload file with FormData
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const uploadResult = await uploadResponse.json();
        uploadedUrls.push(uploadResult.url);
      }

      setUploadedUrls(uploadedUrls);
      onUploadComplete?.(uploadedUrls);
      setSelectedFiles([]);

      toast({
        title: "Upload successful",
        description: `${uploadedUrls.length} file(s) uploaded successfully`,
      });

    } catch (error) {
      // console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Button
          type="button"
          variant="outline"
          className={`w-full h-24 border-dashed border-2 hover:border-catalyst-gold ${buttonClassName}`}
          disabled={uploading}
          onClick={openFileSelector}
          data-testid="button-file-select"
        >
          {children || (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6" />
              <span>Click to select files or drag and drop</span>
              <span className="text-sm text-muted-foreground text-center break-words max-w-full overflow-hidden">
                <span className="block sm:inline">{acceptedTypes.join(", ")}</span>
                <span className="block sm:inline sm:ml-1">(max {(maxFileSize / 1048576).toFixed(1)}MB)</span>
              </span>
            </div>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file-upload"
        />
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Selected Files:</h4>
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 border rounded-lg"
              data-testid={`selected-file-${index}`}
            >
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1048576).toFixed(1)}MB)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                data-testid={`button-remove-file-${index}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="w-full"
            data-testid="button-upload-files"
          >
            {uploading ? "Uploading..." : `Upload ${selectedFiles.length} file(s)`}
          </Button>
        </div>
      )}

      {/* Uploaded files list */}
      {uploadedUrls.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-green-600">Uploaded Files:</h4>
          {uploadedUrls.map((url, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded"
              data-testid={`uploaded-file-${index}`}
            >
              <File className="h-4 w-4 text-green-600" />
              <span className="text-sm">File {index + 1} uploaded successfully</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}