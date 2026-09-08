import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, MessageSquare, Sparkles } from "lucide-react";
import { Link } from "wouter";
import Footer from "@/components/footer";

type ContactStatus = "idle" | "sending" | "success" | "error";

const initialForm = { name: "", email: "", message: "" };

export default function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [error, setError] = useState("");

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (status === "error") {
      setStatus("idle");
      setError("");
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setError("");

    try {
      const response = await fetch("/api/contact-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "We could not send your message.");
      setStatus("success");
      setForm(initialForm);
    } catch (submissionError) {
      setStatus("error");
      setError(submissionError instanceof Error ? submissionError.message : "We could not send your message.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f5f8fc] text-[#18324a]">
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-10" aria-label="Contact page navigation">
          <Link href="/" aria-label="LandLinq home">
            <img src="/assets/landlinq-white-logo.png" alt="LandLinq" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-white hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
            <Link href="/login" className="hidden rounded-full border border-white/35 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-landlinq-sky hover:bg-white hover:text-landlinq-blue sm:inline-flex">
              Log in
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden bg-primary px-5 pb-32 pt-32 text-white sm:px-8 sm:pb-44 sm:pt-40 lg:px-10">
          <div className="ll-grid absolute inset-0 opacity-20" />
          <div className="relative mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Start a conversation</p>
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl">
                Let’s make the next decision clearer.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/68">
                Tell us where your team is spending too much time. We’ll show you how LandLinq can turn more opportunities into focused, actionable work.
              </p>
            </div>
          </div>
        </section>

        <section className="relative px-5 pb-24 sm:px-8 sm:pb-32 lg:px-10">
          <div className="mx-auto -mt-16 grid max-w-7xl gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
            <aside className="rounded-3xl border border-[#d9e6f1] bg-white p-7 shadow-xl shadow-[#18324a]/8 sm:p-9">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f7fc] text-landlinq-blue">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-7 text-2xl font-semibold tracking-[-0.04em]">A better way to cover more ground.</h2>
              <p className="mt-4 leading-7 text-[#61778d]">
                Whether you are evaluating land, building a sales pipeline, or trying to keep outreach moving, we’d like to understand the workflow behind it.
              </p>
              <div className="mt-8 space-y-5 border-t border-[#e5edf4] pt-7">
                <div className="flex gap-3">
                  <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-landlinq-blue" />
                  <div>
                    <p className="font-semibold">Tell us what you’re solving</p>
                    <p className="mt-1 text-sm leading-6 text-[#61778d]">A few details help us make the first conversation useful.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-landlinq-blue" />
                  <div>
                    <p className="font-semibold">Prefer email?</p>
                    <a href="mailto:help@landlinq.ai" className="mt-1 inline-block text-sm text-landlinq-blue underline-offset-4 hover:underline">help@landlinq.ai</a>
                  </div>
                </div>
              </div>
            </aside>

            <div className="rounded-3xl bg-primary p-7 text-white shadow-xl shadow-[#18324a]/15 sm:p-10 lg:p-12">
              {status === "success" ? (
                <div className="flex min-h-[390px] flex-col items-start justify-center">
                  <CheckCircle2 className="h-12 w-12 text-[#55c3e9]" />
                  <h2 className="mt-7 text-3xl font-semibold tracking-[-0.04em]">Thanks for reaching out.</h2>
                  <p className="mt-4 max-w-md leading-7 text-white/65">Your message is on its way to our team. We’ll be in touch soon.</p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="mt-8 inline-flex h-12 items-center gap-3 rounded-full border border-landlinq-sky bg-landlinq-sky px-6 text-sm font-semibold text-primary transition-all hover:border-landlinq-sky hover:bg-white hover:text-landlinq-blue"
                  >
                    Send another message
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">Contact LandLinq</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">What can we help you move forward?</h2>
                  </div>
                  <form onSubmit={submit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="space-y-2 text-sm font-medium">
                        <span className="text-white/75">Your name</span>
                        <input
                          required
                          value={form.name}
                          onChange={(event) => updateField("name", event.target.value)}
                          className="h-13 w-full rounded-2xl border border-white/20 bg-white/8 px-4 text-base text-white outline-none transition focus:border-[#55c3e9] focus:ring-2 focus:ring-[#55c3e9]/20"
                          placeholder="Jane Smith"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        <span className="text-white/75">Work email</span>
                        <input
                          required
                          type="email"
                          value={form.email}
                          onChange={(event) => updateField("email", event.target.value)}
                          className="h-13 w-full rounded-2xl border border-white/20 bg-white/8 px-4 text-base text-white outline-none transition focus:border-[#55c3e9] focus:ring-2 focus:ring-[#55c3e9]/20"
                          placeholder="jane@company.com"
                        />
                      </label>
                    </div>
                    <label className="block space-y-2 text-sm font-medium">
                      <span className="text-white/75">How can we help?</span>
                      <textarea
                        required
                        rows={7}
                        value={form.message}
                        onChange={(event) => updateField("message", event.target.value)}
                        className="w-full resize-none rounded-2xl border border-white/20 bg-white/8 px-4 py-3 text-base leading-7 text-white outline-none transition focus:border-[#55c3e9] focus:ring-2 focus:ring-[#55c3e9]/20"
                        placeholder="Tell us about your team, workflow, or the opportunity you’re trying to improve."
                      />
                    </label>
                    {status === "error" && <p role="alert" className="text-sm text-red-200">{error}</p>}
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="inline-flex h-13 items-center gap-3 rounded-full border border-landlinq-sky bg-landlinq-sky px-7 text-sm font-semibold text-primary transition-all hover:border-landlinq-sky hover:bg-white hover:text-landlinq-blue disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {status === "sending" ? "Sending…" : "Send message"}
                      {status !== "sending" && <ArrowRight className="h-4 w-4" />}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}