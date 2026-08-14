import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, FileText } from "lucide-react";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  marketsCovered: string;
  additionalTeamEmails: string;
  address: string;
  zip: string;
  askingPrice: string;
  sizeAcres: string;
  unitCount: string;
  pricingType: string;
  sewerAvailable: string;
  entitlements: string;
  productTypes: string[];
  brokerNotes: string;
  smsOptIn: boolean;
}

interface MobileDealFormProps {
  onSubmit: (data: FormData & { files?: File[] }) => Promise<void>;
  loading: boolean;
  initialBrokerData?: any;
  isAuthenticated?: boolean;
}

export function MobileDealForm({ onSubmit, loading, initialBrokerData, isAuthenticated }: MobileDealFormProps) {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    marketsCovered: '',
    additionalTeamEmails: '',
    address: '',
    zip: '',
    askingPrice: '',
    sizeAcres: '',
    unitCount: '',
    pricingType: 'whole_deal',
    sewerAvailable: '',
    entitlements: '',
    productTypes: [],
    brokerNotes: '',
    smsOptIn: false
  });

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // No need to pre-populate since we hide the contact fields for authenticated users

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...formData, files: uploadedFiles });
  };

  const handleProductTypeChange = (productType: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        productTypes: [...prev.productTypes, productType]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        productTypes: prev.productTypes.filter(p => p !== productType)
      }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4">
      {/* Form Card - Exact Process Page Style */}
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200/50 overflow-hidden">
        {/* Header - Exact Process Page Style */}
        <div className="bg-[#07172A] px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-lg">Property Submission</h3>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Required Fields Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Required Fields:</span> Fields marked with an asterisk (*) must be completed to submit your property.
              </p>
            </div>
            
            {/* Broker Information Section */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-[#07172A] border-b border-gray-200 pb-2">
                Contact Information
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Show email field only for non-authenticated users */}
                {!isAuthenticated && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email Address *</label>
                    <input 
                      type="email" 
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                      placeholder="your.email@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                      data-testid="input-email"
                    />
                  </div>
                )}
                
                {/* ALWAYS show phone field for SMS confirmations */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Phone Number {!isAuthenticated && <span className="text-xs text-gray-500">(for SMS updates)</span>}
                  </label>
                  <input 
                    type="tel" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-phone"
                  />
                </div>
                
                {/* Show additional broker fields only for non-authenticated users */}
                {!isAuthenticated && (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-gray-700">Full Name *</label>
                      <input 
                        type="text" 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                        placeholder="Your full name"
                        value={formData.fullName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                        required
                        data-testid="input-fullName"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Company/Brokerage</label>
                      <input 
                        type="text" 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                        placeholder="Your company name"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        data-testid="input-companyName"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Markets Covered</label>
                      <input 
                        type="text" 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                        placeholder="e.g., Dallas-Fort Worth, Austin"
                        value={formData.marketsCovered}
                        onChange={(e) => setFormData(prev => ({ ...prev, marketsCovered: e.target.value }))}
                        data-testid="input-marketsCovered"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Authenticated user info display */}
            {isAuthenticated && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      <span className="font-medium">Logged in as a broker.</span> Your contact information will be automatically included with this submission.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Property Information Section */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-[#07172A] border-b border-gray-200 pb-2">
                Property Information
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Property Address *</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                    placeholder="123 Main Street, City, State"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    required
                    data-testid="input-address"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">ZIP Code *</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                    placeholder="28202"
                    value={formData.zip}
                    onChange={(e) => setFormData(prev => ({ ...prev, zip: e.target.value.trim() }))}
                    maxLength={10}
                    required
                    data-testid="input-zip"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Asking Price (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                    placeholder="Enter asking price"
                    value={formData.askingPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, askingPrice: e.target.value }))}
                    data-testid="input-askingPrice"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Size in Acres (Optional)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                    placeholder="5.2"
                    value={formData.sizeAcres}
                    onChange={(e) => setFormData(prev => ({ ...prev, sizeAcres: e.target.value }))}
                    data-testid="input-sizeAcres"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Proposed Unit Count (Optional)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                    placeholder="150"
                    value={formData.unitCount}
                    onChange={(e) => setFormData(prev => ({ ...prev, unitCount: e.target.value }))}
                    data-testid="input-unitCount"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="sewerAvailable"
                      checked={formData.sewerAvailable === 'yes'}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sewerAvailable: checked ? 'yes' : '' }))}
                      data-testid="checkbox-sewer-available"
                    />
                    <label htmlFor="sewerAvailable" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Sewer Available
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">Check if municipal sewer is available to the property</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="withZoning"
                      checked={formData.entitlements === 'yes'}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, entitlements: checked ? 'yes' : '' }))}
                      data-testid="checkbox-with-zoning"
                    />
                    <label htmlFor="withZoning" className="text-sm font-medium text-gray-700 cursor-pointer">
                      With Zoning
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">Check if this property comes with residential zoning 'by-right'</p>
                </div>
              </div>

              {/* Product Types */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Development Type (Optional)</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['Active Adult', 'Affordable', 'BTR (Build to Rent)', 'Conventional', 'Lot Development'].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={formData.productTypes.includes(type)}
                        onCheckedChange={(checked) => handleProductTypeChange(type, checked as boolean)}
                        data-testid={`checkbox-${type.replace(/\s+/g, '-').toLowerCase()}`}
                      />
                      <label htmlFor={type} className="text-sm text-gray-700 cursor-pointer">
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-[#07172A] border-b border-gray-200 pb-2">
                Additional Information
              </h4>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Broker Notes</label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A90E2] focus:border-[#4A90E2] text-base"
                  rows={4}
                  placeholder="Any additional details about the property, zoning, market conditions, or special circumstances..."
                  value={formData.brokerNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, brokerNotes: e.target.value }))}
                  data-testid="textarea-brokerNotes"
                />
              </div>

              {/* File Upload Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Upload Documents</label>
                <p className="text-xs text-gray-500">Upload property documents, photos, surveys, or other relevant files</p>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#4A90E2] transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        setUploadedFiles(prev => [...prev, ...newFiles]);
                      }
                    }}
                    className="hidden"
                    id="file-upload"
                    data-testid="input-file-upload"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                  />
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-10 h-10 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600 font-medium">Click to upload files</span>
                    <span className="text-xs text-gray-500 mt-1">PDF, DOC, JPG, PNG, XLS (Max 500MB per file)</span>
                  </label>
                </div>

                {/* Display uploaded files */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {uploadedFiles.map((file, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                        data-testid={`file-item-${index}`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-[#4A90E2] flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                          className="ml-2 p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                          data-testid={`button-remove-file-${index}`}
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SMS Opt-In */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Checkbox
                  id="smsOptIn"
                  checked={formData.smsOptIn}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, smsOptIn: checked as boolean }))}
                  data-testid="checkbox-sms-opt-in"
                />
                <label htmlFor="smsOptIn" className="text-sm text-gray-700 cursor-pointer flex-1">
                  <span className="font-semibold">Opt in to SMS text messages</span>
                  <span className="block text-xs text-gray-600 mt-1">
                    Receive updates about your deal submission via text message
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-200">
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="w-full disabled:opacity-50"
                data-testid="button-submit-deal"
              >
                {loading ? 'Submitting...' : 'Submit Deal for Analysis'}
              </Button>
              <p className="text-center text-sm text-gray-500 mt-3">
                Our AI will analyze your property instantly and send results to your email
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}