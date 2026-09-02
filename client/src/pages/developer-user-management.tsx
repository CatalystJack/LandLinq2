import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, ShieldCheck, Users, Loader2 } from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type TeamMember = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
};

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

export default function DeveloperUserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const teamQuery = useQuery<{ team: TeamMember[] }>({
    queryKey: ["/api/developer-profile/me/team"],
    queryFn: () => jsonRequest("/api/developer-profile/me/team"),
  });

  const inviteMutation = useMutation({
    mutationFn: () => jsonRequest("/api/developer-profile/me/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/team"] });
      setInviteOpen(false);
      setName("");
      setEmail("");
      toast({
        title: "Team member invited",
        description: data.emailSent === false
          ? "The account was created, but the invitation email could not be sent."
          : "An invitation with a temporary password was sent.",
      });
    },
    onError: (error: Error) => toast({
      title: "Could not send invitation",
      description: error.message,
      variant: "destructive",
    }),
  });

  const team = Array.isArray(teamQuery.data?.team) ? teamQuery.data.team : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4A90E2]">Organization</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">User Management</h1>
            <p className="mt-2 text-slate-500">Manage the users who belong to your Investment Company portal.</p>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="bg-[#0A2B4A] text-white hover:bg-[#123d61]">
            <Plus className="mr-2 h-4 w-4" /> Invite user
          </Button>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Users className="h-5 w-5 text-[#4A90E2]" />
              Organization users
              <Badge variant="secondary" className="ml-1">{team.length}</Badge>
            </CardTitle>
            <CardDescription>
              Only users assigned to your current Investment Company are shown here.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {teamQuery.isLoading ? (
              <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : teamQuery.isError ? (
              <div className="px-6 py-12 text-center text-sm text-red-600">
                {(teamQuery.error as Error).message}
              </div>
            ) : team.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <ShieldCheck className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">No other users yet</p>
                <p className="mt-1 text-sm text-slate-500">Invite a teammate to give them access to this company portal.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {team.map((member) => (
                  <div key={member.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {[member.firstName, member.lastName].filter(Boolean).join(" ") || "Unnamed user"}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                        <Mail className="h-3.5 w-3.5" /> {member.email}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">
                      Added {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              The invitee will receive access to this Investment Company only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="developer-user-name">Name</Label>
              <Input id="developer-user-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="developer-user-email">Email</Label>
              <Input id="developer-user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !name.trim() || !email.trim()}
              className="bg-[#0A2B4A] text-white hover:bg-[#123d61]"
            >
              {inviteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}