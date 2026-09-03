import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface BrokerSuggestion {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Plus, 
  MapPin,
  Loader2,
  Building,
  ChevronDown,
  ChevronUp,
  FileText,
  Upload,
  X,
  File
} from "lucide-react";
import { formatDealNumber } from "@shared/schema";

interface DealFormData {
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  parcelId: string; // County-specific APN/Parcel ID
  coordinates: string; // DMS or decimal coordinates (e.g., "28°44'56.3"N 81°52'54.4"W" or "28.7489, -81.8818")
  propertyName: string;
  askingPrice: string;
  sizeAcres: string;
  unitCount: string;
  yearBuilt: string; // For acquisition deals - vintage year
  sewerAvailable: boolean;
  zoningByRight: boolean;
  dealType: 'land' | 'acquisition'; // Land development or existing property acquisition
  productTypes: string[];
  analystNotes: string;
  brokerNotes: string;
  brokerName: string;
  brokerEmail: string;
  brokerPhone: string;
}

const US_STATES = [
  { abbr: 'AL', name: 'Alabama' }, { abbr: 'AK', name: 'Alaska' }, { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' }, { abbr: 'CA', name: 'California' }, { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' }, { abbr: 'DE', name: 'Delaware' }, { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' }, { abbr: 'HI', name: 'Hawaii' }, { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' }, { abbr: 'IN', name: 'Indiana' }, { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' }, { abbr: 'KY', name: 'Kentucky' }, { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' }, { abbr: 'MD', name: 'Maryland' }, { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' }, { abbr: 'MN', name: 'Minnesota' }, { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' }, { abbr: 'MT', name: 'Montana' }, { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' }, { abbr: 'NH', name: 'New Hampshire' }, { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' }, { abbr: 'NY', name: 'New York' }, { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' }, { abbr: 'OH', name: 'Ohio' }, { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' }, { abbr: 'PA', name: 'Pennsylvania' }, { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' }, { abbr: 'SD', name: 'South Dakota' }, { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' }, { abbr: 'UT', name: 'Utah' }, { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' }, { abbr: 'WA', name: 'Washington' }, { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' }, { abbr: 'WY', name: 'Wyoming' },
];

// Parse DMS (Degrees Minutes Seconds) coordinates to decimal
// Supports formats like: "28°44'56.3"N 81°52'54.4"W" or "28°44'56.3\"N, 81°52'54.4\"W"
function parseDMSCoordinates(input: string): { latitude: number; longitude: number } | null {
  // Clean up the input - normalize quotes and separators
  let cleaned = input.trim()
    .replace(/[""″]/g, '"')  // Normalize double quotes
    .replace(/[''′]/g, "'")  // Normalize single quotes
    .replace(/\s+/g, ' ');   // Normalize spaces
  
  // Try decimal format first (e.g., "28.7489, -81.8818" or "28.7489 -81.8818")
  const decimalMatch = cleaned.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (decimalMatch) {
    const lat = parseFloat(decimalMatch[1]);
    const lng = parseFloat(decimalMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }
  
  // Parse DMS format
  // Match pattern: degrees°minutes'seconds"direction
  const dmsPattern = /(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"\s*([NSns])\s*[,\s]+\s*(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"\s*([EWew])/;
  const dmsMatch = cleaned.match(dmsPattern);
  
  if (dmsMatch) {
    const latDeg = parseInt(dmsMatch[1]);
    const latMin = parseInt(dmsMatch[2]);
    const latSec = parseFloat(dmsMatch[3]);
    const latDir = dmsMatch[4].toUpperCase();
    
    const lngDeg = parseInt(dmsMatch[5]);
    const lngMin = parseInt(dmsMatch[6]);
    const lngSec = parseFloat(dmsMatch[7]);
    const lngDir = dmsMatch[8].toUpperCase();
    
    let latitude = latDeg + latMin / 60 + latSec / 3600;
    let longitude = lngDeg + lngMin / 60 + lngSec / 3600;
    
    if (latDir === 'S') latitude = -latitude;
    if (lngDir === 'W') longitude = -longitude;
    
    return { latitude, longitude };
  }
  
  return null;
}

interface QuickDealAdditionProps {
  defaultOpen?: boolean;
}

interface UploadedFile {
  file: File;
  objectPath: string;
  uploading: boolean;
  error?: string;
}

export default function QuickDealAddition({ defaultOpen = false }: QuickDealAdditionProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<DealFormData>({
    address: "",
    city: "",
    state: "",
    zip: "",
    county: "",
    parcelId: "",
    coordinates: "",
    propertyName: "",
    askingPrice: "",
    sizeAcres: "",
    unitCount: "",
    yearBuilt: "",
    sewerAvailable: false,
    zoningByRight: false,
    dealType: "land",
    productTypes: [],
    analystNotes: "",
    brokerNotes: "",
    brokerName: "",
    brokerEmail: "",
    brokerPhone: ""
  });
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [brokerSuggestions, setBrokerSuggestions] = useState<BrokerSuggestion[]>([]);
  const [showBrokerSuggestions, setShowBrokerSuggestions] = useState(false);
  const [brokerSearchLoading, setBrokerSearchLoading] = useState(false);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const brokerSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const brokerInputRef = useRef<HTMLDivElement>(null);

  // Debounced broker search
  const searchBrokers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setBrokerSuggestions([]);
      setShowBrokerSuggestions(false);
      return;
    }

    setBrokerSearchLoading(true);
    try {
      const res = await fetch(`/api/brokers/search?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const results = await res.json();
        setBrokerSuggestions(results);
        setShowBrokerSuggestions(results.length > 0);
      }
    } catch (error) {
      console.error('Error searching brokers:', error);
    } finally {
      setBrokerSearchLoading(false);
    }
  }, []);

  const handleBrokerNameChange = (value: string) => {
    updateFormData('brokerName', value);
    // Clear the pinned broker ID when user manually types — they may be switching brokers
    setSelectedBrokerId(null);
    
    // Clear existing timeout
    if (brokerSearchTimeout.current) {
      clearTimeout(brokerSearchTimeout.current);
    }
    
    // Debounce search by 300ms
    brokerSearchTimeout.current = setTimeout(() => {
      searchBrokers(value);
    }, 300);
  };

  const selectBroker = (broker: BrokerSuggestion) => {
    const fullName = `${broker.firstName || ''} ${broker.lastName || ''}`.trim();
    setFormData(prev => ({
      ...prev,
      brokerName: fullName,
      brokerEmail: broker.email || '',
      brokerPhone: broker.phone || ''
    }));
    // Pin the selected broker's ID so the backend links directly without guessing
    setSelectedBrokerId(broker.id);
    setShowBrokerSuggestions(false);
    setBrokerSuggestions([]);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (brokerInputRef.current && !brokerInputRef.current.contains(event.target as Node)) {
        setShowBrokerSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FIX (Dec 15, 2025): Support both OIDC auth (user.claims.email) and traditional auth (user.email)
  const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
  const isAnalyst = userEmail.includes('@catalystcp.com');
  const isSuperAdmin = userEmail === 'jack@catalystcp.com';
  
  if (!isAuthenticated || (!isAnalyst && !isSuperAdmin)) {
    return null;
  }

  const addDealMutation = useMutation({
    mutationFn: async (dealData: any) => {
      const res = await apiRequest('POST', '/api/analyst/deals', dealData);
      return res.json();
    },
    onSuccess: (newDeal: any) => {
      toast({
        title: "Deal Added Instantly",
        description: `Deal ${newDeal.dealNumber ? `#${formatDealNumber(newDeal.dealNumber)}` : ''} added to dashboard. HelloData analysis running in background...`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/analyst/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Deal",
        description: error.message || "Failed to create deal",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async () => {
    const hasAddress = formData.address.trim().length > 0;
    const hasCoordinates = formData.coordinates.trim().length > 0;
    const hasParcelId = formData.parcelId.trim().length > 0;
    
    // Must have either address, coordinates, OR parcel ID
    if (!hasAddress && !hasCoordinates && !hasParcelId) {
      toast({
        title: "Location Required",
        description: "Please enter a property address, coordinates, or Parcel ID / APN",
        variant: "destructive",
      });
      return;
    }
    
    // Parse coordinates if provided
    let parsedCoords: { latitude: number; longitude: number } | null = null;
    if (hasCoordinates) {
      parsedCoords = parseDMSCoordinates(formData.coordinates);
      if (!parsedCoords) {
        toast({
          title: "Invalid Coordinates",
          description: "Could not parse coordinates. Use format: 28°44'56.3\"N 81°52'54.4\"W or 28.7489, -81.8818",
          variant: "destructive",
        });
        return;
      }
    }
    
    let brokerData = null;
    if (selectedBrokerId || formData.brokerName.trim() || formData.brokerEmail.trim()) {
      brokerData = {
        // Pass the pinned broker ID so the backend links directly (no email/phone guessing)
        existingBrokerId: selectedBrokerId || null,
        firstName: formData.brokerName.trim().split(' ')[0] || 'Unknown',
        lastName: formData.brokerName.trim().split(' ').slice(1).join(' ') || 'Broker',
        email: formData.brokerEmail.trim() || null,
        phone: formData.brokerPhone.trim() || null,
        preferredContact: 'email'
      };
    }

    let parsedPrice = null;
    let parsedAcres = null;
    let parsedUnits = null;
    
    if (formData.askingPrice?.trim()) {
      const price = parseFloat(formData.askingPrice.replace(/[$,]/g, ''));
      if (!isNaN(price)) parsedPrice = price;
    }
    
    if (formData.sizeAcres?.trim()) {
      const acres = parseFloat(formData.sizeAcres.replace(/[,]/g, ''));
      if (!isNaN(acres)) parsedAcres = acres;
    }

    if (formData.unitCount?.trim()) {
      const units = parseInt(formData.unitCount.replace(/[,]/g, ''));
      if (!isNaN(units)) parsedUnits = units;
    }

    let parsedYearBuilt = null;
    if (formData.yearBuilt?.trim()) {
      const year = parseInt(formData.yearBuilt.replace(/[,]/g, ''));
      if (!isNaN(year) && year > 1800 && year <= new Date().getFullYear()) parsedYearBuilt = year;
    }

    const successfulUploads = uploadedFiles
      .filter(f => f.objectPath && !f.error)
      .map(f => f.objectPath);

    // Resolve address: use typed address, or coordinates placeholder, or parcel ID as identifier
    const addressToUse = hasAddress
      ? formData.address.trim()
      : hasCoordinates
        ? `Coordinates: ${parsedCoords?.latitude.toFixed(6)}, ${parsedCoords?.longitude.toFixed(6)}`
        : `Parcel ID: ${formData.parcelId.trim()}`;

    const dealData = {
      address: addressToUse,
      city: formData.city.trim() || null,
      state: formData.state.trim() || null,
      zip: formData.zip.trim() || null,
      county: formData.county.trim() || null,
      parcelId: formData.parcelId.trim() || null,
      propertyName: formData.propertyName.trim() || null,
      askingPrice: parsedPrice,
      sizeAcres: parsedAcres,
      unitCount: parsedUnits,
      yearBuilt: parsedYearBuilt,
      dealType: formData.dealType,
      sewerAvailable: formData.sewerAvailable,
      zoningByRight: formData.zoningByRight,
      productTypes: formData.productTypes.length > 0 ? formData.productTypes : null,
      analystNotes: formData.analystNotes.trim() || null,
      brokerNotes: formData.brokerNotes.trim() || null,
      status: 'pending_review',
      submissionMethod: 'analyst_quick_add',
      ...(brokerData && { brokerData }),
      ...(successfulUploads.length > 0 && { uploadedFiles: successfulUploads }),
      // Include parsed coordinates for direct use (skips geocoding)
      ...(parsedCoords && { 
        manualLatitude: parsedCoords.latitude,
        manualLongitude: parsedCoords.longitude,
        manualCoordsReason: 'Coordinates provided via Quick Add form'
      })
    };
    
    addDealMutation.mutate(dealData);
  };

  const updateFormData = (field: keyof DealFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      const uploadFile: UploadedFile = {
        file,
        objectPath: '',
        uploading: true
      };
      newFiles.push(uploadFile);
    }
    
    setUploadedFiles(prev => [...prev, ...newFiles]);

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i].file;
      try {
        // Use same API format as Deal Dashboard for consistency
        const urlRes = await fetch('/api/deals/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            filename: file.name, 
            contentType: file.type 
          })
        });
        
        if (!urlRes.ok) {
          throw new Error('Failed to get upload URL');
        }
        
        const { uploadURL, objectPath } = await urlRes.json();
        
        if (!uploadURL || !objectPath) {
          throw new Error('Failed to get upload URL');
        }
        
        const uploadRes = await fetch(uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });
        
        if (!uploadRes.ok) {
          throw new Error('Failed to upload file');
        }
        
        setUploadedFiles(prev => prev.map((f, idx) => 
          f.file === file ? { ...f, objectPath, uploading: false } : f
        ));
      } catch (error: any) {
        setUploadedFiles(prev => prev.map((f) => 
          f.file === file ? { ...f, uploading: false, error: error.message } : f
        ));
      }
    }
    
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({
      address: "",
      city: "",
      state: "",
      zip: "",
      county: "",
      parcelId: "",
      coordinates: "",
      propertyName: "",
      askingPrice: "",
      sizeAcres: "",
      unitCount: "",
      yearBuilt: "",
      sewerAvailable: false,
      zoningByRight: false,
      dealType: "land",
      productTypes: [],
      analystNotes: "",
      brokerNotes: "",
      brokerName: "",
      brokerEmail: "",
      brokerPhone: ""
    });
    setUploadedFiles([]);
    setSelectedBrokerId(null);
    setIsOpen(false);
  };

  return (
    <Card className="mb-6 border border-slate-200 bg-white shadow-md hover:shadow-lg transition-shadow duration-200" data-testid="card-quick-deal-addition">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-4 cursor-pointer hover:bg-slate-50 transition-colors duration-200">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-catalyst-navy text-white shadow-sm">
                  <Plus size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-800 font-semibold">Quick Deal Addition</span>
                  <span className="text-sm text-slate-500 font-normal">Rapid property entry for analysts</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronUp size={20} className="text-slate-600 transition-transform duration-200" />
                ) : (
                  <ChevronDown size={20} className="text-slate-600 transition-transform duration-200" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-4">
              {/* Property Address OR Coordinates */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-slate-100">
                    <MapPin size={14} className="text-catalyst-navy" />
                  </div>
                  Property Location {!formData.parcelId.trim() && <span className="text-red-500">*</span>}
                  <span className="text-xs text-slate-500 font-normal">
                    {formData.parcelId.trim() ? '(optional — Parcel ID provided)' : '(address OR coordinates)'}
                  </span>
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Street Address</label>
                    <Input
                      placeholder="123 Main St"
                      value={formData.address}
                      onChange={(e) => updateFormData('address', e.target.value)}
                      className="text-sm"
                      data-testid="input-deal-address"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-300" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-slate-50 px-2 text-slate-500">OR</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">
                      Coordinates <span className="text-slate-400">(DMS or decimal)</span>
                    </label>
                    <Input
                      placeholder={"28°44'56.3\"N 81°52'54.4\"W  or  28.7489, -81.8818"}
                      value={formData.coordinates}
                      onChange={(e) => updateFormData('coordinates', e.target.value)}
                      className="text-sm font-mono"
                      data-testid="input-deal-coordinates"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Copy from Google Maps or property documents
                    </p>
                  </div>
                </div>
              </div>

              {/* Location & Property Details */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-slate-100">
                    <Building size={14} className="text-catalyst-navy" />
                  </div>
                  Property Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">Parcel ID / APN</label>
                    <Input
                      placeholder="e.g., 123-45-678 (county-specific)"
                      value={formData.parcelId}
                      onChange={(e) => updateFormData('parcelId', e.target.value)}
                      className="text-sm"
                      data-testid="input-deal-parcel-id"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs text-gray-600 mb-1 block">
                      State {formData.parcelId.trim() && <span className="text-red-500">*</span>}
                      {!formData.parcelId.trim() && <span className="text-red-500">*</span>}
                    </label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => updateFormData('state', value)}
                    >
                      <SelectTrigger className="text-sm h-9" data-testid="input-deal-state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs text-gray-600 mb-1 block">
                      County {formData.parcelId.trim() && <span className="text-red-500">*</span>}
                    </label>
                    <Input
                      placeholder="Mecklenburg"
                      value={formData.county}
                      onChange={(e) => updateFormData('county', e.target.value)}
                      className={`text-sm ${formData.parcelId.trim() && !formData.county.trim() ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
                      data-testid="input-deal-county"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">
                      City {!formData.parcelId.trim() && <span className="text-red-500">*</span>}
                      {formData.parcelId.trim() && <span className="text-gray-400 font-normal"> (optional)</span>}
                    </label>
                    <Input
                      placeholder="Charlotte"
                      value={formData.city}
                      onChange={(e) => updateFormData('city', e.target.value)}
                      className="text-sm"
                      data-testid="input-deal-city"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs text-gray-600 mb-1 block">
                      ZIP Code {!formData.parcelId.trim() && <span className="text-red-500">*</span>}
                      {formData.parcelId.trim() && <span className="text-gray-400 font-normal"> (opt.)</span>}
                    </label>
                    <Input
                      placeholder="28202"
                      value={formData.zip}
                      onChange={(e) => updateFormData('zip', e.target.value)}
                      className="text-sm"
                      maxLength={10}
                      data-testid="input-deal-zip"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">Property Name</label>
                    <Input
                      placeholder="e.g., Sunset Hills"
                      value={formData.propertyName}
                      onChange={(e) => updateFormData('propertyName', e.target.value)}
                      className="text-sm"
                      data-testid="input-property-name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">Asking Price</label>
                    <Input
                      type="number"
                      placeholder="2500000"
                      value={formData.askingPrice}
                      onChange={(e) => updateFormData('askingPrice', e.target.value)}
                      className="text-sm"
                      data-testid="input-deal-asking-price"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">Deal Type</label>
                    <Select
                      value={formData.dealType}
                      onValueChange={(value: 'land' | 'acquisition') => updateFormData('dealType', value)}
                    >
                      <SelectTrigger className="text-sm" data-testid="select-deal-type">
                        <SelectValue placeholder="Select deal type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="land">Land Development</SelectItem>
                        <SelectItem value="acquisition">Acquisition (Existing Property)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">Acreage</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="5.5"
                      value={formData.sizeAcres}
                      onChange={(e) => updateFormData('sizeAcres', e.target.value)}
                      className="text-sm"
                      data-testid="input-deal-acreage"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">Unit Count</label>
                    <Input
                      type="number"
                      placeholder="150"
                      value={formData.unitCount}
                      onChange={(e) => updateFormData('unitCount', e.target.value)}
                      className="text-sm"
                      data-testid="input-deal-unit-count"
                    />
                  </div>
                  {formData.dealType === 'acquisition' && (
                    <div className="md:col-span-2">
                      <label className="text-xs text-gray-600 mb-1 block">Year Built (Vintage)</label>
                      <Input
                        type="number"
                        placeholder="1990"
                        value={formData.yearBuilt}
                        onChange={(e) => updateFormData('yearBuilt', e.target.value)}
                        className="text-sm"
                        min="1800"
                        max={new Date().getFullYear()}
                        data-testid="input-deal-year-built"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Required for acquisition classification (1985+ for most product types)
                      </p>
                    </div>
                  )}
                  
                  {/* Sewer and Zoning Checkboxes */}
                  <div className="md:col-span-4 flex flex-wrap gap-6 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sewer-available"
                        checked={formData.sewerAvailable}
                        onCheckedChange={(checked) => updateFormData('sewerAvailable', checked === true)}
                        data-testid="checkbox-sewer-available"
                      />
                      <label htmlFor="sewer-available" className="text-sm text-gray-700 cursor-pointer">
                        Sewer Available
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="zoning-by-right"
                        checked={formData.zoningByRight}
                        onCheckedChange={(checked) => updateFormData('zoningByRight', checked === true)}
                        data-testid="checkbox-zoning-by-right"
                      />
                      <label htmlFor="zoning-by-right" className="text-sm text-gray-700 cursor-pointer">
                        Zoning By-Right
                      </label>
                    </div>
                  </div>

                </div>
              </div>

              {/* Broker Information */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-slate-100">
                    <MapPin size={14} className="text-catalyst-navy" />
                  </div>
                  Broker Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div ref={brokerInputRef} className="relative">
                    <label className="text-xs text-gray-600 mb-1 block">Broker Name</label>
                    <div className="relative">
                      <Input
                        placeholder="Start typing to search..."
                        value={formData.brokerName}
                        onChange={(e) => handleBrokerNameChange(e.target.value)}
                        onFocus={() => {
                          if (brokerSuggestions.length > 0) setShowBrokerSuggestions(true);
                        }}
                        className="text-sm"
                        data-testid="input-broker-name"
                      />
                      {brokerSearchLoading && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        </div>
                      )}
                    </div>
                    {showBrokerSuggestions && brokerSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {brokerSuggestions.map((broker) => (
                          <button
                            key={broker.id}
                            type="button"
                            onClick={() => selectBroker(broker)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-gray-100 last:border-b-0"
                            data-testid={`broker-suggestion-${broker.id}`}
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {broker.firstName} {broker.lastName}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              {broker.email && <span>{broker.email}</span>}
                              {broker.brokerage && <span className="text-gray-400">• {broker.brokerage}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Broker Email</label>
                    <Input
                      type="email"
                      placeholder="broker@company.com"
                      value={formData.brokerEmail}
                      onChange={(e) => updateFormData('brokerEmail', e.target.value)}
                      className="text-sm"
                      data-testid="input-broker-email"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Broker Phone</label>
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.brokerPhone}
                      onChange={(e) => updateFormData('brokerPhone', e.target.value)}
                      className="text-sm"
                      data-testid="input-broker-phone"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-slate-100">
                    <FileText size={14} className="text-catalyst-navy" />
                  </div>
                  Analyst Notes
                </h4>
                <div>
                  <Textarea
                    placeholder="Add any notes about this property or deal..."
                    value={formData.analystNotes}
                    onChange={(e) => updateFormData('analystNotes', e.target.value)}
                    className="text-sm min-h-[80px]"
                    data-testid="textarea-analyst-notes"
                  />
                </div>
              </div>

              {/* Broker Notes */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-slate-100">
                    <FileText size={14} className="text-catalyst-navy" />
                  </div>
                  Broker Notes
                </h4>
                <div>
                  <Textarea
                    placeholder="Add notes from the broker about this property..."
                    value={formData.brokerNotes}
                    onChange={(e) => updateFormData('brokerNotes', e.target.value)}
                    className="text-sm min-h-[80px]"
                    data-testid="textarea-broker-notes"
                  />
                </div>
              </div>

              {/* File Uploads */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-slate-100">
                    <Upload size={14} className="text-catalyst-navy" />
                  </div>
                  Attachments
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="text-sm"
                      data-testid="button-select-files"
                    >
                      {isUploading ? (
                        <Loader2 size={14} className="animate-spin mr-2" />
                      ) : (
                        <Upload size={14} className="mr-2" />
                      )}
                      {isUploading ? 'Uploading...' : 'Select Files'}
                    </Button>
                    <span className="text-xs text-gray-500">
                      PDF, DOC, XLS, JPG, PNG
                    </span>
                  </div>
                  
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div 
                          key={index} 
                          className={`flex items-center justify-between p-2 rounded-md text-sm ${
                            file.error ? 'bg-red-50 border border-red-200' : 'bg-white border border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {file.uploading ? (
                              <Loader2 size={14} className="animate-spin text-catalyst-navy shrink-0" />
                            ) : file.error ? (
                              <X size={14} className="text-red-500 shrink-0" />
                            ) : (
                              <File size={14} className="text-catalyst-navy shrink-0" />
                            )}
                            <span className="truncate text-slate-700">{file.file.name}</span>
                            {file.error && (
                              <span className="text-xs text-red-500 shrink-0">({file.error})</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0 shrink-0"
                            data-testid={`button-remove-file-${index}`}
                          >
                            <X size={14} className="text-slate-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center pt-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Quickly add a deal to the dashboard for review and tracking. All fields except address are optional.
                </p>
                <div className="flex gap-2 shrink-0">
                  <Button 
                    onClick={resetForm}
                    variant="outline"
                    size="sm"
                    className="border-[#4A90E2] bg-white hover:bg-white text-[#4A90E2]"
                    data-testid="button-reset-form"
                  >
                    Clear Form
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={addDealMutation.isPending || (!formData.address.trim() && !formData.coordinates.trim() && !formData.parcelId.trim())}
                    size="sm"
                    className="bg-[#4A90E2] hover:bg-white hover:text-[#4A90E2] hover:border hover:border-[#4A90E2] text-white shadow-sm transition-all"
                    data-testid="button-add-deal"
                  >
                    {addDealMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    ) : (
                      <Plus size={16} className="mr-2" />
                    )}
                    Add Deal
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
