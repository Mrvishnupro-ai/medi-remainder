import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isSignUp && !fullName.trim()) {
      setError('Please enter your full name');
      setLoading(false);
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const { error: authError } = isSignUp
      ? await signUp(email, password, fullName)
      : await signIn(email, password);

    if (authError) {
      setError(authError.message);
    }

    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-6 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_50%)]" />

      <div className="mx-auto grid w-full max-w-5xl gap-10 rounded-3xl border border-white/50 bg-white/80 p-8 backdrop-blur xl:grid-cols-[1.1fr,0.9fr]">
        <section className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-emerald-500 px-8 py-10 text-white shadow-lg">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
              MediBot
            </span>
            <h1 className="text-4xl font-semibold leading-tight">
              Stay on top of every dose with proactive reminders and intelligent guidance.
            </h1>
            <p className="text-sm text-white/80">
              MediBot keeps a personal log of your medications, schedules reminders across your favourite channels, and tracks adherence so you and your care team stay aligned.
            </p>
          </div>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
                1
              </span>
              Build a clean medication list with clear dosing instructions.
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
                2
              </span>
              Record each dose to keep adherence above 90%.
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
                3
              </span>
              Ask MediBot for guidance when plans change or questions arise.
            </li>
          </ul>
        </section>

        <section className="surface-card px-6 py-8 sm:px-8">
          <div className="text-left">
            <h2 className="text-2xl font-semibold text-slate-900">
              {isSignUp ? 'Create your MediBot account' : 'Sign in to MediBot'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {isSignUp
                ? "We'll help you set up reminders and keep your medication routine on track."
                : "Welcome back. Pick up where you left off with today's schedule."}
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {isSignUp && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter your name"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="action-primary w-full justify-center bg-blue-600 py-4 text-base hover:bg-blue-700 focus-visible:outline-blue-600"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : isSignUp ? (
                <>
                  <UserPlus size={18} />
                  Create account
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign in
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <span>Or continue with</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <button
              onClick={signInWithGoogle}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <span className="flex items-center justify-center gap-3">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </span>
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-slate-600">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="font-semibold text-blue-600 transition hover:text-blue-700"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : 'Need an account? Create one'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

