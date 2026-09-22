import { useEffect, useMemo, useState } from "react";
import {
  Coins,
  RefreshCw,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  Crown,
  Check,
  Sparkles,
  Flame,
  ShieldCheck,
  Loader2,
  Users,
  ArrowRight,
  Layers,
  Star,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useExtensionPipelineStats } from "../../hooks/useExtensionPipelineStats";
import { toast } from "sonner";

type WalletSummary = {
  plan: "free" | "pro" | "coach";
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  freeRemaining: number;
  dailyUsed: number;
  dailyCap: number;
  dailyRemaining: number;
  spendable: number;
  dailyResetTime: string;
};

type WalletTxn = {
  id: string;
  type: "credit_purchase" | "credit_bonus" | "debit_apply" | "refund_apply" | "admin_adjustment";
  status: "posted" | "voided";
  amount: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
};

type TopupOrder = {
  provider: "razorpay";
  orderId: string;
  amount: number;
  currency: string;
  baseRupees: number;
  finalRupees: number;
  discountRupees: number;
  discountCode?: string | null;
  rupees: number;
  hires: number;
  keyId: string;
  minTopupRupees: number;
  conversion: string;
};

type DiscountPreview = {
  code: string;
  description?: string | null;
  baseRupees: number;
  discountRupees: number;
  finalRupees: number;
  hires: number;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

async function ensureRazorpayScript() {
  if (window.Razorpay) return true;
  const existing = document.querySelector<HTMLScriptElement>('script[data-rzp="1"]');
  if (existing) return true;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.rzp = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script"));
    document.body.appendChild(script);
  });
  return Boolean(window.Razorpay);
}

export default function Billing() {
  const { user, refreshUser } = useAuth();
  const extensionStats = useExtensionPipelineStats();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTopup, setProcessingTopup] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [usdAmount, setUsdAmount] = useState(1.0);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const INR_PER_USD = 92.5;
  const minTopupRupees = 49;
  const minTopupUsd = 0.54;
  const minTopupUsdCents = Math.round(minTopupUsd * 100);

  const loadWallet = async () => {
    try {
      setLoading(true);
      const [walletRes, txRes] = await Promise.all([
        fetch("/api/wallet", { credentials: "include" }),
        fetch("/api/wallet/transactions?limit=50", { credentials: "include" }),
      ]);
      const walletData = await walletRes.json();
      const txData = await txRes.json();
      if (!walletRes.ok || !walletData?.success) {
        throw new Error(walletData?.message || "Failed to fetch wallet");
      }
      setWallet(walletData.data as WalletSummary);
      setTxns((txData?.data?.transactions || []) as WalletTxn[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWallet();
  }, []);

  const currentPlan = user?.plan || wallet?.plan || "free";

  const formattedReset = useMemo(() => {
    if (!wallet?.dailyResetTime) return "-";
    return new Date(wallet.dailyResetTime).toLocaleString();
  }, [wallet?.dailyResetTime]);

  const mergedDailyUsage = useMemo(() => {
    const cap = Math.max(1, wallet?.dailyCap ?? 3);
    const baseUsed = wallet?.dailyUsed ?? 0;
    const extensionUsedToday = extensionStats.loaded ? extensionStats.appliedToday : 0;
    const used = Math.min(cap, Math.max(baseUsed, extensionUsedToday));
    const remaining = Math.max(0, cap - used);
    const spendableBase = wallet?.spendable ?? 0;
    const spendable = Math.max(0, Math.min(spendableBase, remaining));
    return { used, cap, remaining, spendable };
  }, [wallet?.dailyCap, wallet?.dailyUsed, wallet?.spendable, extensionStats.loaded, extensionStats.appliedToday]);

  const usdAmountCents = Math.round((Number.isFinite(usdAmount) ? usdAmount : 0) * 100);
  const belowMinUsd = !Number.isFinite(usdAmount) || usdAmountCents < minTopupUsdCents;
  const effectiveUsdAmount = belowMinUsd ? minTopupUsd : usdAmount;
  const computedRupees = Math.max(minTopupRupees, Math.round(effectiveUsdAmount * INR_PER_USD));
  const computedHires = Math.max(0, computedRupees);

  useEffect(() => {
    setDiscountPreview((prev) => {
      if (!prev) return prev;
      if (prev.baseRupees === computedRupees) return prev;
      return null;
    });
  }, [computedRupees]);

  const handlePlanUpgrade = async (targetPlan: "pro" | "coach") => {
    try {
      setUpgradingPlan(targetPlan);
      setError("");
      setMessage("");

      const ready = await ensureRazorpayScript();
      if (!ready) {
        throw new Error("Unable to load Razorpay payment gateway");
      }

      const orderRes = await fetch("/api/billing/order", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `billing_plan_${targetPlan}_${user?.id}_${Date.now()}`,
        },
        body: JSON.stringify({ plan: targetPlan }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData?.success) {
        throw new Error(orderData?.message || "Failed to initiate plan upgrade");
      }

      const order = orderData.data;

      const rzp = new (window.Razorpay as any)({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "AutoApply CV",
        description: targetPlan === "pro" ? "Pro Plan Upgrade - ₹49" : "Coach Plan Upgrade - ₹1,849",
        order_id: order.orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        theme: { color: "#7C3AED" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setUpgradingPlan(targetPlan);
            const verifyRes = await fetch("/api/billing/order/verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan: targetPlan,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.message || "Payment verification failed");
            }

            toast.success(`🎉 Upgrade successful! You are now on the ${targetPlan.toUpperCase()} plan.`);
            setMessage(`Your account has been upgraded to ${targetPlan.toUpperCase()}.`);
            await loadWallet();
            await refreshUser();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Payment verification failed");
            setError(err instanceof Error ? err.message : "Payment verification failed");
          } finally {
            setUpgradingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            setUpgradingPlan(null);
          },
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate checkout");
      setError(err instanceof Error ? err.message : "Failed to initiate checkout");
      setUpgradingPlan(null);
    }
  };

  const applyDiscount = async () => {
    try {
      if (belowMinUsd) {
        throw new Error(`Minimum top-up is $${minTopupUsd.toFixed(2)} before discount`);
      }
      const code = discountCode.trim().toUpperCase();
      if (!code) {
        setDiscountPreview(null);
        throw new Error("Enter a discount code");
      }
      setApplyingDiscount(true);
      setError("");
      setMessage("");
      const res = await fetch("/api/wallet/topup/discount/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rupees: computedRupees,
          discountCode: code,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setDiscountPreview(null);
        throw new Error(data?.message || "Failed to apply discount code");
      }
      setDiscountPreview(data.data as DiscountPreview);
      setMessage(`Discount code ${String(data?.data?.code || code)} applied.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply discount");
    } finally {
      setApplyingDiscount(false);
    }
  };

  const startTopup = async () => {
    try {
      const cents = Math.round((Number.isFinite(usdAmount) ? usdAmount : 0) * 100);
      if (!Number.isFinite(usdAmount) || cents < minTopupUsdCents) {
        throw new Error(`Minimum top-up is $${minTopupUsd.toFixed(2)}`);
      }
      setProcessingTopup(true);
      setMessage("");
      setError("");

      const orderRes = await fetch("/api/wallet/topup/order", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `wallet-${Date.now()}-${usdAmount.toFixed(2)}-${discountCode.trim().toUpperCase() || "nocode"}`,
        },
        body: JSON.stringify({
          rupees: computedRupees,
          discountCode: discountCode.trim().toUpperCase() || undefined,
        }),
      });
      const orderBody = await orderRes.json();
      if (!orderRes.ok || !orderBody?.success) {
        throw new Error(orderBody?.message || "Failed to create top-up order");
      }

      const order = orderBody.data as TopupOrder;
      await ensureRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout is not available");

      const razorpay = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "AutoApply CV Hires Wallet",
        description: `${order.hires} Hires top-up${order.discountRupees > 0 ? ` (${order.discountCode} applied)` : ""}`,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true,
          paylater: true,
        },
        theme: { color: "#6366F1" },
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch("/api/wallet/topup/verify", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyBody = await verifyRes.json();
          if (!verifyRes.ok || !verifyBody?.success) {
            setError(verifyBody?.message || "Payment verification failed");
            return;
          }
          setMessage(`Top-up successful. Credited ${verifyBody?.data?.creditedHires || order.hires} Hires.`);
          toast.success(`Credited ${verifyBody?.data?.creditedHires || order.hires} Hires.`);
          await loadWallet();
          await refreshUser();
        },
      });

      razorpay.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process top-up");
    } finally {
      setProcessingTopup(false);
    }
  };

  const txnLabel = (txn: WalletTxn) => {
    if (txn.type === "credit_purchase") return "Top-up";
    if (txn.type === "debit_apply") return "Auto-Apply charge";
    if (txn.type === "refund_apply") return "Refund";
    if (txn.type === "credit_bonus") return "Bonus";
    return "Admin adjustment";
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Plans & Billing</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage your subscription, upgrade your daily apply limits, or top up Hires credits.
          </p>
        </div>
        <button
          onClick={() => void loadWallet()}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 text-gray-700 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-emerald-800 text-xs font-medium">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-rose-800 text-xs font-medium">{error}</div> : null}

      {/* ======================================================== */}
      {/* 1. CURRENT PLAN & PLANS UPGRADE SECTION                  */}
      {/* ======================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider inline-flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-purple-600" />
            Select Your Plan
          </h2>
          <span className="text-xs font-medium text-gray-500">
            Current Plan: <span className="font-bold uppercase text-purple-700">{currentPlan}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Plan 1: Free Plan */}
          <div
            className={`rounded-2xl border p-5 bg-white transition-all relative flex flex-col justify-between ${
              currentPlan === "free"
                ? "border-gray-300 ring-2 ring-gray-400/20 shadow-xs"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {currentPlan === "free" && (
              <span className="absolute -top-2.5 right-4 bg-gray-800 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Current Plan
              </span>
            )}
            <div>
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-3">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Free Tier</h3>
              <p className="text-xs text-gray-500 mt-0.5">Starter access for light job hunting</p>

              <div className="my-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900">₹0</span>
                  <span className="text-xs text-gray-500 font-medium">/month</span>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs text-gray-600 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>3 Auto-Applies per day limit</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Basic LinkedIn & Indeed matching</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Standard application tracking</span>
                </li>
              </ul>
            </div>

            <button
              disabled={currentPlan === "free"}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                currentPlan === "free"
                  ? "bg-gray-100 text-gray-400 cursor-default"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {currentPlan === "free" ? "Active" : "Downgrade"}
            </button>
          </div>

          {/* Plan 2: Pro Plan (HERO / ₹49) */}
          <div
            className={`rounded-2xl border-2 p-5 bg-gradient-to-b from-purple-50/60 via-white to-indigo-50/40 relative flex flex-col justify-between shadow-md transition-all ${
              currentPlan === "pro"
                ? "border-purple-600 ring-4 ring-purple-600/15"
                : "border-purple-500 hover:border-purple-600 hover:shadow-lg"
            }`}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <Flame className="w-3 h-3 fill-gray-950" />
              BEST VALUE • 90% OFF
            </div>

            {currentPlan === "pro" && (
              <span className="absolute -top-2.5 right-4 bg-purple-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Current Plan
              </span>
            )}

            <div>
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white mb-3 shadow-md shadow-purple-600/20">
                <Crown className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Pro Plan
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">High-speed volume & recruiter outreach</p>

              <div className="my-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-purple-700">₹49</span>
                  <span className="text-xs text-gray-500 font-medium">/month</span>
                  <span className="text-xs line-through text-gray-400 ml-1">₹499</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-bold mt-0.5">⚡ Limited Time Launch Pricing</div>
              </div>

              <ul className="space-y-2.5 text-xs text-gray-700 mb-6">
                <li className="flex items-start gap-2 font-semibold text-gray-900">
                  <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Unlimited Auto-Applies</span>
                </li>
                <li className="flex items-start gap-2 font-semibold text-gray-900">
                  <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>HR Recruiter Emails & Phones Extractor</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>AI Resume & Cover Letter Tailoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Priority application speed</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Instant UPI & QR Code activation</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handlePlanUpgrade("pro")}
              disabled={upgradingPlan === "pro" || currentPlan === "pro"}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                currentPlan === "pro"
                  ? "bg-purple-100 text-purple-700 cursor-default"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {upgradingPlan === "pro" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : currentPlan === "pro" ? (
                <span>Active Plan</span>
              ) : (
                <>
                  <span>Upgrade to Pro for ₹49</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Plan 3: Coach Plan */}
          <div
            className={`rounded-2xl border p-5 bg-white transition-all relative flex flex-col justify-between ${
              currentPlan === "coach"
                ? "border-indigo-600 ring-2 ring-indigo-600/20 shadow-xs"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {currentPlan === "coach" && (
              <span className="absolute -top-2.5 right-4 bg-indigo-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Current Plan
              </span>
            )}
            <div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Career Coach</h3>
              <p className="text-xs text-gray-500 mt-0.5">1-on-1 human guidance + automation</p>

              <div className="my-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900">₹1,849</span>
                  <span className="text-xs text-gray-500 font-medium">/month</span>
                  <span className="text-xs line-through text-gray-400 ml-1">₹4,999</span>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs text-gray-600 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Everything in Pro Plan</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>1-on-1 Resume & LinkedIn review</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Mock interview prep session</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Dedicated job hunt mentor</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handlePlanUpgrade("coach")}
              disabled={upgradingPlan === "coach" || currentPlan === "coach"}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentPlan === "coach"
                  ? "bg-indigo-100 text-indigo-700 cursor-default"
                  : "bg-gray-900 hover:bg-black text-white hover:scale-[1.02]"
              }`}
            >
              {upgradingPlan === "coach" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : currentPlan === "coach" ? (
                <span>Active Plan</span>
              ) : (
                <span>Upgrade to Coach (₹1,849)</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STATS OVERVIEW                                       */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Wallet Balance</div>
          <div className="text-lg font-bold text-gray-900 mt-1 inline-flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-purple-600" />
            <span>{wallet?.hireBalance ?? 0}</span>
            <span className="text-xs font-normal text-gray-500">Hires</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Daily Applies Usage</div>
          <div className="text-lg font-bold text-gray-900 mt-1">
            {mergedDailyUsage.used} / {currentPlan === "pro" ? "∞" : mergedDailyUsage.cap}
          </div>
          <div className="text-[11px] text-gray-500">
            {currentPlan === "pro" ? "Unlimited Pro Active" : `Remaining today: ${mergedDailyUsage.remaining}`}
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Purchased Hires</div>
          <div className="text-lg font-bold text-gray-900 mt-1">
            {wallet?.hirePurchased ?? 0} <span className="text-xs font-normal text-gray-500">Hires</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Daily Reset Time</div>
          <div className="text-xs font-semibold text-gray-900 mt-1.5 truncate">{formattedReset}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Free balance: {wallet?.freeRemaining ?? 0}</div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CUSTOM HIRES TOP UP WALLET                            */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider inline-flex items-center gap-1.5">
          <Coins className="w-4 h-4 text-purple-600" />
          Top Up Hires Credits (Pay As You Go)
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Top-up Amount (USD)
              <span className="ml-1 text-[11px] text-gray-500 font-normal">(min ${minTopupUsd.toFixed(2)})</span>
            </label>
            <input
              type="number"
              min={minTopupUsd}
              step={0.01}
              value={usdAmount}
              onChange={(e) => setUsdAmount(Math.max(0, Number(e.target.value) || 0))}
              className={`px-3 py-1.5 rounded-lg border text-xs outline-none w-36 ${
                belowMinUsd ? "border-rose-300 focus:border-rose-400" : "border-gray-300 focus:border-purple-400"
              }`}
            />
            {belowMinUsd ? (
              <div className="mt-1 text-[11px] font-semibold text-rose-600">
                Minimum top-up is ${minTopupUsd.toFixed(2)}.
              </div>
            ) : null}
          </div>
          <div className="text-xs text-gray-600 pb-1.5">
            You will get <span className="font-bold text-purple-700">{computedHires} Hires</span> (1 Hire = 1 Apply)
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Discount Code (optional)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(String(e.target.value || "").toUpperCase());
                  setDiscountPreview(null);
                }}
                placeholder="WELCOME10"
                className="px-3 py-1.5 rounded-lg border border-gray-300 focus:border-purple-400 text-xs outline-none uppercase w-32"
              />
              <button
                onClick={() => void applyDiscount()}
                disabled={applyingDiscount || belowMinUsd}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold disabled:opacity-60 cursor-pointer"
              >
                {applyingDiscount ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
          <button
            onClick={() => void startTopup()}
            disabled={processingTopup || belowMinUsd}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A855F7] hover:from-[#5558E6] hover:to-[#9647E3] text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            {processingTopup ? "Processing..." : "Pay with Razorpay"}
          </button>
        </div>
        {discountPreview ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <div className="font-semibold">Code applied: {discountPreview.code}</div>
            <div className="mt-0.5 text-[11px]">
              Base: INR {discountPreview.baseRupees} | Discount: INR {discountPreview.discountRupees} | Payable: INR{" "}
              {discountPreview.finalRupees}
            </div>
            {discountPreview.description ? <div className="text-[10px] mt-0.5 text-emerald-700">{discountPreview.description}</div> : null}
          </div>
        ) : null}
        <div className="text-[11px] text-gray-500">
          Charged in INR at approximate rate: $1 = INR {INR_PER_USD.toFixed(1)}. Instant UPI / Card activation.
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. TRANSACTION HISTORY                                  */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Transaction History</h2>
        {loading ? <div className="text-xs text-gray-500">Loading wallet...</div> : null}
        {!loading && txns.length === 0 ? <div className="text-xs text-gray-500 py-4 text-center">No wallet transactions yet.</div> : null}
        <div className="space-y-1.5">
          {txns.map((txn) => (
            <div key={txn.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-purple-50/30 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${txn.amount >= 0 ? "bg-emerald-100" : "bg-rose-100"}`}>
                  {txn.amount >= 0 ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-700" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900">{txnLabel(txn)}</div>
                  <div className="text-[11px] text-gray-500">{new Date(txn.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-bold ${txn.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {txn.amount >= 0 ? "+" : ""}{txn.amount} Hires
                </div>
                <div className="text-[11px] text-gray-500">Bal: {txn.balanceAfter}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
