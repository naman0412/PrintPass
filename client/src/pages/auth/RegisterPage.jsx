import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Printer,
  Store,
  Lock,
  Mail,
  User,
  Phone,
  AlertCircle,
  ArrowRight,
  MapPin,
  Tag,
  IndianRupee,
  CheckCircle2
} from 'lucide-react';

export const RegisterPage = () => {
  const { register, registerShop } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'shop'

  // Student form state
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'student'
  });

  // Shop kiosk partner form state
  const [shopForm, setShopForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    bwRate: '2',
    colorRate: '10'
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registeredShopInfo, setRegisteredShopInfo] = useState(null);

  // Auto-generate code slug when shop name changes
  const handleShopNameChange = (val) => {
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setShopForm((prev) => ({
      ...prev,
      name: val,
      code: prev.code === '' || prev.code === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ? slug : prev.code
    }));
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await register(studentForm);
      if (data.success) {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleShopSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name: shopForm.name.trim(),
        code: shopForm.code.trim().toLowerCase(),
        address: shopForm.address.trim(),
        phone: shopForm.phone.trim(),
        ownerName: shopForm.ownerName.trim(),
        ownerEmail: shopForm.ownerEmail.trim().toLowerCase(),
        ownerPassword: shopForm.ownerPassword,
        pricing: {
          bwPerPage: parseFloat(shopForm.bwRate) || 2.0,
          colorPerPage: parseFloat(shopForm.colorRate) || 10.0
        }
      };

      const res = await registerShop(payload);
      if (res.success) {
        setRegisteredShopInfo(res.shop);
        // Automatically redirect to shop dashboard after 1.5s
        setTimeout(() => {
          navigate('/shop');
        }, 1800);
      }
    } catch (err) {
      setError(err.message || 'Shop registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className={`w-full ${activeTab === 'shop' ? 'max-w-xl' : 'max-w-md'} bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6 transition-all duration-300`}>
        
        {/* Tab Selector */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => { setActiveTab('student'); setError(null); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'student'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Student Account</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('shop'); setError(null); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'shop'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Photocopy Kiosk</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeTab === 'student' ? 'Create Student Account' : 'Register Photocopy Kiosk'}
          </h1>
          <p className="text-xs text-slate-500">
            {activeTab === 'student'
              ? 'Fast online print passes across campus'
              : 'Join PrintPass network — automate student queues & manage rates'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {registeredShopInfo && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Kiosk Registered Successfully!</span>
            </div>
            <p>
              Your shop <strong>{registeredShopInfo.name}</strong> is live. Redirecting to your Owner Dashboard...
            </p>
          </div>
        )}

        {/* STUDENT REGISTRATION FORM */}
        {activeTab === 'student' && !registeredShopInfo && (
          <form onSubmit={handleStudentSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  placeholder="Aarav Patel"
                  className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  placeholder="aarav@college.edu"
                  className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={studentForm.password}
                  onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Number (Optional)</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-200 disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
            >
              <span>{loading ? 'Creating Account...' : 'Sign Up as Student'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* SHOP KIOSK REGISTRATION FORM */}
        {activeTab === 'shop' && !registeredShopInfo && (
          <form onSubmit={handleShopSubmit} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">1. Kiosk & Location Info</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Shop / Kiosk Name *</label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={shopForm.name}
                      onChange={(e) => handleShopNameChange(e.target.value)}
                      placeholder="e.g. Central Library Xerox"
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Shop Code / URL Slug *</label>
                  <div className="relative">
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={shopForm.code}
                      onChange={(e) => setShopForm({ ...shopForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                      placeholder="e.g. central-lib-xerox"
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Campus Location / Counter Address *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={shopForm.address}
                    onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                    placeholder="e.g. Ground Floor, Main Academic Building (Opposite Dept of CS)"
                    className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">2. Owner Credentials (Admin Access)</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Owner Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={shopForm.ownerName}
                      onChange={(e) => setShopForm({ ...shopForm, ownerName: e.target.value })}
                      placeholder="e.g. Ramesh Verma"
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Owner Email *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={shopForm.ownerEmail}
                      onChange={(e) => setShopForm({ ...shopForm, ownerEmail: e.target.value })}
                      placeholder="e.g. ramesh@xeroxpoint.com"
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Admin Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={shopForm.ownerPassword}
                      onChange={(e) => setShopForm({ ...shopForm, ownerPassword: e.target.value })}
                      placeholder="Min 6 characters"
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      value={shopForm.phone}
                      onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">3. Initial Page Rates (₹)</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">B/W Page Rate (₹)</label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={shopForm.bwRate}
                      onChange={(e) => setShopForm({ ...shopForm, bwRate: e.target.value })}
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Color Page Rate (₹)</label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={shopForm.colorRate}
                      onChange={(e) => setShopForm({ ...shopForm, colorRate: e.target.value })}
                      className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-200 disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
            >
              <span>{loading ? 'Registering Kiosk...' : 'Register Kiosk & Enter Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-indigo-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};
