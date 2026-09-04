import { useQuery } from "@tanstack/react-query";
import { Mail, ShieldCheck, Users, Loader2 } from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const teamQuery = useQuery<{ team: TeamMember[] }>({
    queryKey: ["/api/developer-profile/me/team"],
    queryFn: () => jsonRequest("/api/developer-profile/me/team"),
  });

  const team = Array.isArray(teamQuery.data?.team) ? teamQuery.data.team : [];
  const requestHref = "mailto:help@landlinq.ai?subject=Team%20member%20addition%20request&body=Requested%20teammate%20name%3A%0ARequested%20teammate%20email%3A%0AReason%20for%20access%3A%0A%0APlease%20review%20and%20approve%20this%20addition.";

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4A90E2]">Organization</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">User Management</h1>
            <p className="mt-2 text-slate-500">View the users who belong to your company portal.</p>
          </div>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-background hover:text-primary hover:ring-1 hover:ring-primary">
            <a href={requestHref}><Mail className="mr-2 h-4 w-4" /> Request teammate addition</a>
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
              Only users assigned to your current company are shown here. LandLinq/Apex approves and creates all accounts.
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
                <p className="mt-1 text-sm text-slate-500">Request an addition and LandLinq/Apex will review and create the account.</p>
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

    </div>
  );
}