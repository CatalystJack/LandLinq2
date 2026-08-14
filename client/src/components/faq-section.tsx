import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

export default function FAQSection() {
  const faqs = [
    {
      question: "Are the +1% payouts on top of my commission?",
      answer: "Yes, both are additional fees."
    },
    {
      question: "How fast will I get paid?",
      answer: "• Rezoning = 10 business days\n• Closing = at deed transfer"
    },
    {
      question: "Who's eligible?",
      answer: "Any broker who submits a qualifying deal."
    },
    {
      question: "Will you re-trade?",
      answer: "No, unless due diligence finds a material issue."
    },
    {
      question: "How do I submit?",
      answer: "Email, text, or use the online form—whichever's fastest for you."
    }
  ];

  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-black tracking-tight" data-testid="text-faq-title">
            FAQ
          </h2>
        </div>

        <Accordion type="single" collapsible className="divide-y divide-gray-200 border-t border-b border-gray-200">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index}
              value={`item-${index}`}
              className="border-0"
              data-testid={`faq-item-${index}`}
            >
              <AccordionTrigger className="text-base font-normal text-black py-5 hover:no-underline hover:bg-transparent data-[state=open]:bg-transparent">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-gray-700 leading-relaxed pb-5 whitespace-pre-line">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
