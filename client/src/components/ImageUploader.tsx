import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, File, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

interface ImageUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onUploadComplete?: (urls: string[]) => void;
  buttonClassName?: string;
}

/**
 * Enhanced image upload component with camera capture support
 */
export function ImageUploader({
  maxNumberOfFiles = 5,
  maxFileSize = 10485760, // 10MB default
  onUploadComplete,
  buttonClassName,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    addFiles(files);
  };

  const addFiles = (files: File[]) => {
    // Validate file count
    const totalFiles = selectedFiles.length + files.length;
    if (totalFiles > maxNumberOfFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxNumberOfFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    // Validate file size and type
    const oversizedFiles = files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${(maxFileSize / 1048576).toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }

    // Filter for image files only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length < files.length) {
      toast({
        title: "Invalid file type",
        description: "Only image files are supported",
        variant: "destructive",
      });
    }

    setSelectedFiles(prev => [...prev, ...imageFiles]);
    
    // Create preview URLs for images
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setCapturedImages(prev => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
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

      setUploadedUrls(prev => [...prev, ...uploadedUrls]);
      onUploadComplete?.(uploadedUrls);
      setSelectedFiles([]);
      setCapturedImages([]);

      toast({
        title: "Upload successful",
        description: `${uploadedUrls.length} image(s) uploaded successfully`,
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
    setCapturedImages(images => images.filter((_, i) => i !== index));
  };

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className={`h-20 border-dashed border-2 hover:border-catalyst-gold ${buttonClassName}`}
          disabled={uploading}
          onClick={openFileSelector}
          data-testid="button-select-images"
        >
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-5 w-5" />
            <span className="text-sm">Choose Images</span>
          </div>
        </Button>

        <Button
          type="button"
          variant="outline"
          className={`h-20 border-dashed border-2 hover:border-catalyst-gold ${buttonClassName}`}
          disabled={uploading}
          onClick={handleCameraCapture}
          data-testid="button-camera-capture"
        >
          <div className="flex flex-col items-center gap-2">
            <Camera className="h-5 w-5" />
            <span className="text-sm">Take Photo</span>
          </div>
        </Button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-upload"
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-camera-capture"
      />

      {/* Selected images preview */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Selected Images ({selectedFiles.length})
          </h4>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {capturedImages.map((imageUrl, index) => (
              <Card key={index} className="relative overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={imageUrl}
                    alt={`Selected image ${index + 1}`}
                    className="w-full h-24 object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-white hover:text-red-400"
                      data-testid={`button-remove-image-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
                    {(selectedFiles[index]?.size / 1048576).toFixed(1)}MB
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="w-full bg-catalyst-gold text-white hover:bg-white hover:text-catalyst-gold border-2 border-catalyst-gold hover:border-catalyst-gold transition-all duration-300"
            data-testid="button-upload-images"
          >
            {uploading ? "Uploading..." : `Upload ${selectedFiles.length} Image(s)`}
          </Button>
        </div>
      )}

      {/* Uploaded images list */}
      {uploadedUrls.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-green-600 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Uploaded Images ({uploadedUrls.length})
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {uploadedUrls.map((url, index) => (
              <div
                key={index}
                className="aspect-square bg-green-50 border border-green-200 rounded flex items-center justify-center"
                data-testid={`uploaded-image-${index}`}
              >
                <ImageIcon className="h-6 w-6 text-green-600" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}