import { ReactNode, useMemo, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  UserCircle,
  LogOut,
  Pill,
  Bot,
  Settings,
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import ChatbotWidget from './components/ChatbotWidget';
import ReminderModal from './components/ReminderModal';
import {
  startReminderService,
  stopReminderService,
  requestNotificationPermission,
  setReminderCallback,
  MedicationWithSchedule,
} from './lib/reminderService';

type NavKey = 'dashboard' | 'profile';

interface NavItem {
  key: NavKey;
  label: string;
  description: string;
  icon: ReactNode;
}

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<NavKey>('dashboard');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeReminder, setActiveReminder] = useState<MedicationWithSchedule | null>(null);

  // Start reminder service when user logs in
  useEffect(() => {
    if (user && !loading) {
      // Set up reminder callback to show modal
      setReminderCallback((medication: MedicationWithSchedule) => {
        setActiveReminder(medication);
      });

      startReminderService(user.id);

      // Request notification permission (best effort)
      requestNotificationPermission()
        .then((granted) => {
          setNotificationsEnabled(granted);
        })
        .catch((error) => {
          console.error('Error starting reminder service:', error);
        });
    } else if (!user && !loading) {
      // Stop reminder service when user logs out
      stopReminderService();
      setActiveReminder(null);
    }

    return () => {
      // Cleanup on component unmount
      stopReminderService();
      setActiveReminder(null);
    };
    }, [user, loading]);

  const initials = useMemo(() => {
    const fullName =
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      'User';

    return fullName
      .split(' ')
      .map((part: string) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [user]);

  const navItems: NavItem[] = [
    {
      key: 'dashboard',
      label: 'Overview',
      description: "Today's plan & insights",
      icon: <LayoutDashboard className="h-5 w-5" aria-hidden />,
    },
    {
      key: 'profile',
      label: 'Profile & Alerts',
      description: 'Contact details & reminder channels',
      icon: <UserCircle className="h-5 w-5" aria-hidden />,
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cyan">
        <div className="space-y-4 text-center">
          <div className="inline-block h-20 w-20 animate-spin rounded-full border-4 border-white border-b-brand-navy" />
          <p className="text-lg font-medium text-brand-navy">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="flex min-h-screen bg-brand-cyan gap-4 p-4 sm:p-6 lg:p-8">
      {/* Left Sidebar */}
      <aside className="hidden w-72 flex-col justify-between rounded-3xl bg-brand-navy p-8 text-white md:flex">
        <div className="space-y-8">
          {/* Profile Header */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-xl font-semibold text-white">
              {initials || 'MB'}
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">{user.user_metadata?.full_name || 'MediBot'}</p>
              <p className="text-xs text-white/70">Care Hub</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-3">
            {navItems.map((item) => {
              const active = currentPage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setCurrentPage(item.key)}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-white/70">{item.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Quick Stats */}
          <div className="space-y-3 rounded-2xl bg-white/10 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">Quick stats</p>
            <div className="space-y-2 text-sm text-white/80">
              <p className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-brand-teal" />
                Active medications synced
              </p>
              <p className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-brand-teal" />
                AI assistant available 24/7
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-2 border-t border-white/20 pt-6">
          <button className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
            <Settings className="h-5 w-5" />
            Settings
          </button>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col rounded-3xl bg-white/95 shadow-lg overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white/80 px-6 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-teal">
                Welcome back
              </p>
              <h1 className="mt-2 text-2xl font-bold text-brand-navy sm:text-3xl">
                {currentPage === 'dashboard' ? 'Daily Health Command Center' : 'Profile & Preferences'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {notificationsEnabled && (
                <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1">
                  <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                  <span className="text-xs font-semibold text-green-700">Reminders On</span>
                </div>
              )}
              <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/20 text-brand-navy font-bold">
                  {initials || 'MB'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-navy">
                    {user.user_metadata?.full_name || 'MediBot user'}
                  </p>
                  <p className="text-xs text-gray-600">Stay on track today</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
          {currentPage === 'dashboard' ? (
            <Dashboard onNavigateToProfile={() => setCurrentPage('profile')} />
          ) : (
            <Profile onBackToDashboard={() => setCurrentPage('dashboard')} />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur md:hidden">
        <nav className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          {navItems.map((item) => {
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setCurrentPage(item.key)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                  active ? 'bg-brand-navy text-white shadow-inner' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg">
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
          <button
            onClick={signOut}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg">
              <LogOut className="h-4 w-4" aria-hidden />
            </span>
            Sign out
          </button>
        </nav>
      </div>

      {/* Floating Chatbot Widget */}
      <ChatbotWidget />

      {/* Reminder Modal */}
      {activeReminder && (
        <ReminderModal
          medication={activeReminder}
          onClose={() => setActiveReminder(null)}
          onTaken={() => {
            // Optionally trigger any UI refresh here
            console.log('Medication marked as taken');
          }}
          onMissed={() => {
            // Optionally trigger any UI refresh here
            console.log('Medication marked as missed');
          }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
