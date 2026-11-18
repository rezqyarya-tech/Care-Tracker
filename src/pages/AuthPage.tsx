import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { useOwnerProfile } from '../hooks/useOwnerProfile';

export function AuthPage() {
  const { login, register, backendMode } = useOwnerProfile();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const cleanEmail = email.trim();
    if (mode === 'register' && !fullName.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal terdiri dari 6 karakter.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(cleanEmail, password);
      } else {
        await register(fullName.trim(), cleanEmail, password);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'login'
            ? 'Gagal masuk ke akun Anda.'
            : 'Gagal mendaftarkan akun baru.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] text-[#344A3A] flex flex-col justify-center px-4 py-10">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#E7EDE5] border border-[#C6D5C2] flex items-center justify-center mx-auto">
            <img src="/icon.svg" alt="" className="w-7 h-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#344A3A]">
            Personal Care Tracker
          </h1>
          <p className="text-sm text-[#616C62] max-w-sm mx-auto">
            Catat Rutinitas Anda. Pahami Kulit dan Rambut Anda.
          </p>
        </div>

        <div className="bg-white border border-[#E2E7DF] rounded-2xl p-6 sm:p-7 space-y-5">
          {/* Segmented Mode Tabs */}
          <div
            role="tablist"
            aria-label="Pilihan akses akun"
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F8F9F6] border border-[#E2E7DF]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-[#344A3A] shadow-xs border border-[#E2E7DF]'
                  : 'text-[#616C62] hover:text-[#344A3A]'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-[#344A3A] shadow-xs border border-[#E2E7DF]'
                  : 'text-[#616C62] hover:text-[#344A3A]'
              }`}
            >
              Daftar Akun
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-[#344A3A]">
              {mode === 'login' ? 'Masuk ke Catatan Pribadi Anda' : 'Buat Akun Pribadi Baru'}
            </h2>
            <p className="text-xs text-[#8A918A]">
              {mode === 'login'
                ? 'Gunakan email dan kata sandi Anda untuk membuka rutinitas dan jurnal.'
                : 'Daftar sekali agar seluruh produk, rutinitas, dan foto progres Anda terlindungi.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[#FDF2F1] border border-[#EBCAC6] text-xs text-[#A94438]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-[#616C62] mb-1.5">
                  Nama Lengkap *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8A918A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="cth. Arya Kusuma"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] focus-visible:outline-none focus-visible:border-[#78917A]"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#616C62] mb-1.5">
                Alamat Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8A918A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] focus-visible:outline-none focus-visible:border-[#78917A]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#616C62] mb-1.5">
                Kata Sandi *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8A918A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] focus-visible:outline-none focus-visible:border-[#78917A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#8A918A] hover:text-[#344A3A]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-medium text-[#616C62] mb-1.5"
                >
                  Ulangi Kata Sandi *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8A918A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E7DF] bg-white text-sm text-[#344A3A] focus-visible:outline-none focus-visible:border-[#78917A]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#78917A] text-white text-sm font-medium hover:bg-[#678069] transition-colors disabled:opacity-50"
            >
              {submitting
                ? mode === 'login'
                  ? 'Memproses masuk...'
                  : 'Membuat akun...'
                : mode === 'login'
                  ? 'Masuk'
                  : 'Buat Akun'}
            </button>
          </form>

          <div className="pt-3 border-t border-[#E2E7DF] flex items-start gap-2 text-xs text-[#616C62] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#78917A] shrink-0 mt-0.5" />
            <span>
              Akses dilindungi autentikasi akun dan sesi cookie terenkripsi server (
              {backendMode === 'supabase' ? 'Supabase Auth & PostgreSQL' : 'Brankas Server Lokal'}).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
