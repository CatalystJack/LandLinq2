import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Save, X, Settings, Target, MapPin, Calculator, Building, Zap } from "lucide-react";
import type { AcquisitionCriteria, InsertAcquisitionCriteria } from "@shared/schema";

interface CriteriaRule {
  field: string;
  operator: string;
  value: any;
  weight: number;
}

interface CriteriaRules {
  location?: CriteriaRule[];
  size?: CriteriaRule[];
  financial?: CriteriaRule[];
  zoning?: CriteriaRule[];
  infrastructure?: CriteriaRule[];
}

export default function AcquisitionCriteriaPage() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCriteria, setNewCriteria] = useState<Partial<InsertAcquisitionCriteria>>({
    name: "",
    category: "location",
    classification: "green",
    weight: 1,
    rules: {},
    description: "",
    isActive: true,
  });
  const [psfRent, setPsfRent] = useState<string>("");

  // Check if user is analyst
  // FIX (Dec 15, 2025): Support both OIDC auth (user.claims.email) and traditional auth (user.email)
  const isAnalyst = ((user as any)?.claims?.email || (user as any)?.email || '').includes('@catalystcp.com');

  // Fetch acquisition criteria
  const {
    data: criteria = [],
    isLoading,
    error,
  } = useQuery<AcquisitionCriteria[]>({
    queryKey: ["/api/acquisition-criteria"],
    enabled: isAuthenticated && isAnalyst,
  });

  // Create criteria mutation
  const createCriteriaMutation = useMutation({
    mutationFn: async (data: InsertAcquisitionCriteria) => {
      return await apiRequest("POST", "/api/acquisition-criteria", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acquisition-criteria"] });
      toast({
        title: "Criteria Created",
        description: "New acquisition criteria has been created successfully.",
      });
      setNewCriteria({
        name: "",
        category: "location",
        classification: "green",
        weight: 1,
        rules: {},
        description: "",
        isActive: true,
      });
      setPsfRent("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create criteria",
        variant: "destructive",
      });
    },
  });

  // Update criteria mutation
  const updateCriteriaMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<AcquisitionCriteria> }) => {
      return await apiRequest("PUT", `/api/acquisition-criteria/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acquisition-criteria"] });
      toast({
        title: "Criteria Updated",
        description: "Acquisition criteria has been updated successfully.",
      });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update criteria",
        variant: "destructive",
      });
    },
  });

  // Delete criteria mutation
  const deleteCriteriaMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/acquisition-criteria/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acquisition-criteria"] });
      toast({
        title: "Criteria Deleted",
        description: "Acquisition criteria has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete criteria",
        variant: "destructive",
      });
    },
  });

  // Redirect non-analysts
  useEffect(() => {
    if (isAuthenticated && !isAnalyst) {
      window.location.href = '/dashboard';
    }
  }, [isAuthenticated, isAnalyst]);

  if (!isAuthenticated || !isAnalyst) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-catalyst-gray-900 mb-4">Access Restricted</h1>
            <p className="text-catalyst-gray-600">This page is only accessible to analysts.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'location': return <MapPin className="h-4 w-4" />;
      case 'size': return <Target className="h-4 w-4" />;
      case 'financial': return <Calculator className="h-4 w-4" />;
      case 'zoning': return <Building className="h-4 w-4" />;
      case 'infrastructure': return <Zap className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'green': return 'bg-green-100 text-green-800 border-green-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'red': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleCreateCriteria = () => {
    if (!newCriteria.name || !newCriteria.category || !newCriteria.classification) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Include PSF rent in rules if provided
    const updatedRules: any = { ...(newCriteria.rules || {}) };
    if (psfRent && parseFloat(psfRent) > 0) {
      updatedRules.psfRent = parseFloat(psfRent);
    }

    const criteriaToCreate = {
      ...newCriteria,
      rules: updatedRules
    } as InsertAcquisitionCriteria;

    createCriteriaMutation.mutate(criteriaToCreate);
  };

  const groupedCriteria = criteria.reduce((acc, criterion) => {
    if (!acc[criterion.category]) {
      acc[criterion.category] = [];
    }
    acc[criterion.category].push(criterion);
    return acc;
  }, {} as Record<string, AcquisitionCriteria[]>);

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-catalyst-gray-50">
        <div className="py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-catalyst-gray-900 mb-4 tracking-tight">
                Acquisition Criteria Management
              </h1>
              <p className="text-lg sm:text-xl text-catalyst-gray-600 font-light max-w-3xl mx-auto">
                Configure the rules that determine how deals are classified as pursuing (green), reviewing (yellow), or passed (red)
              </p>
            </div>

            <Tabs defaultValue="criteria" className="space-y-8">
              <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
                <TabsTrigger value="criteria" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Current Criteria
                </TabsTrigger>
                <TabsTrigger value="create" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Preview Rules
                </TabsTrigger>
              </TabsList>

              {/* Current Criteria Tab */}
              <TabsContent value="criteria" className="space-y-6">
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader>
                          <div className="h-4 bg-catalyst-gray-200 rounded w-3/4"></div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="h-4 bg-catalyst-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-catalyst-gray-200 rounded w-2/3"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : Object.keys(groupedCriteria).length === 0 ? (
                  <Card className="text-center border-catalyst-gray-200">
                    <CardContent className="p-12">
                      <Settings className="h-16 w-16 text-catalyst-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-catalyst-gray-900 mb-2">No Criteria Configured</h3>
                      <p className="text-catalyst-gray-600 mb-6">
                        Get started by creating your first acquisition criteria rule.
                      </p>
                      <Button onClick={() => (document.querySelector('[value="create"]') as HTMLElement)?.click()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Criteria
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedCriteria).map(([category, criteriaList]) => (
                      <div key={category} className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                          {getCategoryIcon(category)}
                          <h2 className="text-xl font-semibold text-catalyst-gray-900 capitalize">
                            {category} Criteria
                          </h2>
                          <Badge variant="outline">{criteriaList.length}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {criteriaList.map((criterion) => (
                            <Card key={criterion.id} className="border-catalyst-gray-200 hover:shadow-md transition-shadow">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                  {getCategoryIcon(criterion.category)}
                                  {criterion.name}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge className={getClassificationColor(criterion.classification)}>
                                    {criterion.classification.toUpperCase()}
                                  </Badge>
                                  <Switch 
                                    checked={criterion.isActive || false}
                                    onCheckedChange={(checked) => {
                                      updateCriteriaMutation.mutate({
                                        id: criterion.id,
                                        updates: { isActive: checked }
                                      });
                                    }}
                                  />
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <p className="text-sm text-catalyst-gray-600 line-clamp-2">
                                  {criterion.description || "No description provided"}
                                </p>
                                
                                <div className="flex items-center justify-between text-xs text-catalyst-gray-500">
                                  <span>Weight: {criterion.weight}</span>
                                  <span>Score: {criterion.minScore}-{criterion.maxScore}</span>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setEditingId(criterion.id)}
                                    data-testid={`button-edit-${criterion.id}`}
                                  >
                                    <Edit className="mr-1 h-3 w-3" />
                                    Edit
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="destructive"
                                    onClick={() => deleteCriteriaMutation.mutate(criterion.id)}
                                    data-testid={`button-delete-${criterion.id}`}
                                  >
                                    <X className="mr-1 h-3 w-3" />
                                    Delete
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Create New Criteria Tab */}
              <TabsContent value="create" className="space-y-6">
                <Card className="max-w-2xl mx-auto border-catalyst-gray-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Create New Acquisition Criteria
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Criteria Name *</Label>
                        <Input
                          id="name"
                          value={newCriteria.name || ""}
                          onChange={(e) => setNewCriteria({...newCriteria, name: e.target.value})}
                          placeholder="e.g., Target Market Location"
                          data-testid="input-criteria-name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">Category *</Label>
                        <Select 
                          value={newCriteria.category || "location"} 
                          onValueChange={(value) => setNewCriteria({...newCriteria, category: value})}
                        >
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="location">Location</SelectItem>
                            <SelectItem value="size">Size</SelectItem>
                            <SelectItem value="financial">Financial</SelectItem>
                            <SelectItem value="zoning">Zoning</SelectItem>
                            <SelectItem value="infrastructure">Infrastructure</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="classification">Classification *</Label>
                        <Select 
                          value={newCriteria.classification || "green"} 
                          onValueChange={(value) => setNewCriteria({...newCriteria, classification: value})}
                        >
                          <SelectTrigger data-testid="select-classification">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="green">Green (Pursuing)</SelectItem>
                            <SelectItem value="yellow">Yellow (Reviewing)</SelectItem>
                            <SelectItem value="red">Red (Passed)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="weight">Weight</Label>
                        <Input
                          id="weight"
                          type="number"
                          min="1"
                          max="10"
                          value={newCriteria.weight || 1}
                          onChange={(e) => setNewCriteria({...newCriteria, weight: parseInt(e.target.value) || 1})}
                          data-testid="input-weight"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="minScore">Min Score</Label>
                        <Input
                          id="minScore"
                          type="number"
                          value={newCriteria.minScore || ""}
                          onChange={(e) => setNewCriteria({...newCriteria, minScore: parseInt(e.target.value) || undefined})}
                          placeholder="0"
                          data-testid="input-min-score"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxScore">Max Score</Label>
                        <Input
                          id="maxScore"
                          type="number"
                          value={newCriteria.maxScore || ""}
                          onChange={(e) => setNewCriteria({...newCriteria, maxScore: parseInt(e.target.value) || undefined})}
                          placeholder="100"
                          data-testid="input-max-score"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="psfRent">PSF Rent (per square foot)</Label>
                      <Input
                        id="psfRent"
                        type="number"
                        step="0.01"
                        value={psfRent}
                        onChange={(e) => setPsfRent(e.target.value)}
                        placeholder="1.75"
                        data-testid="input-psf-rent"
                      />
                      <p className="text-xs text-catalyst-gray-500">
                        Optional: Enter rent per square foot for financial criteria
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newCriteria.description || ""}
                        onChange={(e) => setNewCriteria({...newCriteria, description: e.target.value})}
                        placeholder="Describe what this criteria evaluates and how it affects deal classification..."
                        rows={3}
                        data-testid="textarea-description"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="isActive"
                        checked={newCriteria.isActive ?? true}
                        onCheckedChange={(checked) => setNewCriteria({...newCriteria, isActive: checked})}
                        data-testid="switch-active"
                      />
                      <Label htmlFor="isActive">Active</Label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={handleCreateCriteria}
                        disabled={createCriteriaMutation.isPending}
                        data-testid="button-create-criteria"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {createCriteriaMutation.isPending ? "Creating..." : "Create Criteria"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setNewCriteria({
                            name: "",
                            category: "location",
                            classification: "green",
                            weight: 1,
                            rules: {},
                            description: "",
                            isActive: true,
                          });
                          setPsfRent("");
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Preview Rules Tab */}
              <TabsContent value="preview" className="space-y-6">
                <Card className="border-catalyst-gray-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Deal Classification Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <h3 className="font-semibold text-green-800 flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          Green (Pursuing)
                        </h3>
                        <div className="space-y-2 text-sm">
                          {criteria.filter(c => c.classification === 'green' && c.isActive).map(c => (
                            <div key={c.id} className="p-2 bg-green-50 rounded border border-green-200">
                              <div className="font-medium">{c.name}</div>
                              <div className="text-green-600 text-xs">{c.category}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          Yellow (Reviewing)
                        </h3>
                        <div className="space-y-2 text-sm">
                          {criteria.filter(c => c.classification === 'yellow' && c.isActive).map(c => (
                            <div key={c.id} className="p-2 bg-yellow-50 rounded border border-yellow-200">
                              <div className="font-medium">{c.name}</div>
                              <div className="text-yellow-600 text-xs">{c.category}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="font-semibold text-red-800 flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          Red (Passed)
                        </h3>
                        <div className="space-y-2 text-sm">
                          {criteria.filter(c => c.classification === 'red' && c.isActive).map(c => (
                            <div key={c.id} className="p-2 bg-red-50 rounded border border-red-200">
                              <div className="font-medium">{c.name}</div>
                              <div className="text-red-600 text-xs">{c.category}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <Footer />
    </div>
    </>
  );
}