import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { User, Phone, MapPin, Link as LinkIcon, Camera, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentCity: user?.currentCity || '',
    addressLine: user?.addressLine || '',
    linkedinUrl: user?.linkedinUrl || '',
    portfolioUrl: user?.portfolioUrl || ''
  });

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      currentCity: user?.currentCity || '',
      addressLine: user?.addressLine || '',
      linkedinUrl: user?.linkedinUrl || '',
      portfolioUrl: user?.portfolioUrl || ''
    });
  }, [user]);

  const handleSave = async () => {
    try {
      setError('');
      setIsSaving(true);
      const profileRes = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name })
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok || !profileData?.success) {
        throw new Error(profileData?.message || 'Failed to update profile name');
      }

      const onboardingRes = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          currentCity: formData.currentCity,
          addressLine: formData.addressLine,
          linkedinUrl: formData.linkedinUrl,
          portfolioUrl: formData.portfolioUrl
        })
      });
      const onboardingData = await onboardingRes.json();
      if (!onboardingRes.ok || !onboardingData?.success) {
        throw new Error(onboardingData?.message || 'Failed to update onboarding details');
      }

      await refreshUser();
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Profile Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your personal information and preferences.</p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-xs font-semibold hover:shadow-xs transition-all"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-xs font-semibold hover:shadow-xs transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Success / Error Message */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-green-700 font-medium"
        >
          <Save className="w-3.5 h-3.5 text-green-600" />
          <span>Profile updated successfully!</span>
        </motion.div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Avatar & Plan Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs text-center">
            <div className="relative inline-block mb-2.5">
              <img
                src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'}
                alt={user?.name}
                className="w-18 h-18 rounded-full border-2 border-purple-200 shadow-xs object-cover"
              />
              {isEditing && (
                <button className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs hover:-translate-y-px transition-transform">
                  <Camera className="w-3 h-3" />
                </button>
              )}
            </div>
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{user?.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{formData.currentCity || 'No city set'}</p>
            <div className="inline-flex items-center px-2.5 py-0.5 mt-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-full">
              <span className="text-[11px] font-semibold text-purple-700 capitalize">{user?.plan || 'Free'} Plan</span>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2.5 pb-1.5 border-b border-gray-100">
              Account Information
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Member since</span>
                <span className="font-semibold text-gray-900">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Account status</span>
                <span className="font-semibold text-green-600">Active</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Profile completion</span>
                <span className="font-semibold text-gray-900">{user?.onboardingCompleted ? '100%' : 'Incomplete'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-1.5 border-b border-gray-100 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-600" />
              Personal Information
            </h3>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Current City
                </label>
                <input
                  type="text"
                  value={formData.currentCity}
                  onChange={(e) => setFormData({ ...formData, currentCity: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.addressLine}
                  onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Portfolio URL
                </label>
                <input
                  type="url"
                  value={formData.portfolioUrl}
                  onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-xl p-4 border border-red-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Danger Zone
            </h3>
            <div className="flex items-center justify-between p-3 bg-red-50/60 rounded-lg border border-red-100">
              <div>
                <h4 className="font-semibold text-xs text-gray-900">Delete Account</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Permanently delete your account and data.
                </p>
              </div>
              <button className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
