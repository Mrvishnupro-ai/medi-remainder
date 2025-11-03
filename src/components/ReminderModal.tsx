import { X, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import {
  AUTO_NOT_TAKEN_TIMEOUT_MS,
  clearAutoMarkTimeout,
  recordAdherenceStatus,
} from '../lib/reminderService';

interface MedicationWithSchedule {
  id: string;
  medication_name: string;
  dosage: string;
  instructions?: string;
  reminder_time: string;
}

interface ReminderModalProps {
  medication: MedicationWithSchedule;
  onClose: () => void;
  onTaken: () => void;
  onMissed: () => void;
}

const REMINDER_TIMEOUT_MS = AUTO_NOT_TAKEN_TIMEOUT_MS; // 5 minutes in milliseconds

export default function ReminderModal({
  medication,
  onClose,
  onTaken,
  onMissed,
}: ReminderModalProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(REMINDER_TIMEOUT_MS / 1000); // 5 minutes in seconds
  const [isAutoClosing, setIsAutoClosing] = useState(false);

  /**
   * 5-minute timeout: Auto-mark as "not taken" if no response
   */
  useEffect(() => {
    // Timer countdown
    const countdownInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Auto-close and mark as not taken
          setIsAutoClosing(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  /**
   * Auto-mark as not taken when 5 minutes elapse
   */
  useEffect(() => {
    if (isAutoClosing && !isLoading) {
      void handleAutoMarkAsMissed();
    }
  }, [isAutoClosing, isLoading]);

  /**
   * Auto-mark medication as not taken
   */
  const handleAutoMarkAsMissed = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      await recordAdherenceStatus({
        userId: user.id,
        medicationId: medication.id,
        reminderTime: medication.reminder_time,
        status: 'not_taken_auto',
        skipIfCompleted: true,
      });
      onMissed();
      onClose();
    } catch (error) {
      console.error('Error auto-marking medication as not taken:', error);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsTaken = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      clearAutoMarkTimeout(user.id, medication.id, medication.reminder_time);
      await recordAdherenceStatus({
        userId: user.id,
        medicationId: medication.id,
        reminderTime: medication.reminder_time,
        status: 'taken',
      });
      onTaken();
      onClose();
    } catch (error) {
      console.error('Error marking medication as taken:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsMissed = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      clearAutoMarkTimeout(user.id, medication.id, medication.reminder_time);
      await recordAdherenceStatus({
        userId: user.id,
        medicationId: medication.id,
        reminderTime: medication.reminder_time,
        status: 'missed',
      });
      onMissed();
      onClose();
    } catch (error) {
      console.error('Error marking medication as missed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm">
      {/* Centered Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-lg animate-in fade-in zoom-in-95 duration-300 mx-4">
        {/* Close Button - disabled during auto-closing */}
        <button
          onClick={onClose}
          disabled={isLoading || isAutoClosing}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 z-10"
          aria-label="Close reminder"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center px-6 py-8 sm:px-8 sm:py-10 text-center">
          {/* Icon Badge */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
            <AlertCircle className="h-10 w-10 text-amber-500" />
          </div>

          {/* Heading */}
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Time for {medication.medication_name}
          </h2>

          {/* Subheading with Time and Dosage */}
          <p className="mb-4 text-sm text-gray-600">
            Scheduled at {medication.reminder_time} - {medication.dosage}
          </p>

          {/* Timer Display */}
          <div className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-600">
              {isAutoClosing ? 'Auto-marking as not taken...' : `Respond in: ${timerDisplay}`}
            </span>
          </div>

          {/* Body Text */}
          <p className="mb-6 text-sm text-gray-500 leading-relaxed">
            {medication.instructions || 'Have you taken your medication as prescribed?'}
          </p>

          {/* Action Buttons - disabled during auto-closing */}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-3">
            <button
              onClick={handleMarkAsTaken}
              disabled={isLoading || isAutoClosing}
              className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-6 py-3 font-semibold text-white text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading || isAutoClosing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              <span>{isAutoClosing ? 'Processing...' : 'Yes, Taken'}</span>
            </button>
            <button
              onClick={handleMarkAsMissed}
              disabled={isLoading || isAutoClosing}
              className="flex-1 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 px-6 py-3 font-semibold text-gray-700 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAutoClosing ? 'Auto-closing...' : 'Not Yet'}
            </button>
          </div>

          {/* Info Message */}
          <p className="mt-4 text-xs text-gray-400">
            Your response will be recorded
          </p>
        </div>
      </div>
    </div>
  );
}
