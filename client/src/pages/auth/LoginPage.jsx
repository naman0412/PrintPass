import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Printer, Lock, Mail, AlertCircle, ArrowRight, Store } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await login(email, password);
      if (data.success && data.user) {
        if (data.user.role === 'operator' || data.user.role === 'owner') {
          navigate('/shop');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-200">
            <Printer className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Log in to PrintPass</h1>
          <p className="text-xs text-slate-500">Access your print passes and shop dashboard</p>
        </div>

        {/* 1-Click Demo Login Shortcuts */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
            1-Click Demo Logins:
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => fillDemoAccount('student@printpass.local')}
              className="py-1.5 px-2 rounded-xl text-xs font-bold bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-slate-700 transition-colors"
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('operator@printpass.local')}
              className="py-1.5 px-2 rounded-xl text-xs font-bold bg-white hover:bg-amber-50 hover:text-amber-800 border border-slate-200 text-slate-700 transition-colors"
            >
              Operator
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('owner@printpass.local')}
              className="py-1.5 px-2 rounded-xl text-xs font-bold bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-slate-700 transition-colors"
            >
              Owner
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-200 disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
          >
            <span>{loading ? 'Logging in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 space-y-3">
          {/* Direct Photocopy Kiosk Registration Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Store className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-amber-950">Own a Photocopy Shop?</span>
                <span className="block text-[11px] text-amber-700">Automate your campus print queue</span>
              </div>
            </div>
            <Link
              to="/register?tab=shop"
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold text-xs hover:bg-amber-100 transition-colors shrink-0 shadow-sm"
            >
              Register Kiosk
            </Link>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>Don't have an account?</span>
            <Link to="/register" className="font-bold text-indigo-600 hover:underline">
              Student Sign Up
            </Link>
            <span>•</span>
            <Link to="/register?tab=shop" className="font-bold text-amber-700 hover:underline">
              Kiosk Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
