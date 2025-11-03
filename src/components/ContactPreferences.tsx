import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { CheckCircle, AlertCircle, Send, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  full_name: string;
  preferred_channel: 'email' | 'whatsapp' | 'telegram';
  whatsapp_number: string | null;
  telegram_chat_id: string | null;
  email: string | null;
}

interface ContactFormState {
  fullName: string;
  email: string;
  whatsappNumber: string;
  telegramChatId: string;
}

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

interface ContactPreferencesProps {
  user: User;
  profile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
}

const channelHelpers: Record<UserProfile['preferred_channel'], string> = {
  email: 'Use the inbox you check daily; we send daily summaries and urgent follow-ups.',
  whatsapp: 'Enter the full international number (E.164), e.g. +15551234567.',
  telegram: 'Supply the chat ID that MediBot can message directly.',
};

export default function ContactPreferences({
  user,
  profile,
  onProfileUpdate,
}: ContactPreferencesProps) {
  const [formData, setFormData] = useState<ContactFormState>({
    fullName: profile.full_name ?? '',
    email: profile.email ?? '',
    whatsappNumber: profile.whatsapp_number ?? '',
    telegramChatId: profile.telegram_chat_id ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [testStatus, setTestStatus] = useState<StatusMessage | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState(
    'This is a test notification from the MediBot reminder system.'
  );

  useEffect(() => {
    setFormData({
      fullName: profile.full_name ?? '',
      email: profile.email ?? '',
      whatsappNumber: profile.whatsapp_number ?? '',
      telegramChatId: profile.telegram_chat_id ?? '',
    });
  }, [profile]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    const updatePayload = {
      full_name: formData.fullName.trim() || profile.full_name,
      email: formData.email.trim() || null,
      whatsapp_number: formData.whatsappNumber.trim() || null,
      telegram_chat_id: formData.telegramChatId.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      setStatus({
        type: 'error',
        message: `Unable to save contact preferences: ${error.message}`,
      });
    } else if (data) {
      onProfileUpdate({
        ...profile,
        ...data,
      });
      setStatus({
        type: 'success',
        message: 'Contact preferences saved successfully.',
      });
    }

    setSaving(false);
  };

  const handleTestReminder = async () => {
    setSendingTest(true);
    setTestStatus(null);

    const { error, data } = await supabase.functions.invoke('send-reminders', {
      body: {
        mode: 'test',
        userId: user.id,
        channel: profile.preferred_channel,
        message: testMessage,
      },
    });

    if (error) {
      setTestStatus({
        type: 'error',
        message: `Failed to trigger test reminder: ${error.message}`,
      });
    } else if (data?.results?.[0]?.status === 'sent') {
      setTestStatus({
        type: 'success',
        message: `Test reminder sent via ${data.results[0].channel}. Check your ${data.results[0].channel} inbox.`,
      });
    } else {
      setTestStatus({
        type: 'error',
        message: 'Test reminder could not be delivered. Check your contact details and try again.',
      });
    }

    setSendingTest(false);
  };

  return (
    <div className="surface-card mt-6 px-6 py-6 sm:px-8 sm:py-7">
      <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
        Contact & delivery preferences
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Keep these details accurate so reminders reach you without interruption.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Full name
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Email address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="you@example.com"
          />
          <p className="mt-2 text-xs text-slate-500">{channelHelpers.email}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <label className="block text-sm font-semibold text-slate-700">
              WhatsApp number
            </label>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
              <Zap size={12} />
              Upcoming
            </span>
          </div>
          <input
            type="tel"
            value={formData.whatsappNumber}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                whatsappNumber: event.target.value,
              }))
            }
            disabled
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-500 shadow-sm cursor-not-allowed"
            placeholder="+15551234567"
          />
          <p className="mt-2 text-xs text-slate-500">{channelHelpers.whatsapp}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <label className="block text-sm font-semibold text-slate-700">
              Telegram chat ID
            </label>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
              <Zap size={12} />
              Upcoming
            </span>
          </div>
          <input
            type="text"
            value={formData.telegramChatId}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                telegramChatId: event.target.value,
              }))
            }
            disabled
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-500 shadow-sm cursor-not-allowed"
            placeholder="123456789"
          />
          <p className="mt-2 text-xs text-slate-500">{channelHelpers.telegram}</p>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-5 md:flex-row md:items-start md:justify-between">
          <div className="w-full md:max-w-lg">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Send a test reminder
            </label>
            <input
              type="text"
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Custom message to send through your preferred channel"
            />
            <p className="mt-2 text-xs text-slate-500">
              Confirm your primary channel works as expected before relying on it.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTestReminder}
            disabled={sendingTest}
            className="action-primary bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600 md:self-end"
          >
            <Send size={18} />
            {sendingTest ? 'Sending...' : 'Send test reminder'}
          </button>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={saving}
            className="action-primary bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600 sm:w-auto"
          >
            {saving ? 'Saving...' : 'Save contact details'}
          </button>
        </div>
      </form>

      {status && (
        <StatusBanner
          tone={status.type}
          message={status.message}
          className="mt-6"
        />
      )}

      {testStatus && (
        <StatusBanner
          tone={testStatus.type}
          message={testStatus.message}
          className="mt-4"
        />
      )}
    </div>
  );
}

interface StatusBannerProps {
  tone: 'success' | 'error';
  message: string;
  className?: string;
}

function StatusBanner({ tone, message, className = '' }: StatusBannerProps) {
  const styles =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-rose-200 bg-rose-50 text-rose-700';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm ${styles} ${className}`}>
      {tone === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
}

