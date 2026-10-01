import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, Circle, Mail, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type OnboardingStatus = {
  profileId: string;
  profileType: string;
  checks: {
    profileReady: boolean;
    contactsAdded: boolean;
    emailConnected: boolean;
    teamInvited: number;
    criteriaSet: boolean;
    pipelineConfigured: boolean;
  };
};

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  optional: boolean;
  href: string;
  actionLabel: string;
  icon: typeof Building2;
};

const SKIPPED_STEPS_KEY_PREFIX = "developer-onboarding-skipped:";

function readSkippedSteps(storageKey: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.filter((step): step is string => typeof step === "string") : [];
  } catch {
    return [];
  }
}

export default function DeveloperOnboardingChecklist() {
  const [, navigate] = useLocation();
  const { data: status, isError, isFetching, refetch } = useQuery<OnboardingStatus>({
    queryKey: ["/api/developer-profile/me/onboarding-status"],
    queryFn: async () => {
      const response = await fetch("/api/developer-profile/me/onboarding-status", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load company setup checklist");
      return response.json();
    },
  });
  const storageKey = status?.profileId ? `${SKIPPED_STEPS_KEY_PREFIX}${status.profileId}` : null;
  const [skippedSteps, setSkippedSteps] = useState<string[]>([]);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!status?.profileId || !storageKey) return;
    setSkippedSteps(readSkippedSteps(storageKey));
    setLoadedProfileId(status.profileId);
  }, [status?.profileId, storageKey]);

  const isGeneralSales = status?.profileType === "general_sales";
  const steps = useMemo<OnboardingStep[]>(() => {
    if (!status) return [];
    return [
      {
        id: "profile",
        title: "Review company profile",
        description: "Confirm your company details and workspace settings.",
        complete: status.checks.profileReady,
        optional: false,
        href: "/developer/settings",
        actionLabel: "Open profile",
        icon: Building2,
      },
      {
        id: "team",
        title: "Set up your team",
        description: "Add a teammate when you are ready to work together.",
        complete: status.checks.teamInvited > 0,
        optional: true,
        href: "/developer/user-management",
        actionLabel: "View team",
        icon: Users,
      },
      {
        id: "contacts",
        title: "Add your first contacts",
        description: "Add a contact or import a list into your company CRM.",
        complete: status.checks.contactsAdded,
        optional: true,
        href: "/developer/crm",
        actionLabel: "Open contacts",
        icon: Users,
      },
      {
        id: "email",
        title: "Connect your email",
        description: "Connect a sender to use company outreach tools.",
        complete: status.checks.emailConnected,
        optional: true,
        href: "/outreach-onboarding",
        actionLabel: "Connect email",
        icon: Mail,
      },
      isGeneralSales
        ? {
            id: "pipeline",
            title: "Review your sales pipeline",
            description: "Check the stages your team will use to track opportunities.",
            complete: status.checks.pipelineConfigured,
            optional: true,
            href: "/developer/pipeline",
            actionLabel: "Open pipeline",
            icon: BriefcaseBusiness,
          }
        : {
            id: "markets",
            title: "Set markets and acquisition criteria",
            description: "Choose target markets and property types for deal screening.",
            complete: status.checks.criteriaSet,
            optional: true,
            href: "/developer/criteria",
            actionLabel: "Set criteria",
            icon: MapPin,
          },
    ];
  }, [isGeneralSales, status]);

  if (isError) {
    return (
      <Card className="mb-6 flex flex-col gap-3 border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
        <p className="text-sm text-amber-950">Company setup steps could not be loaded.</p>
        <Button type="button" size="sm" variant="outline" className="h-10" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Retrying..." : "Try again"}
        </Button>
      </Card>
    );
  }

  if (!status || loadedProfileId !== status.profileId || !storageKey) return null;

  const handledSteps = steps.filter((step) => step.complete || skippedSteps.includes(step.id)).length;
  if (handledSteps === steps.length) return null;

  const skipStep = (stepId: string) => {
    if (!storageKey) return;
    const next = Array.from(new Set([...skippedSteps, stepId]));
    setSkippedSteps(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Keep the current session usable if browser storage is unavailable.
    }
  };

  const restoreStep = (stepId: string) => {
    if (!storageKey) return;
    const next = skippedSteps.filter((id) => id !== stepId);
    setSkippedSteps(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Keep the current session usable if browser storage is unavailable.
    }
  };

  const progress = Math.round((handledSteps / steps.length) * 100);

  return (
    <Card className="mb-6 overflow-hidden border-[#b8d8f5] bg-white shadow-sm" data-testid="card-developer-onboarding-checklist">
      <div className="border-l-4 border-[#4A90E2] px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2f73bb]">Getting started</p>
            <h2 className="mt-1 font-serif text-xl text-[#07172A]">Set up your company workspace</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-600">
              {isGeneralSales
                ? "Review the basics and shape a workspace your sales team can use together."
                : "Review the basics so your team can organize and screen opportunities."}
              {" "}Optional steps can be skipped and revisited later.
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-slate-600" aria-live="polite">
            {handledSteps} of {steps.length} steps complete or skipped
          </span>
        </div>

        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Company setup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full rounded-full bg-[#498EDE] transition-[width]" style={{ width: `${progress}%` }} />
        </div>

        <ol className="mt-4 space-y-2">
          {steps.map((step, index) => {
            const skipped = !step.complete && skippedSteps.includes(step.id);
            const StepIcon = step.icon;
            return (
              <li
                key={step.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
                data-testid={`onboarding-step-${step.id}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  step.complete ? "bg-emerald-100 text-emerald-700" : skipped ? "bg-slate-200 text-slate-500" : "bg-white text-[#498EDE]"
                }`}>
                  {step.complete ? <CheckCircle2 className="h-5 w-5" /> : skipped ? <Circle className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step {index + 1}</span>
                    <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
                    {step.optional && !step.complete && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">Optional</span>
                    )}
                    {step.complete && (
                      <span className="text-xs font-medium text-emerald-700">Complete</span>
                    )}
                    {skipped && (
                      <span className="text-xs font-medium text-slate-500">Skipped</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{step.description}</p>
                </div>
                <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
                  {!step.complete && !skipped && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="h-10 flex-1 border border-[#498EDE] bg-[#498EDE] text-white hover:border-[#9dcaf2] hover:bg-white hover:text-[#498EDE] sm:flex-none"
                        onClick={() => navigate(step.href)}
                      >
                        {step.actionLabel}<ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      {step.optional && (
                        <Button type="button" size="sm" variant="outline" className="h-10" onClick={() => skipStep(step.id)}>
                          Skip
                        </Button>
                      )}
                    </>
                  )}
                  {skipped && (
                    <Button type="button" size="sm" variant="outline" className="h-10" onClick={() => restoreStep(step.id)}>
                      Undo skip
                    </Button>
                  )}
                  {step.complete && <span className="self-center px-2 text-sm font-medium text-emerald-700">Done</span>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}