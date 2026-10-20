import { useEffect, useMemo, useRef, useState } from "react";
import { trackActionFailed, trackCheckoutAbandoned } from "src/lib/posthog-client";
import {
  Coins,
  Tag,
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
  Contact,
  ArrowRight,
  Layers,
  Star,
  CreditCard,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useExtensionPipelineStats } from "../../hooks/useExtensionPipelineStats";
import { toast } from "sonner";

const PLAN_COUPON_PLANS = ["pro", "connect", "coach"] as const;
type PlanCouponPrices = Partial<Record<(typeof PLAN_COUPON_PLANS)[number], { code: string; baseRupees: number; finalRupees: number }>>;

const PLAN_UPGRADE_DESCRIPTION = {
  pro: "Pro Plan Upgrade - ₹99",
  connect: "Pro Connect Upgrade - ₹500",
  coach: "Coach Plan Upgrade - ₹1,849",
} as const;

type WalletSummary = {
  plan: "free" | "pro" | "coach" | "connect";
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

type PlanPurchase = {
  id: string;
  paymentId: string;
  createdAt: string;
  plan: string;
  amountRupees: number | null;
  discountCode: string | null;
  expiresAt: string | null;
  source: "one_time" | "subscription";
};

const PLAN_PURCHASE_NAME: Record<string, string> = { pro: "Pro", connect: "Pro Connect", coach: "Coach" };

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
  const [purchases, setPurchases] = useState<PlanPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTopup, setProcessingTopup] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [subInfo, setSubInfo] = useState<{ active: boolean; plan: string | null; cancelAtPeriodEnd: boolean; accessUntil: string | null } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [usdAmount, setUsdAmount] = useState(1.0);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Plan coupon (e.g. GOINDIA): checked on the server per plan; the order route re-checks it.
  const [planCoupon, setPlanCoupon] = useState("");
  const [planCouponPrices, setPlanCouponPrices] = useState<PlanCouponPrices>({});
  const [planCouponBusy, setPlanCouponBusy] = useState(false);
  const [planCouponError, setPlanCouponError] = useState("");

  const applyPlanCoupon = async (codeInput = planCoupon) => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setPlanCouponBusy(true);
    setPlanCouponError("");
    const results = await Promise.all(
      PLAN_COUPON_PLANS.map(async (plan) => {
        try {
          const res = await fetch("/api/billing/discount/preview", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan, discountCode: code }),
          });
          const body = await res.json().catch(() => null);
          return res.ok && body?.success ? { plan, data: body.data } : { plan, error: String(body?.message || "Invalid coupon") };
        } catch {
          return { plan, error: "Could not check the coupon" };
        }
      })
    );
    const prices: PlanCouponPrices = {};
    for (const r of results) if ("data" in r && r.data) prices[r.plan] = { code, baseRupees: r.data.baseRupees, finalRupees: r.data.finalRupees };
    setPlanCouponPrices(prices);
    if (!Object.keys(prices).length) {
      const reason = results.find((r) => r.plan === "connect" && "error" in r) as { error?: string } | undefined;
      setPlanCouponError(reason?.error || "This coupon can't be used on any plan");
    } else {
      toast.success(`Coupon ${code} applied`);
    }
    setPlanCouponBusy(false);
  };

  // ?coupon=GOINDIA, or a code remembered from the site banner, fills in and applies the coupon.
  useEffect(() => {
    let fromUrl = new URLSearchParams(window.location.search).get("coupon");
    try {
      fromUrl = fromUrl || sessionStorage.getItem("cp_pending_coupon");
      sessionStorage.removeItem("cp_pending_coupon");
    } catch {
      // storage blocked
    }
    if (fromUrl) {
      setPlanCoupon(fromUrl.toUpperCase());
      void applyPlanCoupon(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const couponLine = (plan: "pro" | "coach" | "connect") => {
    const price = planCouponPrices[plan];
    if (!price) return null;
    return (
      <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">
        With {price.code}: ₹{price.finalRupees.toLocaleString("en-IN")}
        <span className="font-normal line-through text-purple-400">₹{price.baseRupees.toLocaleString("en-IN")}</span>
      </div>
    );
  };

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
      setPurchases((txData?.data?.purchases || []) as PlanPurchase[]);
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

  const handlePlanPayOnce = async (targetPlan: "pro" | "coach" | "connect") => {
    let stage = "script_load";
    try {
      setUpgradingPlan(targetPlan);
      setError("");
      setMessage("");

      const ready = await ensureRazorpayScript();
      if (!ready) {
        throw new Error("Unable to load Razorpay payment gateway");
      }

      stage = "order_create";
      const orderRes = await fetch("/api/billing/order", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `billing_plan_${targetPlan}_${user?.id}_${Date.now()}`,
        },
        body: JSON.stringify({ plan: targetPlan, ...(planCouponPrices[targetPlan] ? { discountCode: planCouponPrices[targetPlan]!.code } : {}) }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData?.success) {
        throw new Error(orderData?.message || "Failed to initiate plan upgrade");
      }

      const order = orderData.data;
      let paymentSubmitted = false;

      const rzp = new (window.Razorpay as any)({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "AutoApply CV",
        description: order.discountCode
          ? `${PLAN_UPGRADE_DESCRIPTION[targetPlan].split(" - ")[0]} - ₹${order.finalRupees} with ${order.discountCode}`
          : PLAN_UPGRADE_DESCRIPTION[targetPlan],
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
          paymentSubmitted = true;
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
            trackActionFailed("plan_purchase", "payment_verification", err, { plan: targetPlan });
            toast.error(err instanceof Error ? err.message : "Payment verification failed");
            setError(err instanceof Error ? err.message : "Payment verification failed");
          } finally {
            setUpgradingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            if (!paymentSubmitted) trackCheckoutAbandoned("plan_purchase", { plan: targetPlan });
            setUpgradingPlan(null);
          },
        },
      });

      stage = "checkout_open";
      rzp.open();
    } catch (err) {
      trackActionFailed("plan_purchase", stage, err, { plan: targetPlan });
      toast.error(err instanceof Error ? err.message : "Failed to initiate checkout");
      setError(err instanceof Error ? err.message : "Failed to initiate checkout");
      setUpgradingPlan(null);
    }
  };

  // Monthly subscription: Razorpay charges the card or UPI mandate every month until the user cancels.
  const handlePlanSubscribe = async (targetPlan: "pro" | "coach" | "connect") => {
    let stage = "script_load";
    try {
      setUpgradingPlan(targetPlan);
      setError("");
      setMessage("");
      const ready = await ensureRazorpayScript();
      if (!ready) throw new Error("Unable to load Razorpay payment gateway");

      stage = "subscription_create";
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to start subscription");
      const checkout = data.data;
      if (checkout.mock) throw new Error("Subscriptions are not configured on this server");
      let paymentSubmitted = false;

      const rzp = new (window.Razorpay as any)({
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: "AutoApply CV",
        description: `${PLAN_UPGRADE_DESCRIPTION[targetPlan].split(" - ")[0]} - monthly, cancel anytime`,
        prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone || "" },
        theme: { color: "#7C3AED" },
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          paymentSubmitted = true;
          try {
            setUpgradingPlan(targetPlan);
            const verifyRes = await fetch("/api/billing/verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan: targetPlan,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.success) throw new Error(verifyData?.message || "Payment verification failed");
            toast.success(`You are subscribed to ${targetPlan.toUpperCase()}. Cancel anytime from this page.`);
            setMessage(`You are subscribed to ${targetPlan.toUpperCase()}. It renews monthly until you cancel.`);
            await loadWallet();
            await refreshUser();
            await loadSubscription();
          } catch (err) {
            trackActionFailed("plan_subscription", "payment_verification", err, { plan: targetPlan });
            toast.error(err instanceof Error ? err.message : "Payment verification failed");
            setError(err instanceof Error ? err.message : "Payment verification failed");
          } finally {
            setUpgradingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            if (!paymentSubmitted) trackCheckoutAbandoned("plan_subscription", { plan: targetPlan });
            setUpgradingPlan(null);
          },
        },
      });
      stage = "checkout_open";
      rzp.open();
    } catch (err) {
      trackActionFailed("plan_subscription", stage, err, { plan: targetPlan });
      toast.error(err instanceof Error ? err.message : "Failed to start subscription");
      setError(err instanceof Error ? err.message : "Failed to start subscription");
      setUpgradingPlan(null);
    }
  };

  // With a coupon the plan is a one-time 30-day purchase at the coupon price; otherwise it is the monthly subscription.
  const handlePlanUpgrade = (targetPlan: "pro" | "coach" | "connect") =>
    planCouponPrices[targetPlan] ? handlePlanPayOnce(targetPlan) : handlePlanSubscribe(targetPlan);

  // ?plan=pro (a plan picked at the end of onboarding) opens that plan's checkout once, after loading.
  const planFromUrlStartedRef = useRef(false);
  useEffect(() => {
    if (loading || planFromUrlStartedRef.current) return;
    const wanted = new URLSearchParams(window.location.search).get("plan");
    if (wanted !== "pro" && wanted !== "coach" && wanted !== "connect") return;
    planFromUrlStartedRef.current = true;
    if (currentPlan !== wanted) void handlePlanUpgrade(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentPlan]);

  const loadSubscription = async () => {
    try {
      const res = await fetch("/api/billing/cancel", { credentials: "include" });
      const body = await res.json();
      if (res.ok && body?.success) setSubInfo(body.data);
    } catch {
      // the Billing page works without it
    }
  };

  const cancelSubscription = async () => {
    if (!window.confirm("Cancel your monthly subscription? Your plan stays active until the end of the period you already paid for.")) return;
    try {
      setCancelling(true);
      setError("");
      const res = await fetch("/api/billing/cancel", { method: "POST", credentials: "include" });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.message || "Could not cancel");
      toast.success(body.message || "Subscription cancelled");
      await loadSubscription();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    void loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    let stage = "validation";
    try {
      const cents = Math.round((Number.isFinite(usdAmount) ? usdAmount : 0) * 100);
      if (!Number.isFinite(usdAmount) || cents < minTopupUsdCents) {
        throw new Error(`Minimum top-up is $${minTopupUsd.toFixed(2)}`);
      }
      setProcessingTopup(true);
      setMessage("");
      setError("");

      stage = "order_create";
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
      stage = "script_load";
      await ensureRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout is not available");
      let paymentSubmitted = false;

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
        theme: { color: "#6047f5" },
        handler: async (response: Record<string, string>) => {
          paymentSubmitted = true;
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
            trackActionFailed("wallet_topup", "payment_verification", new Error("verification_rejected"));
            setError(verifyBody?.message || "Payment verification failed");
            return;
          }
          setMessage(`Top-up successful. Credited ${verifyBody?.data?.creditedHires || order.hires} Hires.`);
          toast.success(`Credited ${verifyBody?.data?.creditedHires || order.hires} Hires.`);
          await loadWallet();
          await refreshUser();
        },
        modal: {
          ondismiss: () => {
            if (!paymentSubmitted) trackCheckoutAbandoned("wallet_topup");
          },
        },
      });

      stage = "checkout_open";
      razorpay.open();
    } catch (e) {
      // A below-minimum amount is a local validation message, not a failed action.
      if (stage !== "validation") trackActionFailed("wallet_topup", stage, e);
      setError(e instanceof Error ? e.message : "Failed to process top-up");
    } finally {
      setProcessingTopup(false);
    }
  };

  // Hires movements and plan purchases in one list, newest first.
  const historyRows = useMemo(() => {
    const rows: Array<{ kind: "txn"; at: string; txn: WalletTxn } | { kind: "purchase"; at: string; purchase: PlanPurchase }> = [
      ...txns.map((txn) => ({ kind: "txn" as const, at: txn.createdAt, txn })),
      ...purchases.map((purchase) => ({ kind: "purchase" as const, at: purchase.createdAt, purchase })),
    ];
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [txns, purchases]);

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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider inline-flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-purple-600" />
            Select Your Plan
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Plan coupon (e.g. GOINDIA), on the same line as the heading */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void applyPlanCoupon();
              }}
              className="flex items-center gap-1.5"
            >
              <Tag className="w-3.5 h-3.5 text-purple-600" aria-hidden="true" />
              <input
                value={planCoupon}
                onChange={(e) => {
                  setPlanCoupon(e.target.value.toUpperCase());
                  setPlanCouponError("");
                }}
                placeholder="Coupon code"
                aria-label="Coupon code"
                className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide outline-none placeholder:normal-case placeholder:font-normal placeholder:tracking-normal focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
              <button
                type="submit"
                disabled={planCouponBusy || !planCoupon.trim()}
                className="rounded-lg bg-[#6047f5] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#4f38e0] disabled:opacity-60 cursor-pointer"
              >
                {planCouponBusy ? "Checking…" : "Apply"}
              </button>
            </form>
            <span className="text-xs font-medium text-gray-500">
              Current Plan: <span className="font-bold uppercase text-purple-700">{currentPlan}</span>
            </span>
          </div>
        </div>

        {subInfo?.active ? (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-xs text-purple-900 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {subInfo.cancelAtPeriodEnd ? (
                <>
                  Your <b className="uppercase">{subInfo.plan}</b> subscription is cancelled and will not renew.
                  {subInfo.accessUntil ? <> You keep access until <b>{new Date(subInfo.accessUntil).toLocaleDateString()}</b>.</> : null}
                </>
              ) : (
                <>
                  You are subscribed to <b className="uppercase">{subInfo.plan}</b>. It renews monthly. Cancel anytime and keep access until the period ends.
                </>
              )}
            </span>
            {subInfo.cancelAtPeriodEnd ? null : (
              <button
                onClick={() => void cancelSubscription()}
                disabled={cancelling}
                className="shrink-0 rounded-lg border border-purple-300 bg-white px-3 py-1.5 font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Cancel subscription"}
              </button>
            )}
          </div>
        ) : null}
        {(Object.keys(planCouponPrices).length > 0 || planCouponError) && (
          <div className="flex justify-end -mt-1">
            {Object.keys(planCouponPrices).length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <Check className="w-3 h-3" /> {Object.values(planCouponPrices)[0]?.code} applied to{" "}
                {Object.keys(planCouponPrices).map((p) => (p === "connect" ? "Pro Connect" : p === "pro" ? "Pro" : "Coach")).join(", ")}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-rose-700">{planCouponError}</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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

          {/* Plan 2: Pro Plan (HERO / ₹99) */}
          <div
            className={`rounded-2xl border-2 p-5 bg-gradient-to-b from-purple-50/60 via-white to-indigo-50/40 relative flex flex-col justify-between shadow-md transition-all ${
              currentPlan === "pro"
                ? "border-purple-600 ring-4 ring-purple-600/15"
                : "border-purple-500 hover:border-purple-600 hover:shadow-lg"
            }`}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <Flame className="w-3 h-3 fill-gray-950" />
              BEST VALUE • 80% OFF
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
                  <span className="text-3xl font-black text-purple-700">₹99</span>
                  <span className="text-xs text-gray-500 font-medium">/month</span>
                  <span className="text-xs line-through text-gray-400 ml-1">₹499</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-bold mt-0.5">⚡ Limited Time Launch Pricing</div>
                {couponLine("pro")}
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
                <li className="flex items-start gap-2 font-semibold text-gray-900">
                  <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Personal AI Assistant that knows your account</span>
                </li>
                <li className="flex items-start gap-2 font-semibold text-gray-900">
                  <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Direct WhatsApp Support</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>AI Resume & Cover Letter Tailoring</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handlePlanUpgrade("pro")}
              disabled={upgradingPlan === "pro" || currentPlan === "pro"}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                currentPlan === "pro"
                  ? "bg-purple-100 text-purple-700 cursor-default"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20 hover:-translate-y-px active:scale-[0.98]"
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
                  <span>{planCouponPrices.pro ? `Pay once ₹${planCouponPrices.pro.finalRupees} (${planCouponPrices.pro.code})` : "Subscribe monthly"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-gray-500">
              {planCouponPrices.pro ? "One-time payment for 30 days, no auto-renewal." : "Renews monthly. Cancel anytime, you keep access until the period ends."}
            </p>
          </div>

          {/* Plan 3: Pro Connect (Pro + HR Contacts) */}
          <div
            className={`rounded-2xl border-2 p-5 bg-white transition-all relative flex flex-col justify-between ${
              currentPlan === "connect"
                ? "border-emerald-600 ring-4 ring-emerald-600/15 shadow-md"
                : "border-emerald-200 hover:border-emerald-400 hover:shadow-md"
            }`}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              New
            </div>
            {currentPlan === "connect" && (
              <span className="absolute -top-2.5 right-4 bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Current Plan
              </span>
            )}
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white mb-3 shadow-md shadow-emerald-600/20">
                <Contact className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Pro Connect</h3>
              <p className="text-xs text-gray-500 mt-0.5">Pro + fresh recruiter contacts every day</p>

              <div className="my-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-emerald-700">₹500</span>
                  <span className="text-xs text-gray-500 font-medium">/month</span>
                </div>
                {couponLine("connect")}
              </div>

              <ul className="space-y-2.5 text-xs text-gray-700 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Everything in Pro Plan</span>
                </li>
                <li className="flex items-start gap-2 font-semibold text-gray-900">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>20 new HR contacts a day, matched to your roles</span>
                </li>
                <li className="flex items-start gap-2 font-semibold text-gray-900">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>WhatsApp-checked numbers & recruiter emails</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Daily contacts email every morning</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Message them for free, 1 click from the dashboard</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handlePlanUpgrade("connect")}
              disabled={upgradingPlan === "connect" || currentPlan === "connect"}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentPlan === "connect"
                  ? "bg-emerald-100 text-emerald-700 cursor-default"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white hover:-translate-y-px"
              }`}
            >
              {upgradingPlan === "connect" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : currentPlan === "connect" ? (
                <span>Active Plan</span>
              ) : (
                <>
                  <span>{planCouponPrices.connect ? `Pay once ₹${planCouponPrices.connect.finalRupees} (${planCouponPrices.connect.code})` : "Subscribe monthly"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-gray-500">
              {planCouponPrices.connect ? "One-time payment for 30 days, no auto-renewal." : "Renews monthly. Cancel anytime, you keep access until the period ends."}
            </p>
          </div>

          {/* Plan 4: Coach Plan */}
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
                {couponLine("coach")}
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
                  : "bg-gray-900 hover:bg-black text-white hover:-translate-y-px"
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
                <span>{planCouponPrices.coach ? `Pay once ₹${planCouponPrices.coach.finalRupees} (${planCouponPrices.coach.code})` : "Subscribe monthly"}</span>
              )}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-gray-500">
              {planCouponPrices.coach ? "One-time payment for 30 days, no auto-renewal." : "Renews monthly. Cancel anytime, you keep access until the period ends."}
            </p>
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
            {mergedDailyUsage.used} / {currentPlan === "pro" || currentPlan === "connect" ? "∞" : mergedDailyUsage.cap}
          </div>
          <div className="text-[11px] text-gray-500">
            {currentPlan === "pro" || currentPlan === "connect" ? "Unlimited Pro Active" : `Remaining today: ${mergedDailyUsage.remaining}`}
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
      <div className="bg-white rounded-xl p-5 border border-gray-200/80 shadow-xs">
        <div className="mb-4">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider inline-flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-purple-600" />
            Top Up Hires Credits
          </h2>
          <p className="text-xs text-gray-500 mt-1">Pay as you go. Each Hire covers one application.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,360px)_320px] md:gap-8 md:items-start">
          {/* Inputs */}
          <div className="space-y-5">
            <div>
              <label htmlFor="topup-amount" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Top-up amount (USD)
              </label>
              <div className="relative w-full">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-gray-400">$</span>
                <input
                  id="topup-amount"
                  type="number"
                  min={minTopupUsd}
                  step={0.01}
                  value={usdAmount}
                  onChange={(e) => setUsdAmount(Math.max(0, Number(e.target.value) || 0))}
                  className={`h-10 w-full rounded-lg border bg-white pl-7 pr-3 text-sm outline-none transition-colors focus:ring-2 ${
                    belowMinUsd
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                      : "border-gray-300 focus:border-purple-400 focus:ring-purple-100"
                  }`}
                />
              </div>
              {belowMinUsd ? (
                <p className="mt-1.5 text-[11px] font-semibold text-rose-600">Minimum top-up is ${minTopupUsd.toFixed(2)}.</p>
              ) : (
                <p className="mt-1.5 text-[11px] text-gray-500">Minimum ${minTopupUsd.toFixed(2)}.</p>
              )}
            </div>

            <div>
              <label htmlFor="topup-code" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Discount code <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <div className="flex w-full items-center gap-2">
                <input
                  id="topup-code"
                  type="text"
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(String(e.target.value || "").toUpperCase());
                    setDiscountPreview(null);
                  }}
                  placeholder="WELCOME10"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm uppercase outline-none transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
                <button
                  onClick={() => void applyDiscount()}
                  disabled={applyingDiscount || belowMinUsd}
                  className="h-10 shrink-0 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
                >
                  {applyingDiscount ? "Applying..." : "Apply"}
                </button>
              </div>
              {discountPreview ? (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                  <div className="font-semibold">Code applied: {discountPreview.code}</div>
                  <div className="mt-0.5 text-[11px]">
                    Base: INR {discountPreview.baseRupees} &middot; Discount: INR {discountPreview.discountRupees} &middot; Payable: INR{" "}
                    {discountPreview.finalRupees}
                  </div>
                  {discountPreview.description ? <div className="mt-0.5 text-[11px] text-emerald-700">{discountPreview.description}</div> : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* Summary + pay */}
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">You will get</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-black leading-none text-purple-700">{computedHires}</span>
              <span className="text-sm font-semibold text-gray-700">Hires</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">1 Hire = 1 application</div>
            {discountPreview ? (
              <div className="mt-3 flex items-center justify-between border-t border-purple-100 pt-3 text-xs">
                <span className="text-gray-600">Payable</span>
                <span className="font-bold text-gray-900">INR {discountPreview.finalRupees}</span>
              </div>
            ) : null}
            <button
              onClick={() => void startTopup()}
              disabled={processingTopup || belowMinUsd}
              className="mt-4 h-11 w-full rounded-lg bg-[#6047f5] text-sm font-bold text-white shadow-xs transition-all hover:bg-[#5538e8] hover:shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {processingTopup ? "Processing..." : "Pay with Razorpay"}
            </button>
            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-gray-500">
              Charged in INR at about $1 = INR {INR_PER_USD.toFixed(1)}.
              <br />
              Instant UPI / card activation.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. TRANSACTION HISTORY                                  */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Transaction History</h2>
        {loading ? <div className="text-xs text-gray-500">Loading wallet...</div> : null}
        {!loading && historyRows.length === 0 ? <div className="text-xs text-gray-500 py-4 text-center">No transactions yet.</div> : null}
        <div className="space-y-1.5">
          {historyRows.map((row) => {
            if (row.kind === "purchase") return (
            <div key={`purchase-${row.purchase.id}`} className="flex items-center justify-between p-2.5 rounded-lg border border-purple-100 bg-purple-50/40 hover:bg-purple-50/70 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-100">
                  <CreditCard className="w-3.5 h-3.5 text-purple-700" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900">
                    {PLAN_PURCHASE_NAME[row.purchase.plan] || row.purchase.plan} plan {row.purchase.source === "subscription" ? "payment" : "purchase"}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {new Date(row.purchase.createdAt).toLocaleString()}
                    {row.purchase.discountCode ? ` · coupon ${row.purchase.discountCode}` : ""}
                    {row.purchase.expiresAt ? ` · valid until ${new Date(row.purchase.expiresAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-purple-700">
                  {row.purchase.amountRupees === null ? "Plan activated" : `₹${row.purchase.amountRupees.toLocaleString("en-IN")}`}
                </div>
                <div className="text-[11px] text-gray-500">Paid</div>
              </div>
            </div>
          );
            const txn = row.txn;
            return (
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
