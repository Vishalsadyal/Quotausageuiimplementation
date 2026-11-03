import { useEffect, useState } from "react";

// A short job-hunt quote for loading screens. Attributed only where the source is certain.
const QUOTES: Array<{ text: string; by?: string }> = [
  { text: "The only way to do great work is to love what you do.", by: "Steve Jobs" },
  { text: "Do what you can, with what you have, where you are.", by: "Theodore Roosevelt" },
  { text: "Every application is one step closer to the offer letter." },
  { text: "A 'no' today is just practice for the 'yes' that's coming." },
  { text: "Your next job is out there. Let's go find it." },
  { text: "Small steps every day add up to big results." },
  { text: "Consistency beats luck. Keep applying." },
  { text: "The right company is looking for someone exactly like you." },
  { text: "Rejection is redirection." },
  { text: "Show up, apply, follow up. Repeat." },
];

export function LoadingQuote({ className = "" }: { className?: string }) {
  // Picked after mount, so the server-rendered first quote and the browser's agree.
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(Math.floor(Math.random() * QUOTES.length));
  }, []);
  const quote = QUOTES[index];
  return (
    <figure className={`max-w-md text-center ${className}`}>
      <blockquote className="text-base font-medium italic text-slate-700 text-balance">“{quote.text}”</blockquote>
      {quote.by ? <figcaption className="mt-1.5 text-xs font-semibold text-slate-500">{quote.by}</figcaption> : null}
    </figure>
  );
}
