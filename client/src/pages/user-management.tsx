import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Users, Shield, Settings, Edit, Trash2, Mail, Calendar, UserCheck, UserX, Crown, Eye, Building, MapPin, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { formatDateEST } from "@/utils/timezone";
import Footer from "@/components/footer";
import Navigation from "@/components/navigation";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  role?: string;
  dealRole?: string;
  productTypes?: string[];
  states?: string[];
  lastLogin?: string;
  isActive?: boolean;
  phone?: string;
  marketsCovered?: string[];
  brokerage?: string;
}


interface NewUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: string;
  dealRole?: string;
}

// Product types and states available for assignment
const PRODUCT_TYPES = [
  "Active Adult",
  "BTR (Build to Rent)",
  "Conventional Apartments",
  "Lot Development"
];

const STATES = [
  "NC", "SC", "GA", "FL", "TN", "VA", 
  "TX", "OK", "AR", "LA", "MS", "AL"
];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<NewUser>({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    role: "analyst",
    dealRole: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users", {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized - Admin access required");
        }
        throw new Error("Failed to fetch users");
      }
      return response.json();
    }
  });


  // Create new user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: NewUser) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddUserOpen(false);
      setNewUser({ email: "", firstName: "", lastName: "", password: "", role: "analyst", dealRole: "" });
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<User> }) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log('🚀 [DELETE MUTATION] Starting DELETE request for userId:', userId);
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        credentials: 'include',
      });
      console.log('📡 [DELETE MUTATION] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [DELETE MUTATION] Request failed:', errorData);
        throw new Error(errorData.message || "Failed to delete user");
      }
      const result = await response.json();
      console.log('✅ [DELETE MUTATION] User deleted successfully:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('✅ [DELETE MUTATION] onSuccess called, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      console.error('❌ [DELETE MUTATION] onError called:', error);
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  // Fetch pending partner broker portal accounts
  const { data: pendingBrokers, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["/api/admin/pending-approvals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pending-approvals", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pending approvals");
      return res.json() as Promise<Array<{
        id: string; email: string; firstName: string; lastName: string;
        brokerage: string; phone: string; createdAt: string;
      }>>;
    },
    refetchInterval: 30000,
  });

  const approveBrokerMutation = useMutation({
    mutationFn: async (brokerId: string) => {
      const res = await fetch(`/api/admin/approve-broker/${brokerId}`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve broker");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-approvals"] });
      toast({ title: "Broker approved", description: "They will receive an email with access." });
    },
    onError: (e: Error) => toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
  });

  const users = usersData?.users || [];

  // Filter users based on search and role
  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    let userRole = "team";
    if (user.email.endsWith("@catalystcp.com")) {
      userRole = user.email === "jack@catalystcp.com" ? "super_admin" : "analyst";
    } else {
      userRole = "broker";
    }
    
    const matchesRole = selectedRole === "all" || userRole === selectedRole;
    return matchesSearch && matchesRole;
  });

  const getRoleFromEmail = (email: string) => {
    if (email === "jack@catalystcp.com") return "Super Admin";
    if (email.endsWith("@catalystcp.com")) return "Catalyst Team";
    return "Broker";
  };

  const getRoleBadgeVariant = (email: string) => {
    if (email === "jack@catalystcp.com") return "destructive";
    if (email.endsWith("@catalystcp.com")) return "default";
    return "secondary";
  };

  const handleCreateUser = () => {
    if (!newUser.email || !newUser.firstName || !newUser.lastName || !newUser.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleUpdateUser = (userId: string, updates: Partial<User>) => {
    updateUserMutation.mutate({ userId, updates });
  };

  // Helper function to check if user is a Catalyst member
  const isCatalystMember = (email: string) => {
    return email.endsWith("@catalystcp.com");
  };

  // Toggle product type selection
  const toggleProductType = (productType: string) => {
    if (!editingUser) return;
    const current = editingUser.productTypes || [];
    const updated = current.includes(productType)
      ? current.filter(type => type !== productType)
      : [...current, productType];
    setEditingUser({ ...editingUser, productTypes: updated });
  };

  // Toggle state selection
  const toggleState = (state: string) => {
    if (!editingUser) return;
    const current = editingUser.states || [];
    const updated = current.includes(state)
      ? current.filter(s => s !== state)
      : [...current, state];
    setEditingUser({ ...editingUser, states: updated });
  };

  const handleDeleteUser = (userId: string, userEmail: string) => {
    // Enhanced debug logging
    console.log('🗑️ [DELETE] User deletion attempt:', {
      currentUserEmail: currentUser?.email,
      currentUserRaw: currentUser,
      targetUserEmail: userEmail,
      targetUserId: userId,
      isAuthenticated: !!currentUser
    });

    // Check if logged-in user is super admin (case-insensitive)
    const currentEmail = currentUser?.email ? String(currentUser.email).toLowerCase().trim() : '';
    const superAdminEmail = 'jack@catalystcp.com';
    
    console.log('🔐 [DELETE] Permission check:', {
      currentEmail,
      superAdminEmail,
      matches: currentEmail === superAdminEmail
    });
    
    if (currentEmail !== superAdminEmail) {
      console.error('❌ [DELETE] Permission denied - user is not super admin');
      toast({
        title: "Permission Denied",
        description: `Only super admin (${superAdminEmail}) can delete users. You are logged in as: ${currentUser?.email || 'unknown'}`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    // Prevent deleting the super admin account (case-insensitive)
    if (userEmail ? String(userEmail).toLowerCase().trim() === superAdminEmail : false) {
      console.error('❌ [DELETE] Cannot delete super admin account');
      toast({
        title: "Error",
        description: "Cannot delete the super admin account",
        variant: "destructive",
      });
      return;
    }
    
    console.log('✅ [DELETE] Permission granted, showing confirmation dialog');
    if (window.confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) {
      console.log('✅ [DELETE] User confirmed deletion, calling mutation');
      deleteUserMutation.mutate(userId);
    } else {
      console.log('⚠️ [DELETE] User cancelled deletion');
    }
  };

  if (usersError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
              <p className="text-red-600 mb-4">Only super admins can access user management.</p>
              <Button 
                onClick={() => window.location.href = '/analyst-dashboard'}
                variant="outline"
                data-testid="back-to-dashboard"
              >
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900" data-testid="user-management-title">
            User Management
          </h1>
          <p className="text-slate-600 mt-2">Manage user accounts, broker profiles, roles, and permissions</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3" data-testid="user-management-tabs">
            <TabsTrigger value="users">Users ({filteredUsers.length})</TabsTrigger>
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
            <TabsTrigger value="security">Security Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* Filters and Controls */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex flex-col md:flex-row gap-4 flex-1">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="user-search"
                      />
                    </div>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-full md:w-48" data-testid="role-filter">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="analyst">Catalyst Team</SelectItem>
                        <SelectItem value="broker">Brokers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2" data-testid="add-user-button">
                        <Plus className="h-4 w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              value={newUser.firstName}
                              onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                              data-testid="new-user-first-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              value={newUser.lastName}
                              onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                              data-testid="new-user-last-name"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            data-testid="new-user-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            data-testid="new-user-password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                            <SelectTrigger data-testid="new-user-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="analyst">Analyst</SelectItem>
                              <SelectItem value="broker">Broker</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dealRole">Deal Dashboard Role</Label>
                          <Select
                            value={newUser.dealRole || ''}
                            onValueChange={(value) => setNewUser({ ...newUser, dealRole: value })}
                          >
                            <SelectTrigger data-testid="new-user-deal-role">
                              <SelectValue placeholder="Select deal role (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Managing Partner">Managing Partner</SelectItem>
                              <SelectItem value="Chief Investment Officer">Chief Investment Officer</SelectItem>
                              <SelectItem value="Regional Development Partner">Regional Development Partner</SelectItem>
                              <SelectItem value="Senior Finance Associate">Senior Finance Associate</SelectItem>
                              <SelectItem value="Development Associate">Development Associate</SelectItem>
                              <SelectItem value="Junior Analyst">Junior Analyst</SelectItem>
                              <SelectItem value="Analyst">Analyst</SelectItem>
                              <SelectItem value="Associate">Associate</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 pt-4">
                          <Button 
                            onClick={handleCreateUser}
                            disabled={createUserMutation.isPending}
                            className="flex-1"
                            data-testid="create-user-submit"
                          >
                            {createUserMutation.isPending ? "Creating..." : "Create User"}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsAddUserOpen(false)}
                            className="flex-1"
                            data-testid="create-user-cancel"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All Users ({filteredUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-lg"></div>
                    ))}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg mb-2">
                      {searchTerm || selectedRole !== 'all' ? 'No users match your filters' : 'No users found'}
                    </p>
                    <p className="text-sm">
                      {searchTerm || selectedRole !== 'all' ? 'Try adjusting your search or filters' : 'Users will appear here once they register'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="users-list">
                    {filteredUsers.map((user: User) => (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        data-testid={`user-${user.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            user.email === "jack@catalystcp.com" ? "bg-red-500" :
                            user.email.endsWith("@catalystcp.com") ? "bg-blue-500" : "bg-gray-500"
                          }`}>
                            {user.email === "jack@catalystcp.com" ? (
                              <Crown className="h-5 w-5 text-white" />
                            ) : (
                              <Users className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Calendar className="h-3 w-3" />
                              Joined {formatDateEST.date(user.createdAt)}
                            </div>
                            {user.dealRole && (
                              <div className="flex items-center gap-2 text-sm text-blue-600">
                                <Settings className="h-3 w-3" />
                                {user.dealRole}
                              </div>
                            )}
                            {isCatalystMember(user.email) && (
                              <>
                                {user.productTypes && user.productTypes.length > 0 && (
                                  <div className="flex items-center gap-2 text-sm text-green-600">
                                    <Building className="h-3 w-3" />
                                    Products: {user.productTypes.join(", ")}
                                  </div>
                                )}
                                {user.states && user.states.length > 0 && (
                                  <div className="flex items-center gap-2 text-sm text-purple-600">
                                    <MapPin className="h-3 w-3" />
                                    States: {user.states.join(", ")}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant={getRoleBadgeVariant(user.email)}>
                            {getRoleFromEmail(user.email)}
                          </Badge>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-1"
                              onClick={() => setEditingUser({
                                ...user,
                                productTypes: user.productTypes || [],
                                states: user.states || []
                              })}
                              data-testid={`edit-user-${user.id}`}
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                            {user.email !== "jack@catalystcp.com" && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-1 text-red-600 border-red-600 hover:bg-[#4A90E2] hover:text-white hover:border-[#4A90E2] transition-colors"
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                data-testid={`delete-user-${user.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Edit User Dialog */}
          <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
              </DialogHeader>
              {editingUser && (
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editFirstName">First Name</Label>
                      <Input
                        id="editFirstName"
                        value={editingUser.firstName}
                        onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                        data-testid="edit-user-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editLastName">Last Name</Label>
                      <Input
                        id="editLastName"
                        value={editingUser.lastName}
                        onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                        data-testid="edit-user-last-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEmail">Email</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      data-testid="edit-user-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="editPhone">Phone Number</Label>
                    <Input
                      id="editPhone"
                      type="tel"
                      value={editingUser.phone || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      data-testid="edit-user-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editUserType">User Type</Label>
                    <Select
                      value={editingUser.role || 'BROKER'}
                      onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                    >
                      <SelectTrigger data-testid="edit-user-type">
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BROKER">Broker</SelectItem>
                        <SelectItem value="TEAM">Catalyst Team</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!isCatalystMember(editingUser.email) && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="editBrokerage">Brokerage Company</Label>
                        <Input
                          id="editBrokerage"
                          value={editingUser.brokerage || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, brokerage: e.target.value })}
                          placeholder="ABC Realty"
                          data-testid="edit-user-brokerage"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="editMarkets">Markets Covered</Label>
                        <Input
                          id="editMarkets"
                          value={editingUser.marketsCovered?.join(', ') || ''}
                          onChange={(e) => setEditingUser({ 
                            ...editingUser, 
                            marketsCovered: e.target.value.split(',').map(m => m.trim()).filter(Boolean)
                          })}
                          placeholder="Charlotte, Raleigh, Atlanta"
                          data-testid="edit-user-markets"
                        />
                        <p className="text-xs text-muted-foreground">Separate multiple markets with commas</p>
                      </div>
                    </>
                  )}

                  {isCatalystMember(editingUser.email) && (
                    <div className="space-y-2">
                      <Label htmlFor="editDealRole">Deal Dashboard Role</Label>
                      <Select
                        value={editingUser.dealRole || ''}
                        onValueChange={(value) => setEditingUser({ ...editingUser, dealRole: value })}
                      >
                        <SelectTrigger data-testid="edit-user-deal-role">
                          <SelectValue placeholder="Select deal role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Managing Partner">Managing Partner</SelectItem>
                          <SelectItem value="Chief Investment Officer">Chief Investment Officer</SelectItem>
                          <SelectItem value="Regional Development Partner">Regional Development Partner</SelectItem>
                          <SelectItem value="Senior Finance Associate">Senior Finance Associate</SelectItem>
                          <SelectItem value="Development Associate">Development Associate</SelectItem>
                          <SelectItem value="Junior Analyst">Junior Analyst</SelectItem>
                          <SelectItem value="Analyst">Analyst</SelectItem>
                          <SelectItem value="Associate">Associate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Product Types and States - Only for Catalyst Members */}
                  {isCatalystMember(editingUser.email) && (
                    <>
                      <div className="space-y-3 pt-4 border-t">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Product Types
                        </Label>
                        <p className="text-sm text-muted-foreground">Select the product types this team member handles</p>
                        <div className="grid grid-cols-2 gap-3">
                          {PRODUCT_TYPES.map((productType) => (
                            <div key={productType} className="flex items-center space-x-2">
                              <Checkbox
                                id={`product-${productType}`}
                                checked={editingUser.productTypes?.includes(productType) || false}
                                onCheckedChange={() => toggleProductType(productType)}
                                data-testid={`product-type-${productType}`}
                              />
                              <Label 
                                htmlFor={`product-${productType}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {productType}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          States/Regions
                        </Label>
                        <p className="text-sm text-muted-foreground">Select the states/regions this team member covers</p>
                        <div className="grid grid-cols-4 gap-3">
                          {STATES.map((state) => (
                            <div key={state} className="flex items-center space-x-2">
                              <Checkbox
                                id={`state-${state}`}
                                checked={editingUser.states?.includes(state) || false}
                                onCheckedChange={() => toggleState(state)}
                                data-testid={`state-${state}`}
                              />
                              <Label 
                                htmlFor={`state-${state}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {state}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={() => handleUpdateUser(editingUser.id, {
                        firstName: editingUser.firstName,
                        lastName: editingUser.lastName,
                        email: editingUser.email,
                        phone: editingUser.phone,
                        role: editingUser.role,
                        dealRole: editingUser.dealRole,
                        productTypes: editingUser.productTypes,
                        states: editingUser.states,
                        marketsCovered: editingUser.marketsCovered,
                        brokerage: editingUser.brokerage
                      })}
                      disabled={updateUserMutation.isPending}
                      className="flex-1"
                      data-testid="edit-user-save"
                    >
                      {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingUser(null)}
                      className="flex-1"
                      data-testid="edit-user-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>


          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Role Management
                </CardTitle>
                <p className="text-sm text-muted-foreground">Define and manage user roles</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Partner Broker Portal Approvals */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" />
                        <h3 className="font-semibold text-gray-900">Partner Broker Approvals</h3>
                        {(pendingBrokers?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                            {pendingBrokers!.length}
                          </span>
                        )}
                      </div>
                      <button onClick={() => refetchPending()} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                        Refresh
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Brokers who registered via the Partner Broker Portal and are waiting for access.
                    </p>

                    {pendingLoading ? (
                      <div className="flex items-center gap-2 py-6 text-gray-400 text-sm">
                        <Loader2 size={16} className="animate-spin" /> Loading pending approvals…
                      </div>
                    ) : !pendingBrokers?.length ? (
                      <div className="flex items-center gap-3 py-6 px-4 rounded-lg bg-green-50 border border-green-100">
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        <p className="text-sm text-green-700">No pending broker approvals — you're all caught up.</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {pendingBrokers.map((broker) => (
                          <div key={broker.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm text-gray-900">
                                {broker.firstName} {broker.lastName}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Mail size={11} /> {broker.email}
                                </span>
                                {broker.brokerage && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Building size={11} /> {broker.brokerage}
                                  </span>
                                )}
                                {broker.phone && (
                                  <span className="text-xs text-gray-500">{broker.phone}</span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                Registered {new Date(broker.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="ml-4 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                              disabled={approveBrokerMutation.isPending}
                              onClick={() => approveBrokerMutation.mutate(broker.id)}
                            >
                              {approveBrokerMutation.isPending ? (
                                <Loader2 size={13} className="animate-spin mr-1" />
                              ) : (
                                <UserCheck size={13} className="mr-1" />
                              )}
                              Approve
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4" />

                  {/* Role Definitions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-2 border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Crown className="h-5 w-5 text-red-500" />
                          <h3 className="font-semibold text-red-700">Super Admin</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">Full system access and control</p>
                        <ul className="text-sm text-gray-500 space-y-1">
                          <li>• User management</li>
                          <li>• System settings</li>
                          <li>• Security controls</li>
                          <li>• All analytics</li>
                        </ul>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="h-5 w-5 text-blue-500" />
                          <h3 className="font-semibold text-blue-700">Catalyst Team</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">Internal team members</p>
                        <ul className="text-sm text-gray-500 space-y-1">
                          <li>• Deal management</li>
                          <li>• Broker oversight</li>
                          <li>• Analytics access</li>
                          <li>• Team collaboration</li>
                        </ul>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Eye className="h-5 w-5 text-gray-500" />
                          <h3 className="font-semibold text-gray-700">Broker</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">External broker partners</p>
                        <ul className="text-sm text-gray-500 space-y-1">
                          <li>• Deal submission</li>
                          <li>• Track submissions</li>
                          <li>• View commission</li>
                          <li>• Limited access</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground">Configure system security and access controls</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <Shield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Security Center</h3>
                    <p className="text-gray-500 mb-4">Advanced security settings and monitoring</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                      <Card className="p-4">
                        <h4 className="font-medium text-gray-700">Authentication</h4>
                        <p className="text-sm text-gray-500">Replit Auth enabled</p>
                      </Card>
                      <Card className="p-4">
                        <h4 className="font-medium text-gray-700">Authorization</h4>
                        <p className="text-sm text-gray-500">Role-based access</p>
                      </Card>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Footer />
    </div>
    </div>
  );
}