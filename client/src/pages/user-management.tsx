import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Users, Shield, Settings, Edit, Trash2, Mail, Calendar, UserCheck, Crown, Building, MapPin } from "lucide-react";
import { formatDateEST } from "@/utils/timezone";
import Footer from "@/components/footer";
import Navigation from "@/components/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformAdminEmail, isSuperAdminEmail } from "@shared/admin-auth";

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
  mustResetPassword?: boolean;
  phone?: string;
  marketsCovered?: string[];
  brokerage?: string;
  companyName?: string;
}


interface NewUser {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  dealRole?: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const isCurrentUserSuperAdmin = isSuperAdminEmail(currentUser?.email);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resendingUser, setResendingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<NewUser>({
    email: "",
    firstName: "",
    lastName: "",
    role: "admin",
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
      setNewUser({ email: "", firstName: "", lastName: "", role: "admin", dealRole: "" });
      toast({
        title: "Success",
        description: "User created successfully. Login instructions were sent by email.",
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

  const resendInitialLoginMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}/resend-initial-login`, {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Failed to resend initial login email");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setResendingUser(null);
      toast({
        title: "Initial login sent",
        description: "A new temporary password was emailed. The recipient must set a new password after signing in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not resend initial login",
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

  const users = usersData?.users || [];

  const getRoleKey = (user: User) => {
    const role = String(user.role || "").toUpperCase();
    if (role === "DEVELOPER") return "developer";
    if (role === "ADMIN" || role === "SUPER_ADMIN" || isPlatformAdminEmail(user.email)) return "admin";
    return "broker";
  };

  const getRoleLabel = (user: User) => {
    switch (getRoleKey(user)) {
      case "developer":
        return user.companyName || "Investment Company Team";
      case "admin":
        return "Admin Team";
      default:
        return "Broker";
    }
  };

  // Filter users based on search and role
  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = selectedRole === "all" || getRoleKey(user) === selectedRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeVariant = (user: User) => {
    if (getRoleKey(user) === "admin") return "default";
    return "secondary";
  };

  const handleCreateUser = () => {
    if (!newUser.email || !newUser.firstName || !newUser.lastName) {
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
    
    console.log('🔐 [DELETE] Permission check:', {
      currentEmail,
      matches: isSuperAdminEmail(currentEmail)
    });
    
    if (!isSuperAdminEmail(currentEmail)) {
      console.error('❌ [DELETE] Permission denied - user is not a super admin');
      toast({
        title: "Permission Denied",
        description: `Only super administrators can delete users. You are logged in as: ${currentUser?.email || 'unknown'}`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    // Platform-domain accounts are protected from deletion.
    if (isPlatformAdminEmail(userEmail)) {
      console.error('❌ [DELETE] Cannot delete platform admin account');
      toast({
        title: "Error",
        description: "Cannot delete a platform admin account",
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
        <PageHeader
          title="User Management"
          description="Manage user accounts, broker profiles, roles, and permissions"
        />

        <div className="space-y-6">
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
                        <SelectItem value="admin">Admin Team</SelectItem>
                        <SelectItem value="developer">Investment Company Team</SelectItem>
                        <SelectItem value="broker">Brokers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    {isCurrentUserSuperAdmin && (
                      <DialogTrigger asChild>
                        <Button className="gap-2" data-testid="add-user-button">
                          <Plus className="h-4 w-4" />
                          Add User
                        </Button>
                      </DialogTrigger>
                    )}
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
                        <p className="text-sm text-muted-foreground">
                          A secure temporary password will be generated and emailed to the new user. They will be required to change it after signing in.
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                            <SelectTrigger data-testid="new-user-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
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
                            isSuperAdminEmail(user.email) ? "bg-red-500" :
                            isPlatformAdminEmail(user.email) ? "bg-blue-500" :
                            user.email.endsWith("@catalystcp.com") ? "bg-blue-500" : "bg-gray-500"
                          }`}>
                            {isSuperAdminEmail(user.email) ? (
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
                            {user.mustResetPassword && (
                              <Badge variant="outline" className="mt-1 border-amber-300 text-amber-800">
                                Initial login pending
                              </Badge>
                            )}
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
                        <Badge variant={getRoleBadgeVariant(user)}>
                          {getRoleLabel(user)}
                          </Badge>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                          <div className="flex gap-2">
                            {isCurrentUserSuperAdmin && user.mustResetPassword && user.id !== currentUser?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => setResendingUser(user)}
                                data-testid={`resend-initial-login-${user.id}`}
                              >
                                <Mail className="h-3 w-3" />
                                Resend login
                              </Button>
                            )}
                            {isCurrentUserSuperAdmin && (
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
                            )}
                            {isCurrentUserSuperAdmin && !isPlatformAdminEmail(user.email) && (
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
                    <Label htmlFor="editUserType">Access Role</Label>
                     {editingUser.role === "DEVELOPER" ? (
                       <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                         Investment Company Team accounts are managed through the company invitation flow.
                       </p>
                     ) : (
                       <Select
                         value={editingUser.role === "SUPER_ADMIN" ? "ADMIN" : (editingUser.role || "ADMIN")}
                         onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                         disabled={editingUser.role === "SUPER_ADMIN"}
                       >
                         <SelectTrigger data-testid="edit-user-type">
                           <SelectValue placeholder="Select user type" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="ADMIN">Admin Team</SelectItem>
                         </SelectContent>
                       </Select>
                     )}
                    {editingUser.role === "SUPER_ADMIN" && (
                      <p className="text-xs text-slate-500">This protected system administrator account retains its existing authority.</p>
                    )}
                  </div>

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

          <Dialog
            open={resendingUser !== null}
            onOpenChange={(open) => {
              if (!open && !resendInitialLoginMutation.isPending) setResendingUser(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Resend initial login?</DialogTitle>
                <DialogDescription>
                  A new temporary password will be emailed to {resendingUser?.email}. This replaces the previous temporary password, and the recipient will still need to choose a new password at sign-in.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setResendingUser(null)}
                  disabled={resendInitialLoginMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => resendingUser && resendInitialLoginMutation.mutate(resendingUser.id)}
                  disabled={!resendingUser || resendInitialLoginMutation.isPending}
                >
                  {resendInitialLoginMutation.isPending ? "Sending..." : "Send login email"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


        </div>
        <Footer />
    </div>
    </div>
  );
}