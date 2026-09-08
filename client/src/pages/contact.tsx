import { useState } from "react";
import { CheckCircle2, Mail, MessageSquare } from "lucide-react";
import Navigation from "@/components/navigation";
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
    <div className="min-h-[100dvh] bg-[#f7f9fc] text-[#18324a]">
      <Navigation />

      <main>
        <section className="border-b border-[#e2eaf1] bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-landlinq-blue">Get in touch</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Contact us</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#61778d] sm:text-lg">
              Have a question about LandLinq or want to see how it can support your team? Send us a message and we’ll get back to you.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <aside className="rounded-2xl border border-[#dbe6ef] bg-white p-7 shadow-sm sm:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f7fc] text-landlinq-blue">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em]">Let’s talk</h2>
              <p className="mt-3 leading-7 text-[#61778d]">
                Tell us what you’re working on, what your team needs, or where your current process is slowing you down.
              </p>

              <div className="mt-8 border-t border-[#e5edf4] pt-6">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-landlinq-blue" />
                  <div>
                    <p className="text-sm font-semibold text-[#18324a]">Email us directly</p>
                    <a href="mailto:help@landlinq.ai" className="mt-1 inline-block text-sm text-landlinq-blue underline-offset-4 hover:underline">
                      help@landlinq.ai
                    </a>
                  </div>
                </div>
              </div>
            </aside>

            <div className="rounded-2xl border border-[#dbe6ef] bg-white p-7 shadow-sm sm:p-8 lg:p-10">
              {status === "success" ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Message sent</h2>
                  <p className="mt-3 max-w-md leading-7 text-[#61778d]">
                    Thanks for reaching out. Our team will get back to you soon.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="mt-7 inline-flex h-12 items-center rounded-lg border border-primary bg-primary px-5 text-sm font-semibold text-white transition-all hover:border-landlinq-sky hover:bg-white hover:text-landlinq-blue"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-7">
                    <h2 className="text-2xl font-semibold tracking-[-0.04em]">Send us a message</h2>
                    <p className="mt-2 text-sm leading-6 text-[#61778d]">We’ll review your note and respond as soon as we can.</p>
                  </div>

                  <form onSubmit={submit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#35516a]">
                        <span className="mb-2 block">Name</span>
                        <input
                          required
                          value={form.name}
                          onChange={(event) => updateField("name", event.target.value)}
                          className="h-12 w-full rounded-lg border border-[#cbd9e5] bg-white px-4 text-base text-[#18324a] outline-none transition placeholder:text-[#8ba0b2] focus:border-landlinq-blue focus:ring-2 focus:ring-[#4fbfe8]/20"
                          placeholder="Your name"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#35516a]">
                        <span className="mb-2 block">Email</span>
                        <input
                          required
                          type="email"
                          value={form.email}
                          onChange={(event) => updateField("email", event.target.value)}
                          className="h-12 w-full rounded-lg border border-[#cbd9e5] bg-white px-4 text-base text-[#18324a] outline-none transition placeholder:text-[#8ba0b2] focus:border-landlinq-blue focus:ring-2 focus:ring-[#4fbfe8]/20"
                          placeholder="you@company.com"
                        />
                      </label>
                    </div>

                    <label className="block text-sm font-medium text-[#35516a]">
                      <span className="mb-2 block">Message</span>
                      <textarea
                        required
                        rows={7}
                        value={form.message}
                        onChange={(event) => updateField("message", event.target.value)}
                        className="w-full resize-y rounded-lg border border-[#cbd9e5] bg-white px-4 py-3 text-base leading-7 text-[#18324a] outline-none transition placeholder:text-[#8ba0b2] focus:border-landlinq-blue focus:ring-2 focus:ring-[#4fbfe8]/20"
                        placeholder="How can we help?"
                      />
                    </label>

                    {status === "error" && <p role="alert" className="text-sm text-red-600">{error}</p>}

                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="inline-flex h-12 items-center rounded-lg border border-primary bg-primary px-6 text-sm font-semibold text-white transition-all hover:border-landlinq-sky hover:bg-white hover:text-landlinq-blue disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {status === "sending" ? "Sending…" : "Send message"}
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