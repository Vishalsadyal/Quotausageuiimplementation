// The Chrome logo in its own colors (lucide's Chrome icon is a single-color outline).
// Three 120° segments around a white ring and a blue center.
export function ChromeLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="4 4 40 40" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 15h17.86A20 20 0 0 0 7.28 13.03l8.93 15.47L24 24z" />
      <path fill="#FBBC04" d="M31.79 28.5l-8.93 15.47A20 20 0 0 0 41.86 15H24v9z" />
      <path fill="#34A853" d="M16.21 28.5l-8.93-15.47a20 20 0 0 0 15.58 30.94l8.93-15.47L24 24z" />
      <circle cx="24" cy="24" r="9" fill="#fff" />
      <circle cx="24" cy="24" r="7.2" fill="#4285F4" />
    </svg>
  );
}
