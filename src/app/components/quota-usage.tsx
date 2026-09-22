import { useState, useEffect } from 'react';
import { Zap, Clock, Lock, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useExtensionPipelineStats } from '../hooks/useExtensionPipelineStats';
import { useNavigate } from "react-router";

interface QuotaUsageProps {
  quotaResetTime: Date;
  onUpgradeClick: () => void;
}

export function QuotaUsage({ quotaResetTime, onUpgradeClick }: QuotaUsageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('');
  const extensionStats = useExtensionPipelineStats();

  const baseUsed = user?.dailyHireUsed ?? 0;
  const total = Math.max(1, user?.dailyHireCap ?? 3);
  const extensionUsedToday = extensionStats.loaded ? extensionStats.appliedToday : 0;
  const used = Math.min(total, Math.max(baseUsed, extensionUsedToday));
  const balance = user?.hireBalance ?? 0;
  const dailyRemaining = Math.max(0, total - used);
  const freeLeft = user?.plan === 'free' ? Math.max(0, 3 - used) : 0;
  const spendableNow = user?.plan === 'pro' ? Number.MAX_SAFE_INTEGER : Math.max(0, balance + freeLeft);
  const isLocked = spendableNow <= 0;
  const lockReason =
    user?.plan === 'free' && freeLeft <= 0
      ? 'daily_cap'
      : 'wallet_empty';
  const percentage = user?.plan === 'pro' ? 0 : Math.min(100, (used / total) * 100);
  const totalLabel = user?.plan === 'pro' ? 'Unlimited' : String(total);
  const planLabel =
    user?.plan === 'pro'
      ? 'Pro (₹49/mo)'
      : balance > 0
      ? 'Custom (Top-up)'
      : 'Free';

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = quotaResetTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Resetting...');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [quotaResetTime]);

  return (
    <div className="w-full max-w-md">
      <div className={`rounded-2xl border-2 transition-all duration-300 ${
        isLocked
          ? 'border-red-200 bg-red-50/50'
          : 'border-gray-200 bg-white hover:border-[#0EA5E9]/30 hover:shadow-lg'
      }`}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                isLocked ? 'bg-red-100' : 'bg-gradient-to-br from-[#0EA5E9] to-[#06B6D4]'
              }`}>
                {isLocked ? <Lock className="w-6 h-6 text-red-600" /> : <Zap className="w-6 h-6 text-white" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#030213]">Hires Budget</h3>
                <p className="text-sm text-gray-600">{planLabel} · 1 Hire = 1 Auto-Apply</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[#030213]">{used}</span>
                  <span className="text-2xl text-gray-400">/</span>
                  <span className="text-2xl font-semibold text-gray-600">{totalLabel}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{user?.plan === 'pro' ? 'applies today' : 'free used today'}</p>
              </div>

              {isLocked && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full">
                  <Lock className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">Locked</span>
                </div>
              )}
            </div>

            <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  isLocked
                    ? 'bg-gradient-to-r from-red-400 to-red-500'
                    : percentage > 66
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                    : 'bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4]'
                }`}
                style={{ width: `${percentage}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            <div className="mt-2 text-right">
              <span className={`text-xs font-medium ${isLocked ? 'text-red-600' : 'text-gray-600'}`}>
                {percentage.toFixed(0)}% used
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Daily cap resets in</span>
            </div>
            <span className="text-sm font-bold text-[#030213] font-mono">{timeLeft}</span>
          </div>

          {isLocked ? (
            <div className="mt-4 space-y-3">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium">
                  {lockReason === 'daily_cap'
                    ? 'Daily cap reached. Wait for reset or upgrade your plan cap.'
                    : 'Wallet balance is 0. Add Hires to continue auto-apply.'}
                </p>
              </div>
              <button
                onClick={() => navigate("/dashboard/billing")}
                className="w-full px-4 py-3 bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Buy Hires
              </button>
              <button
                onClick={onUpgradeClick}
                className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-900 rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Upgrade Plan
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-5 h-5 text-[#0EA5E9] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-[#030213]">{spendableNow} spendable now</span>.
                      Free left today: {freeLeft}. Wallet balance: {user?.plan === 'pro' ? 'Unlimited' : `${balance} Hires`}.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate("/dashboard/billing")}
                className="w-full px-4 py-3 bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Buy Hires
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-[#0EA5E9]/30 transition-colors">
          <div className="text-2xl font-bold text-[#030213] mb-1">{used}</div>
          <div className="text-xs text-gray-600">Used Today</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-[#0EA5E9]/30 transition-colors">
          <div className="text-2xl font-bold text-[#030213] mb-1">{dailyRemaining}</div>
          <div className="text-xs text-gray-600">Daily Remaining</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-[#0EA5E9]/30 transition-colors">
          <div className="text-2xl font-bold text-[#030213] mb-1">{spendableNow}</div>
          <div className="text-xs text-gray-600">Spendable Now</div>
        </div>
      </div>
    </div>
  );
}
