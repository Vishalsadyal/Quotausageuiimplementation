import { useState, useEffect } from "react";
import { Zap, Clock, Check, ShieldCheck, ArrowRight, Flame, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

async function ensureRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;
  const existing = document.querySelector<HTMLScriptElement>('script[data-rzp="1"]');
  if (existing) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.rzp = "1";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function DashboardPromoBanner() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 1,
    minutes: 45,
    seconds: 30,
  });

  // Urgency Countdown Timer initialized with localStorage persistence
  useEffect(() => {
    const storageKey = "cp_promo_countdown_target";
    let targetTime = Number(localStorage.getItem(storageKey));
    const now = Date.now();

    if (!targetTime || targetTime < now) {
      // 2 hours from now
      targetTime = now + 2 * 60 * 60 * 1000;
      localStorage.setItem(storageKey, String(targetTime));
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, targetTime - Date.now());
      if (remaining <= 0) {
        // Reset 2 hours loop for consistent urgency
        const next = Date.now() + 2 * 60 * 60 * 1000;
        localStorage.setItem(storageKey, String(next));
        return;
      }
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't show banner if user is already pro or coach
  if (user?.plan === "pro" || user?.plan === "coach") {
    return null;
  }

  const handleQuickCheckout = async () => {
    try {
      setLoading(true);
      const scriptReady = await ensureRazorpayScript();
      if (!scriptReady) {
        toast.error("Unable to load payment gateway. Please check your internet connection.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/billing/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `banner_promo_${user?.id}_${Date.now()}`,
        },
        body: JSON.stringify({ plan: "pro" }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to initiate payment");
      }

      const orderData = data.data;

      const rzp = new (window.Razorpay as any)({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AutoApply CV",
        description: "Pro Upgrade - ₹49 Flash Offer",
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#7C3AED",
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setLoading(true);
            const verifyRes = await fetch("/api/billing/order/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan: "pro",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.message || "Verification failed");
            }

            toast.success("🎉 Upgrade successful! You now have full Pro Auto-Apply access.");
            await refreshUser();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Payment verification failed");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open checkout");
      setLoading(false);
    }
  };

  const formatDigit = (num: number) => String(num).padStart(2, "0");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-800 text-white shadow-xl border border-purple-400/30 p-5 md:p-6 mb-4">
      {/* Background Decorative Elements */}
      <div className="absolute -right-12 -top-12 w-56 h-56 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left Side: Offer Info */}
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-300 font-bold text-xs tracking-wide">
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              EXCLUSIVE FLASH OFFER • 90% OFF
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 text-purple-100 text-xs font-medium">
              <Sparkles className="w-3 h-3 text-purple-300" />
              Active Job Seeker Deal
            </span>
          </div>

          <div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight leading-snug">
              Boost Your Interviews: Get Pro Auto-Apply for only{" "}
              <span className="text-amber-300 underline decoration-amber-400 decoration-wavy underline-offset-4">
                ₹49
              </span>{" "}
              <span className="text-sm md:text-base line-through text-purple-300 font-normal ml-1">
                ₹499
              </span>
            </h2>
            <p className="text-xs md:text-sm text-purple-100 mt-1 leading-relaxed">
              Skip the 3/day free cap. Apply to hundreds of verified jobs on LinkedIn & Indeed automatically and unlock direct recruiter contacts.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-purple-100 font-medium">
              <div className="w-4 h-4 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <span>Unlimited Auto-Applies</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-purple-100 font-medium">
              <div className="w-4 h-4 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <span>HR Recruiter Emails & Phones</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-purple-100 font-medium">
              <div className="w-4 h-4 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <span>AI Resume & Match Boost</span>
            </div>
          </div>
        </div>

        {/* Right Side: Urgency Timer & 1-Click Action */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-center lg:items-end justify-between w-full lg:w-auto gap-4 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 shrink-0">
          {/* Countdown Clock */}
          <div className="text-center lg:text-right">
            <div className="flex items-center gap-1.5 text-[11px] text-purple-200 font-medium mb-1.5 justify-center lg:justify-end">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>Offer expires in:</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
              <div className="bg-black/30 border border-white/20 rounded-md px-2 py-1 text-white text-center min-w-[32px]">
                {formatDigit(timeLeft.hours)}
                <span className="text-[9px] block text-purple-300 font-sans font-normal">hrs</span>
              </div>
              <span className="text-amber-300 font-bold">:</span>
              <div className="bg-black/30 border border-white/20 rounded-md px-2 py-1 text-white text-center min-w-[32px]">
                {formatDigit(timeLeft.minutes)}
                <span className="text-[9px] block text-purple-300 font-sans font-normal">min</span>
              </div>
              <span className="text-amber-300 font-bold">:</span>
              <div className="bg-black/30 border border-white/20 rounded-md px-2 py-1 text-white text-center min-w-[32px]">
                {formatDigit(timeLeft.seconds)}
                <span className="text-[9px] block text-purple-300 font-sans font-normal">sec</span>
              </div>
            </div>
          </div>

          {/* 1-Click Pay Button */}
          <div className="w-full sm:w-auto">
            <button
              onClick={handleQuickCheckout}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-gray-950 font-black text-sm rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-gray-950" />
                  <span>Connecting to UPI...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-gray-950 text-gray-950" />
                  <span>Upgrade to Pro for ₹49</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-purple-200 mt-2 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Instant UPI & Card Activation • 100% Safe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
