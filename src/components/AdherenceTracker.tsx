import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, BarChart3 } from 'lucide-react';

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
}

interface AdherenceLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  taken_at: string | null;
  status: string;
}

interface TodayReminder {
  medication: Medication;
  time: string;
  log: AdherenceLog | null;
}



interface AdherenceTrackerProps {
  refreshTrigger?: number;
}

export default function AdherenceTracker({ refreshTrigger }: AdherenceTrackerProps) {
  const { user } = useAuth();
  const [todayReminders, setTodayReminders] = useState<TodayReminder[]>([]);
  const [adherenceStats, setAdherenceStats] = useState({
    today: 0,
    week: 0,
  });

  useEffect(() => {
    loadTodayReminders();
    loadAdherenceStats();
  }, [user, refreshTrigger]);

  const loadTodayReminders = async () => {
    if (!user) return;

    const { data: medsData } = await supabase
      .from('medications')
      .select('id, medication_name, dosage')
      .eq('user_id', user.id)
      .eq('active', true);

    if (!medsData) return;

    const { data: schedulesData } = await supabase
      .from('medication_schedules')
      .select('*')
      .in(
        'medication_id',
        medsData.map((m) => m.id)
      )
      .eq('active', true);

    if (!schedulesData) return;

    const today = new Date().toISOString().split('T')[0];

    const reminders: TodayReminder[] = [];

    for (const schedule of schedulesData) {
      const medication = medsData.find((m) => m.id === schedule.medication_id);
      if (!medication) continue;

      const scheduledDateTime = `${today}T${schedule.reminder_time}`;

      const { data: logData } = await supabase
        .from('adherence_logs')
        .select('*')
        .eq('medication_id', schedule.medication_id)
        .gte('scheduled_time', `${today}T00:00:00`)
        .lte('scheduled_time', `${today}T23:59:59`)
        .eq('scheduled_time', scheduledDateTime)
        .maybeSingle();

      reminders.push({
        medication,
        time: schedule.reminder_time,
        log: logData,
      });
    }

    reminders.sort((a, b) => a.time.localeCompare(b.time));
    setTodayReminders(reminders);
  };

  const loadAdherenceStats = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data: todayLogs } = await supabase
      .from('adherence_logs')
      .select('status')
      .eq('user_id', user.id)
      .gte('scheduled_time', `${today}T00:00:00`)
      .lte('scheduled_time', `${today}T23:59:59`);

    const { data: weekLogs } = await supabase
      .from('adherence_logs')
      .select('status')
      .eq('user_id', user.id)
      .gte('scheduled_time', weekAgo);

    const todayTaken = todayLogs?.filter((log) => log.status === 'taken').length || 0;
    const todayTotal = todayLogs?.length || 0;
    const todayPercent = todayTotal > 0 ? Math.round((todayTaken / todayTotal) * 100) : 0;

    const weekTaken = weekLogs?.filter((log) => log.status === 'taken').length || 0;
    const weekTotal = weekLogs?.length || 0;
    const weekPercent = weekTotal > 0 ? Math.round((weekTaken / weekTotal) * 100) : 0;

    setAdherenceStats({
      today: todayPercent,
      week: weekPercent,
    });
  };

  const markAsTaken = async (reminder: TodayReminder) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const scheduledDateTime = `${today}T${reminder.time}`;

    if (reminder.log) {
      await supabase
        .from('adherence_logs')
        .update({
          status: 'taken',
          taken_at: new Date().toISOString(),
        })
        .eq('id', reminder.log.id);
    } else {
      await supabase.from('adherence_logs').insert({
        medication_id: reminder.medication.id,
        user_id: user.id,
        scheduled_time: scheduledDateTime,
        taken_at: new Date().toISOString(),
        status: 'taken',
      });
    }

    loadTodayReminders();
    loadAdherenceStats();
  };

  const markAsMissed = async (reminder: TodayReminder) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const scheduledDateTime = `${today}T${reminder.time}`;

    if (reminder.log) {
      await supabase
        .from('adherence_logs')
        .update({
          status: 'missed',
          taken_at: null,
        })
        .eq('id', reminder.log.id);
    } else {
      await supabase.from('adherence_logs').insert({
        medication_id: reminder.medication.id,
        user_id: user.id,
        scheduled_time: scheduledDateTime,
        status: 'missed',
      });
    }

    loadTodayReminders();
    loadAdherenceStats();
  };

  return (
    <div className="surface-card px-6 py-6 sm:px-8 sm:py-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="section-title">
            <BarChart3 size={30} className="text-emerald-600" />
            <span>Today&apos;s adherence</span>
          </div>
          <p className="section-subtitle mt-1">
            Check in on scheduled doses and record what really happened today.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <AdherenceStat
          label="Completion today"
          value={`${adherenceStats.today}%`}
          tone="emerald"
          caption="Mark each dose as you go to keep this at 100%."
        />
        <AdherenceStat
          label="Past 7 days"
          value={`${adherenceStats.week}%`}
          tone="blue"
          caption="Consistency builds confidence - review trends every week."
        />
      </div>

      <div className="mt-8 space-y-4">
        {todayReminders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-slate-500">
            <CheckCircle size={54} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-semibold text-slate-600">Nothing scheduled today</p>
            <p className="mt-2 text-sm">
              Add reminders in the medication library to see them show up here.
            </p>
          </div>
        ) : (
          todayReminders.map((reminder, index) => {
            const isPast =
              reminder.time < new Date().toTimeString().split(' ')[0].slice(0, 5);
            const isTaken = reminder.log?.status === 'taken';
            const isMissed = reminder.log?.status === 'missed';
            const isNotTakenAuto = reminder.log?.status === 'not_taken_auto';

            return (
              <div
                key={index}
                className={`rounded-2xl border px-5 py-5 transition ${
                  isTaken
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : isMissed || isNotTakenAuto
                      ? 'border-rose-200 bg-rose-50/70'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      {reminder.time.slice(0, 5)}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">
                      {reminder.medication.medication_name}
                    </h3>
                    <p className="text-sm text-slate-500">{reminder.medication.dosage}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isTaken && (
                      <span className="pill-tag bg-emerald-100 text-emerald-700">
                        <CheckCircle size={16} />
                        Taken
                      </span>
                    )}
                    {isMissed && (
                      <span className="pill-tag bg-rose-100 text-rose-700">
                        <XCircle size={16} />
                        Missed
                      </span>
                    )}
                    {isNotTakenAuto && (
                      <span className="pill-tag bg-rose-100 text-rose-700">
                        <XCircle size={16} />
                        Not Taken (Auto)
                      </span>
                    )}
                    {!isTaken && !isMissed && !isNotTakenAuto && isPast && (
                      <span className="pill-tag bg-amber-100 text-amber-700">
                        Running late
                      </span>
                    )}
                  </div>
                </div>

                {!isTaken && !isMissed && !isNotTakenAuto && (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => markAsTaken(reminder)}
                      className="action-primary flex-1 bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600"
                    >
                      <CheckCircle size={18} />
                      Mark as taken
                    </button>
                    {isPast && (
                      <button
                        onClick={() => markAsMissed(reminder)}
                        className="action-secondary flex-1 border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:text-rose-700"
                      >
                        <XCircle size={18} />
                        Missed this dose
                      </button>
                    )}
                  </div>
                )}

                {isTaken && (
                  <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-emerald-700">
                    Recorded at{' '}
                    {reminder.log?.taken_at
                      ? new Date(reminder.log.taken_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'â€"'}
                  </p>
                )}

                {(isMissed || isNotTakenAuto) && (
                  <button
                    onClick={() => markAsTaken(reminder)}
                    className="mt-4 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                  >
                    {isNotTakenAuto ? 'Mark as taken (update)' : 'Actually, I took it'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface AdherenceStatProps {
  label: string;
  value: string;
  tone: 'emerald' | 'blue';
  caption: string;
}

function AdherenceStat({ label, value, tone, caption }: AdherenceStatProps) {
  const palette =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-600'
      : 'bg-blue-50 text-blue-600';

  return (
    <div className={`rounded-2xl border border-slate-200 px-5 py-4 ${palette}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-3 text-sm text-slate-600">{caption}</p>
    </div>
  );
}



