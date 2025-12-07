

import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MessageCircle, Send, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import ContactPreferences from './ContactPreferences';
import { BasicHealthInfo, FamilyMembersManager, DoctorAppointmentsManager } from './HealthProfile';

interface UserProfile {
  id: string;
  full_name: string;
  preferred_channel: 'email' | 'whatsapp' | 'telegram';
  whatsapp_number: string | null;
  telegram_chat_id: string | null;
  email: string | null;
}

interface ProfileProps {
  onBackToDashboard: () => void;
}

export default function Profile({ onBackToDashboard }: ProfileProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelMessage, setChannelMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  useEffect(() => {
    loadProfile();
  }, [user]);

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
      setChannelMessage(null);
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
        setChannelMessage(null);
      }
    }

    setLoading(false);
  };

  const hasContactForChannel = (channel: UserProfile['preferred_channel']) => {
    if (!profile) return false;

    if (channel === 'email') {
      return Boolean(profile.email);
    }
    if (channel === 'whatsapp') {
      return Boolean(profile.whatsapp_number);
    }
    if (channel === 'telegram') {
      return Boolean(profile.telegram_chat_id);
    }
    return false;
  };

  const updateChannel = async (channel: UserProfile['preferred_channel']) => {
    if (!user || !profile) return;

    if (!hasContactForChannel(channel)) {
      setChannelMessage({
        type: 'error',
        text: `Add valid ${channel} contact details before selecting it as your preferred reminder channel.`,
      });
      return;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ preferred_channel: channel })
      .eq('id', user.id);

    if (!error) {
      setProfile({ ...profile, preferred_channel: channel });
      setChannelMessage({
        type: 'success',
        text: `Reminder channel updated to ${channel}.`,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="text-base font-semibold text-slate-500">Loading profile settings...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="surface-card px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="section-title">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-600">
                {profile?.full_name?.charAt(0).toUpperCase() ?? 'M'}
              </span>
              <span>Profile & notification settings</span>
            </div>
            <p className="section-subtitle mt-1">
              Keep your reminder channels and contact details accurate so MediBot reaches you on time.
            </p>
          </div>
          <button
            onClick={onBackToDashboard}
            className="action-secondary self-start"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </button>
        </div>
        <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account email
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">{profile?.email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Preferred reminder channel
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {profile ? profile.preferred_channel : 'Not set'}
            </p>
          </div>
        </div>
      </section>

      <section className="surface-card px-6 py-6 sm:px-8 sm:py-7">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Reminder delivery</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose the primary channel for day-to-day reminders. You can switch anytime.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <ChannelCard
            label="WhatsApp"
            description="Instant reminders and check-ins through your saved mobile number."
            icon={<MessageCircle size={24} />}
            active={profile?.preferred_channel === 'whatsapp'}
            onClick={() => updateChannel('whatsapp')}
          />
          <ChannelCard
            label="Telegram"
            description="Secure reminders via the MediBot Telegram assistant."
            icon={<Send size={24} />}
            active={profile?.preferred_channel === 'telegram'}
            onClick={() => updateChannel('telegram')}
          />
          <ChannelCard
            label="Email"
            description="Detailed summaries and daily reminders straight to your inbox."
            icon={<Mail size={24} />}
            active={profile?.preferred_channel === 'email'}
            onClick={() => updateChannel('email')}
          />
        </div>

        {channelMessage && (
          <div
            className={`mt-6 flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm ${channelMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
          >
            <AlertCircle size={20} />
            <span className="font-medium">{channelMessage.text}</span>
          </div>
        )}
      </section>

      {profile && (
        <ContactPreferences
          user={user}
          profile={profile}
          onProfileUpdate={setProfile}
        />
      )}

      <BasicHealthInfo />
      <FamilyMembersManager />
      <DoctorAppointmentsManager />
    </div>
  );
}

interface ChannelCardProps {
  label: string;
  description: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}

function ChannelCard({ label, description, icon, active, onClick }: ChannelCardProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-5 py-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${active
        ? 'border-blue-500 bg-blue-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60'
        }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          {icon}
        </span>
        <span className="text-base font-semibold text-slate-900">{label}</span>
      </div>
      <p className="mt-3 text-sm text-slate-600">{description}</p>
    </button>
  );
}


