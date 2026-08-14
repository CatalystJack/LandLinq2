import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Search, Edit, Save, X, Mail, Phone, Building, MapPin, Calendar, Users, Trash2, TrendingUp, TrendingDown, Minus, MessageSquare, FileText, Smartphone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Broker } from "@shared/schema";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";

// Broker statistics types
interface BrokerStatistics {
  totalDeals: number;
  byClassification: {
    red: number;
    yellow: number;
    green: number;
    unclassified: number;
  };
  bySubmissionMethod: {
    email: number;
    sms: number;
    form: number;
  };
}

// Editing broker type - marketsCovered as string for form input
interface EditingBroker extends Omit<Broker, 'marketsCovered'> {
  marketsCovered: string;
}

// Broker statistics component
function BrokerStats({ brokerId }: { brokerId: string }) {
  const { data: stats, isLoading } = useQuery<BrokerStatistics>({
    queryKey: [`/api/brokers/${brokerId}/statistics`],
  });

  // Always use defensive defaults - shows 0 counts even when query fails or is loading
  const safeStats: BrokerStatistics = stats || {
    totalDeals: 0,
    byClassification: { red: 0, yellow: 0, green: 0, unclassified: 0 },
    bySubmissionMethod: { email: 0, sms: 0, form: 0 }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
        Deal Statistics
      </div>
      
      {/* Total & Classifications */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <span className="text-gray-600 dark:text-gray-400">Total Deals</span>
          <span className="font-semibold">{safeStats.totalDeals}</span>
        </div>
        <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="text-green-600 dark:text-green-400">Pursued</span>
          </div>
          <span className="font-semibold text-green-600 dark:text-green-400">
            {safeStats.byClassification.green + safeStats.byClassification.yellow}
          </span>
        </div>
      </div>
      
      {/* Classification Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
        <div className="flex items-center justify-between p-1.5 bg-green-50 dark:bg-green-950 rounded">
          <span className="text-green-600 dark:text-green-400">Green</span>
          <span className="font-semibold text-green-600 dark:text-green-400">{safeStats.byClassification.green}</span>
        </div>
        <div className="flex items-center justify-between p-1.5 bg-yellow-50 dark:bg-yellow-950 rounded">
          <span className="text-yellow-600 dark:text-yellow-400">Yellow</span>
          <span className="font-semibold text-yellow-600 dark:text-yellow-400">{safeStats.byClassification.yellow}</span>
        </div>
        <div className="flex items-center justify-between p-1.5 bg-red-50 dark:bg-red-950 rounded">
          <span className="text-red-600 dark:text-red-400">Red</span>
          <span className="font-semibold text-red-600 dark:text-red-400">{safeStats.byClassification.red}</span>
        </div>
      </div>
      
      {/* Submission Methods */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center justify-between p-1.5 bg-blue-50 dark:bg-blue-950 rounded">
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-600 dark:text-blue-400">Email</span>
          </div>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{safeStats.bySubmissionMethod.email}</span>
        </div>
        <div className="flex items-center justify-between p-1.5 bg-purple-50 dark:bg-purple-950 rounded">
          <div className="flex items-center gap-1">
            <Smartphone className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            <span className="text-purple-600 dark:text-purple-400">SMS</span>
          </div>
          <span className="font-semibold text-purple-600 dark:text-purple-400">{safeStats.bySubmissionMethod.sms}</span>
        </div>
        <div className="flex items-center justify-between p-1.5 bg-gray-100 dark:bg-gray-800 rounded">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Form</span>
          </div>
          <span className="font-semibold text-gray-600 dark:text-gray-400">{safeStats.bySubmissionMethod.form}</span>
        </div>
      </div>
    </div>
  );
}

export default function BrokerManagement() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [editingBroker, setEditingBroker] = useState<EditingBroker | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [brokerToDelete, setBrokerToDelete] = useState<Broker | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [highlightedBrokerId, setHighlightedBrokerId] = useState<string | null>(null);
  const brokerCardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Fetch brokers
  const { data: brokers = [], isLoading } = useQuery<Broker[]>({
    queryKey: ["/api/brokers"],
    enabled: isAuthenticated,
  });
  
  // Handle brokerId from URL query parameter - scroll to and highlight the broker
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const brokerId = urlParams.get('brokerId');
    
    if (brokerId && brokers.length > 0) {
      // Check if broker exists
      const broker = brokers.find(b => b.id === brokerId);
      if (broker) {
        // Highlight the broker card
        setHighlightedBrokerId(brokerId);
        
        // Scroll to the broker card after a short delay (for DOM to render)
        setTimeout(() => {
          const cardRef = brokerCardRefs.current[brokerId];
          if (cardRef) {
            cardRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          setHighlightedBrokerId(null);
        }, 3000);
      }
    }
  }, [brokers, location]);

  // Update broker mutation
  const updateBrokerMutation = useMutation({
    mutationFn: async (updates: { id: string; data: Partial<Broker> }) => {
      return await apiRequest("PUT", `/api/brokers/${updates.id}`, updates.data);
    },
    onSuccess: () => {
      toast({
        title: "Broker Updated",
        description: "Broker information has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/brokers"] });
      setShowEditDialog(false);
      setEditingBroker(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update broker information.",
      });
    },
  });

  // Delete broker mutation
  const deleteBrokerMutation = useMutation({
    mutationFn: async (brokerId: string) => {
      return await apiRequest("DELETE", `/api/brokers/${brokerId}`);
    },
    onSuccess: () => {
      toast({
        title: "Broker Deleted",
        description: "Broker has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/brokers"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message || "Failed to delete broker.",
      });
    },
  });

  // Filter brokers based on search query
  const filteredBrokers = brokers.filter((broker) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const marketsText = Array.isArray(broker.marketsCovered) 
      ? broker.marketsCovered.join(' ').toLowerCase()
      : (broker.marketsCovered || '').toLowerCase();
    
    return (
      broker.firstName?.toLowerCase().includes(query) ||
      broker.lastName?.toLowerCase().includes(query) ||
      broker.email?.toLowerCase().includes(query) ||
      broker.phone?.toLowerCase().includes(query) ||
      broker.brokerage?.toLowerCase().includes(query) ||
      marketsText.includes(query)
    );
  });

  const openEditDialog = (broker: Broker) => {
    // Convert broker to editing format (marketsCovered as string)
    const editingData: EditingBroker = {
      ...broker,
      // Convert array back to comma-separated string for editing
      marketsCovered: Array.isArray(broker.marketsCovered) 
        ? broker.marketsCovered.join(', ') 
        : ''
    };
    setEditingBroker(editingData);
    setShowEditDialog(true);
  };

  const handleSaveBroker = () => {
    if (!editingBroker) return;

    const updates: Partial<Broker> = {
      firstName: editingBroker.firstName,
      lastName: editingBroker.lastName,
      email: editingBroker.email,
      phone: editingBroker.phone,
      marketsCovered: editingBroker.marketsCovered 
        ? editingBroker.marketsCovered.split(',').map(market => market.trim()).filter(market => market.length > 0)
        : [],
      brokerage: editingBroker.brokerage,
      yearsExperience: editingBroker.yearsExperience,
      isActive: editingBroker.isActive,
    };

    updateBrokerMutation.mutate({
      id: editingBroker.id,
      data: updates,
    });
  };

  const handleDeleteBroker = (broker: Broker) => {
    setBrokerToDelete(broker);
    setShowDeleteDialog(true);
  };

  const confirmDeleteBroker = () => {
    if (!brokerToDelete) return;
    deleteBrokerMutation.mutate(brokerToDelete.id);
    setShowDeleteDialog(false);
    setBrokerToDelete(null);
  };

  if (!isAuthenticated) {
    return <div>Please log in to access broker management.</div>;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Broker Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage broker profiles, contact information, and settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {filteredBrokers.length} Brokers
          </Badge>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Brokers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, phone, brokerage, or markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="broker-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Brokers Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBrokers.map((broker) => (
          <Card 
            key={broker.id} 
            ref={(el) => { brokerCardRefs.current[broker.id] = el; }}
            className={`hover:shadow-md transition-all duration-300 ${
              highlightedBrokerId === broker.id 
                ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg bg-blue-50 dark:bg-blue-950' 
                : ''
            }`}
            data-testid={`broker-card-${broker.id}`}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {broker.firstName} {broker.lastName}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={broker.isActive ? "default" : "secondary"}>
                      {broker.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(broker)}
                    data-testid={`edit-broker-${broker.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBroker(broker)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                    data-testid={`delete-broker-${broker.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                {broker.email && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Mail className="h-4 w-4" />
                    <span>
                      {broker.email.includes('@temp.landlinq.ai') ? (
                        <span className="text-gray-400 italic text-xs">SMS Only (no email on file)</span>
                      ) : broker.email}
                    </span>
                  </div>
                )}
                {broker.phone && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Phone className="h-4 w-4" />
                    <span>{broker.phone}</span>
                  </div>
                )}
                {broker.brokerage && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Building className="h-4 w-4" />
                    <span>{broker.brokerage}</span>
                  </div>
                )}
                {broker.marketsCovered && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="h-4 w-4" />
                    <span className="line-clamp-2">
                      {Array.isArray(broker.marketsCovered) 
                        ? broker.marketsCovered.join(', ') 
                        : broker.marketsCovered}
                    </span>
                  </div>
                )}
                {broker.yearsExperience && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>{broker.yearsExperience} years experience</span>
                  </div>
                )}
              </div>
              
              {/* Broker Statistics */}
              <BrokerStats brokerId={broker.id} />
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBrokers.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No brokers found</h3>
              <p>
                {searchQuery
                  ? "No brokers match your search criteria."
                  : "No brokers are currently registered."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Broker Information</DialogTitle>
            <DialogDescription>
              Update broker contact information and profile details.
            </DialogDescription>
          </DialogHeader>

          {editingBroker && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={editingBroker.firstName || ""}
                    onChange={(e) =>
                      setEditingBroker({
                        ...editingBroker,
                        firstName: e.target.value,
                      })
                    }
                    placeholder="First name"
                    data-testid="edit-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={editingBroker.lastName || ""}
                    onChange={(e) =>
                      setEditingBroker({
                        ...editingBroker,
                        lastName: e.target.value,
                      })
                    }
                    placeholder="Last name"
                    data-testid="edit-last-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingBroker.email?.includes('@temp.landlinq.ai') ? '' : (editingBroker.email || "")}
                  onChange={(e) =>
                    setEditingBroker({
                      ...editingBroker,
                      email: e.target.value,
                    })
                  }
                  placeholder={editingBroker.email?.includes('@temp.landlinq.ai') ? "Enter email (SMS-only broker)" : "email@example.com"}
                  data-testid="edit-email"
                />
                {editingBroker.email?.includes('@temp.landlinq.ai') && (
                  <p className="text-xs text-gray-500">This broker was created via SMS. Add their email here if available.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={editingBroker.phone || ""}
                  onChange={(e) =>
                    setEditingBroker({
                      ...editingBroker,
                      phone: e.target.value,
                    })
                  }
                  placeholder="(555) 123-4567"
                  data-testid="edit-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brokerage">Brokerage</Label>
                <Input
                  id="brokerage"
                  value={editingBroker.brokerage || ""}
                  onChange={(e) =>
                    setEditingBroker({
                      ...editingBroker,
                      brokerage: e.target.value,
                    })
                  }
                  placeholder="Brokerage name"
                  data-testid="edit-brokerage"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience</Label>
                <Input
                  id="yearsExperience"
                  value={editingBroker.yearsExperience || ""}
                  onChange={(e) =>
                    setEditingBroker({
                      ...editingBroker,
                      yearsExperience: e.target.value,
                    })
                  }
                  placeholder="5+, 10+, etc."
                  data-testid="edit-years-experience"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marketsCovered">Markets Covered</Label>
                <Textarea
                  id="marketsCovered"
                  value={editingBroker.marketsCovered || ""}
                  onChange={(e) =>
                    setEditingBroker({
                      ...editingBroker,
                      marketsCovered: e.target.value,
                    })
                  }
                  placeholder="Charlotte, Raleigh, Durham..."
                  rows={3}
                  data-testid="edit-markets-covered"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="isActive">Active Status</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Inactive brokers cannot submit new deals
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={editingBroker.isActive || false}
                  onCheckedChange={(checked) =>
                    setEditingBroker({
                      ...editingBroker,
                      isActive: checked,
                    })
                  }
                  data-testid="edit-active-status"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              data-testid="cancel-edit-broker"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveBroker}
              disabled={updateBrokerMutation.isPending}
              data-testid="save-broker-changes"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateBrokerMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Broker</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this broker? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {brokerToDelete && (
            <div className="py-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">You are about to delete:</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {brokerToDelete.firstName} {brokerToDelete.lastName}
                </p>
                {brokerToDelete.email && !brokerToDelete.email.includes('@temp.landlinq.ai') && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {brokerToDelete.email}
                  </p>
                )}
                {brokerToDelete.brokerage && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {brokerToDelete.brokerage}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              data-testid="cancel-delete-broker"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteBroker}
              disabled={deleteBrokerMutation.isPending}
              data-testid="confirm-delete-broker"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteBrokerMutation.isPending ? "Deleting..." : "Delete Broker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        <Footer />
    </div>
    </div>
  );
}