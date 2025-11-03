import { ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BellRing, ClipboardList, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { setPageRefreshCallback } from '../lib/reminderService';
import MedicationManager from './MedicationManager';
import AdherenceTracker from './AdherenceTracker';
import ReminderModal from './ReminderModal';

interface UserProfile {
  id: string;
  full_name: string;
  preferred_channel: 'email' | 'whatsapp' | 'telegram';
  whatsapp_number: string | null;
  telegram_chat_id: string | null;
  email: string | null;
}

interface MedicationWithSchedule {
  id: string;
  medication_name: string;
  dosage: string;
  instructions?: string;
  reminder_time: string;
}

interface DashboardProps {
  onNavigateToProfile: () => void;
}

export default function Dashboard({ onNavigateToProfile }: DashboardProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReminder, setActiveReminder] = useState<MedicationWithSchedule | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [insights, setInsights] = useState<{
    activeMedications: number;
    upcomingReminders: number;
    adherenceToday: number | null;
  }>({
    activeMedications: 0,
    upcomingReminders: 0,
    adherenceToday: null,
  });

  useEffect(() => {
    loadProfile();
  }, [user]);

  /**
   * Register page refresh callback for reminder triggers
   */
  useEffect(() => {
    const refreshCallback = () => {
      // Reload adherence data and snapshot
      void loadSnapshot();
      setRefreshTrigger(prev => prev + 1);
    };
    
    setPageRefreshCallback(refreshCallback);
  }, []);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
    } else if (data) {
      setProfile(data);
    } else {
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          full_name: user.email?.split('@')[0] || 'User',
          email: user.email,
          preferred_channel: 'email',
        })
        .select()
        .single();

      if (newProfile) {
        setProfile(newProfile);
      }
    }

    setLoading(false);
    void loadSnapshot();
  };

  const loadSnapshot = async () => {
    if (!user) return;

    const { data: meds } = await supabase
      .from('medications')
      .select('id')
      .eq('user_id', user.id)
      .eq('active', true);

    const medicationIds = meds?.map((med) => med.id) || [];

    let upcomingReminders = 0;

    if (medicationIds.length > 0) {
      const { data: schedules } = await supabase
        .from('medication_schedules')
        .select('id')
        .in('medication_id', medicationIds)
        .eq('active', true);

      upcomingReminders = schedules?.length ?? 0;
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: todayLogs } = await supabase
      .from('adherence_logs')
      .select('status')
      .eq('user_id', user.id)
      .gte('scheduled_time', `${today}T00:00:00`)
      .lte('scheduled_time', `${today}T23:59:59`);

    const taken = todayLogs?.filter((log) => log.status === 'taken').length ?? 0;
    const total = todayLogs?.length ?? 0;
    const adherenceToday = total > 0 ? Math.round((taken / total) * 100) : null;

    setInsights({
      activeMedications: medicationIds.length,
      upcomingReminders,
      adherenceToday,
    });
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-base font-semibold text-slate-500">
          Syncing your dashboard...
        </div>
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!user) {
    return null;
  }

  const preferredChannelLabel: Record<UserProfile['preferred_channel'], string> = {
    email: 'Email',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
  };

  const preferredChannelMissingDetails =
    profile &&
    ((profile.preferred_channel === 'email' && !profile.email) ||
      (profile.preferred_channel === 'whatsapp' && !profile.whatsapp_number) ||
      (profile.preferred_channel === 'telegram' && !profile.telegram_chat_id));

  return (
    <div className="space-y-10">
      <section className="surface-card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500 px-6 py-10 text-white sm:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-white/70">
                {currentDate}
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                {greeting}, {profile?.full_name?.split(' ')[0] || 'there'}.
              </h2>
              <p className="mt-3 max-w-xl text-base text-white/80">
                Stay ahead of your dosing schedule, review your adherence, and lean on MediBot
                whenever you need quick guidance.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl bg-white/10 px-6 py-4 text-sm backdrop-blur">
              <span className="text-xs uppercase tracking-wide text-white/70">
                Reminder channel
              </span>
              <div className="text-lg font-semibold">
                {profile ? preferredChannelLabel[profile.preferred_channel] : 'Not set'}
              </div>
              <button
                onClick={onNavigateToProfile}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
              >
                <User size={16} />
                Update preferences
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 bg-white px-6 py-6 sm:grid-cols-3 sm:px-10 sm:py-8">
          <InsightCard
            icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
            label="Active medications"
            value={insights.activeMedications.toString().padStart(2, '0')}
            helper="Keep your list current to personalise reminders."
          />
          <InsightCard
            icon={<BellRing className="h-5 w-5 text-emerald-600" />}
            label="Upcoming reminders"
            value={insights.upcomingReminders.toString().padStart(2, '0')}
            helper="Scheduled for the next 24 hours."
          />
          <InsightCard
            icon={<AlertCircle className="h-5 w-5 text-purple-600" />}
            label="Adherence today"
            value={
              insights.adherenceToday === null
                ? '--'
                : `${insights.adherenceToday.toString().padStart(2, '0')}%`
            }
            helper="Mark each dose to stay accountable."
          />
        </div>
      </section>

      {preferredChannelMissingDetails && (
        <div className="surface-card border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-800 sm:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
              <div>
                <p className="font-semibold">Reminder channel needs attention</p>
                <p>
                  Add valid contact details so reminders can reach you via{' '}
                  {profile ? preferredChannelLabel[profile.preferred_channel] : 'your chosen channel'}.
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateToProfile}
              className="action-primary bg-amber-500 hover:bg-amber-600 focus-visible:outline-amber-500"
            >
              Complete contact info
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <MedicationManager />
        <AdherenceTracker 
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Reminder Modal */}
      {activeReminder && (
        <ReminderModal
          medication={activeReminder}
          onClose={() => setActiveReminder(null)}
          onTaken={() => {
            setRefreshTrigger(prev => prev + 1);
            void loadSnapshot();
          }}
          onMissed={() => {
            setRefreshTrigger(prev => prev + 1);
            void loadSnapshot();
          }}
        />
      )}
    </div>
  );
}

interface InsightCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}

function InsightCard({ icon, label, value, helper }: InsightCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 px-5 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-inner">
          {icon}
        </span>
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">{helper}</p>
    </div>
  );
}
