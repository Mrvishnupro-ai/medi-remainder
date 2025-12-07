import { supabase } from './supabase';

export interface MedicationWithSchedule {
  id: string;
  medication_name: string;
  dosage: string;
  instructions?: string;
  reminder_time: string;
}

interface ReminderNotificationOptions {
  title: string;
  options: NotificationOptions & { vibrate?: number[] };
}

let reminderCheckInterval: NodeJS.Timeout | null = null;
let lastNotifiedReminders: Set<string> = new Set();
let reminderCallback: ((medication: MedicationWithSchedule) => void) | null = null;
let pageRefreshCallback: (() => void) | null = null;
let nextCheckTimeout: NodeJS.Timeout | null = null;

export type AdherenceStatus = 'taken' | 'missed' | 'not_taken_auto';
export const AUTO_NOT_TAKEN_TIMEOUT_MS = 5 * 60 * 1000;

const autoMarkTimeouts = new Map<string, NodeJS.Timeout>();

function getReminderKey(userId: string, medicationId: string, reminderTime: string): string {
  return `${userId}:${medicationId}:${reminderTime}`;
}

export function clearAutoMarkTimeout(userId: string, medicationId: string, reminderTime: string): void {
  const key = getReminderKey(userId, medicationId, reminderTime);
  const timer = autoMarkTimeouts.get(key);
  if (timer) {
    clearTimeout(timer);
    autoMarkTimeouts.delete(key);
  }
}

function scheduleAutoMarkNotTaken(userId: string, medication: MedicationWithSchedule): void {
  const key = getReminderKey(userId, medication.id, medication.reminder_time);

  const existingTimer = autoMarkTimeouts.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    autoMarkTimeouts.delete(key);
    void recordAdherenceStatus({
      userId,
      medicationId: medication.id,
      reminderTime: medication.reminder_time,
      status: 'not_taken_auto',
      skipIfCompleted: true,
    });
  }, AUTO_NOT_TAKEN_TIMEOUT_MS);

  autoMarkTimeouts.set(key, timer);
}

interface RecordAdherenceOptions {
  userId: string;
  medicationId: string;
  reminderTime: string;
  status: AdherenceStatus;
  skipIfCompleted?: boolean;
}

function getScheduledDateTime(reminderTime: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${today}T${reminderTime}`;
}

export async function recordAdherenceStatus({
  userId,
  medicationId,
  reminderTime,
  status,
  skipIfCompleted = false,
}: RecordAdherenceOptions): Promise<void> {
  const scheduledDateTime = getScheduledDateTime(reminderTime);

  try {
    const { data: existingLog, error: existingError } = await supabase
      .from('adherence_logs')
      .select('id, status')
      .eq('medication_id', medicationId)
      .eq('user_id', userId)
      .eq('scheduled_time', scheduledDateTime)
      .maybeSingle();

    if (existingError) {
      console.error('Error reading adherence log:', existingError);
      return;
    }

    if (
      skipIfCompleted &&
      existingLog &&
      (existingLog.status === 'taken' || existingLog.status === 'missed')
    ) {
      clearAutoMarkTimeout(userId, medicationId, reminderTime);
      return;
    }

    const isTaken = status === 'taken';
    const payload = {
      status,
      taken_at: isTaken ? new Date().toISOString() : null,
    };

    if (existingLog) {
      const { error: updateError } = await supabase
        .from('adherence_logs')
        .update(payload)
        .eq('id', existingLog.id);

      if (updateError) {
        console.error('Error updating adherence log:', updateError);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from('adherence_logs').insert({
        medication_id: medicationId,
        user_id: userId,
        scheduled_time: scheduledDateTime,
        ...payload,
      });

      if (insertError) {
        console.error('Error inserting adherence log:', insertError);
        return;
      }
    }

    if (status !== 'not_taken_auto') {
      clearAutoMarkTimeout(userId, medicationId, reminderTime);
    }

    if (pageRefreshCallback) {
      pageRefreshCallback();
    }
  } catch (error) {
    console.error('Error recording adherence status:', error);
  }
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  return false;
}

/**
 * Show a web notification for a medication reminder
 */
export function showNotification(medication: MedicationWithSchedule): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.log('Notifications not available or not granted');
    return;
  }

  const title = `Medication Reminder: ${medication.medication_name}`;
  const options: ReminderNotificationOptions = {
    title,
    options: {
      body: `Take ${medication.dosage} at ${medication.reminder_time}${medication.instructions ? `\n${medication.instructions}` : ''
        }`,
      icon: '/pill-icon.png',
      badge: '/pill-badge.png',
      tag: `reminder-${medication.id}`,
      requireInteraction: true, // Keep notification until user dismisses
      vibrate: [200, 100, 200],
    },
  };

  try {
    const notification = new Notification(options.title, options.options);

    // Auto-close after 10 seconds if user doesn't interact
    const autoCloseTimer = setTimeout(() => {
      notification.close();
    }, 10000);

    notification.onclick = () => {
      clearTimeout(autoCloseTimer);
      notification.close();
      // Focus window if minimized
      if (window.parent) {
        window.parent.focus();
      }
    };

    notification.onclose = () => {
      clearTimeout(autoCloseTimer);
    };
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

/**
 * Get current time in HH:MM format
 */
function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Fetch due reminders for the current user
 */
async function fetchDueReminders(userId: string): Promise<MedicationWithSchedule[]> {
  try {
    const currentTime = getCurrentTimeString();

    const { data: schedules, error: schedulesError } = await supabase
      .from('medication_schedules')
      .select(
        `
        id,
        reminder_time,
        medications (
          id,
          medication_name,
          dosage,
          instructions
        )
      `
      )
      .eq('active', true)
      .eq('reminder_time', currentTime);

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      return [];
    }

    if (!schedules || schedules.length === 0) {
      return [];
    }

    // Verify medications belong to the current user
    const { data: medications, error: medicationsError } = await supabase
      .from('medications')
      .select('id, user_id')
      .eq('user_id', userId)
      .eq('active', true);

    if (medicationsError || !medications) {
      console.error('Error fetching medications:', medicationsError);
      return [];
    }

    const userMedicationIds = new Set(medications.map((m) => m.id));

    return schedules
      .filter((schedule: any) => {
        const med = schedule.medications as any;
        return med && userMedicationIds.has(med.id);
      })
      .map((schedule: any) => ({
        id: schedule.medications.id,
        medication_name: schedule.medications.medication_name,
        dosage: schedule.medications.dosage,
        instructions: schedule.medications.instructions,
        reminder_time: schedule.reminder_time,
      }));
  } catch (error) {
    console.error('Error fetching due reminders:', error);
    return [];
  }
}

/**
 * Check for due reminders and show notifications
 */
async function checkAndNotifyReminders(userId: string): Promise<void> {
  try {
    const dueReminders = await fetchDueReminders(userId);

    for (const reminder of dueReminders) {
      const reminderId = `${reminder.id}-${reminder.reminder_time}`;

      // Only notify once per minute per reminder
      if (!lastNotifiedReminders.has(reminderId)) {
        lastNotifiedReminders.add(reminderId);

        scheduleAutoMarkNotTaken(userId, reminder);

        // Trigger page refresh
        if (pageRefreshCallback) {
          pageRefreshCallback();
        }

        // Show modal via callback if available
        if (reminderCallback) {
          reminderCallback(reminder);
        } else {
          // Fallback to browser notification if callback not set
          showNotification(reminder);
        }

        // Clean up after 61 seconds to allow re-notification next minute
        setTimeout(() => {
          lastNotifiedReminders.delete(reminderId);
        }, 61000);
      }
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}

/**
 * Start the reminder checking service
 * Checks for reminders every minute
 */
export function startReminderService(userId: string): void {
  if (reminderCheckInterval) {
    console.log('Reminder service already running');
    return;
  }

  console.log('Starting reminder service for user:', userId);

  // Check immediately
  checkAndNotifyReminders(userId);
  checkMissedMedications(userId);

  // Set up interval to check every minute (at the start of each minute)
  const checkReminders = () => {
    const now = new Date();
    const secondsUntilNextMinute = 60 - now.getSeconds();
    const msUntilNextMinute = (secondsUntilNextMinute % 60) * 1000 - now.getMilliseconds();

    nextCheckTimeout = setTimeout(() => {
      checkAndNotifyReminders(userId);
      // After first check, set up regular interval
      reminderCheckInterval = setInterval(() => {
        checkAndNotifyReminders(userId);
      }, 60000); // Check every 60 seconds
    }, Math.max(0, msUntilNextMinute));
  };

  checkReminders();
}

/**
 * Stop the reminder checking service
 */
export function stopReminderService(): void {
  if (reminderCheckInterval) {
    clearInterval(reminderCheckInterval);
    reminderCheckInterval = null;
    console.log('Reminder service stopped');
  }
  if (nextCheckTimeout) {
    clearTimeout(nextCheckTimeout);
    nextCheckTimeout = null;
  }
  lastNotifiedReminders.clear();
  autoMarkTimeouts.forEach((timeout) => clearTimeout(timeout));
  autoMarkTimeouts.clear();
}

/**
 * Check if reminder service is running
 */
export function isReminderServiceRunning(): boolean {
  return reminderCheckInterval !== null;
}

/**
 * Register a callback to be called when a reminder is due
 * This allows the UI to show a modal instead of just a browser notification
 */
export function setReminderCallback(callback: (medication: MedicationWithSchedule) => void): void {
  reminderCallback = callback;
}

/**
 * Check for 3 consecutive days of missed medications
 */
async function checkMissedMedications(userId: string): Promise<void> {
  try {
    const today = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(today.getDate() - 3);

    const { data: logs } = await supabase
      .from('adherence_logs')
      .select('medication_id, status, scheduled_time')
      .eq('user_id', userId)
      .gte('scheduled_time', threeDaysAgo.toISOString())
      .in('status', ['missed', 'not_taken_auto']);

    if (!logs || logs.length === 0) return;

    // Group by medication
    const missedByMed = new Map<string, Set<string>>();
    logs.forEach(log => {
      const date = new Date(log.scheduled_time).toDateString();
      if (!missedByMed.has(log.medication_id)) {
        missedByMed.set(log.medication_id, new Set());
      }
      missedByMed.get(log.medication_id)?.add(date);
    });

    // Check for 3 active days
    for (const [medId, dates] of missedByMed.entries()) {
      if (dates.size >= 3) {
        // Fetch medication name and family members
        const { data: med } = await supabase.from('medications').select('medication_name').eq('id', medId).single();
        const { data: family } = await supabase.from('family_members').select('name, email').eq('user_id', userId);

        if (family && family.length > 0) {
          for (const member of family) {
            if (member.email) {
              console.log(`[ALERT] Sending email to ${member.name} (${member.email}) for missed medication: ${med?.medication_name}`);

              await supabase.functions.invoke('send-reminders', {
                body: {
                  mode: 'send-alert',
                  to: member.email,
                  message: `Hello ${member.name}, checking in for ${med?.medication_name}. The patient has missed 3 consecutive doses. Please check on them.`,
                  subject: `Urgent: Missed Medication Alert - ${med?.medication_name}`
                }
              });
            }
          }

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Family Alert Triggered', {
              body: `We've notified your family members about missed doses of ${med?.medication_name}.`,
              icon: '/alert-icon.png'
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking missed medications:', error);
  }
}

/**
 * Register a callback to refresh the page when a reminder is triggered
 */
export function setPageRefreshCallback(callback: () => void): void {
  pageRefreshCallback = callback;
}

