import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trackMapUsage } from "@/lib/map-tiles";

interface StreetViewImage {
  id: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  capturedAt: string | null;
  compassAngle: number | null;
  distanceMeters: number;
}

interface StreetViewResponse {
  configured: boolean;
  images: StreetViewImage[];
  radiusMeters: number;
  viewerToken?: string;
  message?: string;
}

interface StreetViewPanelProps {
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
}

export function StreetViewPanel({
  latitude,
  longitude,
  radiusMeters = 100,
}: StreetViewPanelProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [result, setResult] = useState<StreetViewResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    if (!hasCoordinates) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setSelectedIndex(0);
    fetch(`/api/mapillary/images?lat=${latitude}&lng=${longitude}&radius=${radiusMeters}`, {
      credentials: "include",
    })
      .then(async response => {
        if (!response.ok) throw new Error("Mapillary search failed");
        return response.json() as Promise<StreetViewResponse>;
      })
      .then(data => {
        if (!cancelled) setResult(data);
      })
      .catch(error => {
        if (!cancelled) {
          setResult({
            configured: true,
            images: [],
            radiusMeters,
            message: error instanceof Error ? error.message : "Mapillary search failed",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.remove?.();
        viewerRef.current = null;
      }
    };
  }, [latitude, longitude, radiusMeters, hasCoordinates]);

  const image = result?.images[selectedIndex];

  useEffect(() => {
    if (!image || !result?.viewerToken || !viewerContainerRef.current) return;
    let cancelled = false;

    import("mapillary-js").then(({ Viewer }) => {
      if (cancelled || !viewerContainerRef.current) return;
      viewerRef.current?.remove?.();
      viewerRef.current = new Viewer({
        accessToken: result.viewerToken,
        container: viewerContainerRef.current,
        imageId: image.id,
      });
      trackMapUsage("Mapillary", "viewer", true);
    }).catch(error => {
      console.warn("[MAPILLARY] Viewer failed to initialize:", error);
    });

    return () => {
      cancelled = true;
      viewerRef.current?.remove?.();
      viewerRef.current = null;
    };
  }, [image?.id, result?.viewerToken]);

  if (!hasCoordinates) return null;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <Navigation className="h-4 w-4 text-blue-600" />
          Street-level imagery
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-56 items-center justify-center gap-2 rounded-lg bg-slate-50 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching within {radiusMeters} meters...
          </div>
        ) : !result?.configured ? (
          <div className="flex h-56 items-center justify-center rounded-lg bg-slate-50 px-6 text-center text-sm text-slate-500">
            Street-level imagery is not configured for this workspace.
          </div>
        ) : !image ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 px-6 text-center text-sm text-slate-500">
            <ImageOff className="h-6 w-6 text-slate-400" />
            <span>No street-level imagery available for this location</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              ref={viewerContainerRef}
              className="h-64 overflow-hidden rounded-lg bg-slate-100"
            >
              {!result.viewerToken && (
                <img
                  src={image.imageUrl}
                  alt="Mapillary street-level imagery"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {image.distanceMeters}m away
                {image.capturedAt ? ` · ${new Date(image.capturedAt).toLocaleDateString()}` : ""}
              </p>
              {result.images.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSelectedIndex(index => (
                      index === 0 ? result.images.length - 1 : index - 1
                    ))}
                    aria-label="Previous street image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-12 text-center text-xs text-slate-500">
                    {selectedIndex + 1} / {result.images.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSelectedIndex(index => (
                      (index + 1) % result.images.length
                    ))}
                    aria-label="Next street image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}