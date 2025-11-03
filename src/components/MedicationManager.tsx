import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Pill, Clock, X, Edit2, Trash2 } from 'lucide-react';

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  instructions: string;
  active: boolean;
}

interface Schedule {
  id: string;
  medication_id: string;
  reminder_time: string;
  active: boolean;
}

export default function MedicationManager() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    medication_name: '',
    dosage: '',
    instructions: '',
    reminder_times: [''],
  });

  const [errors, setErrors] = useState({
    medication_name: '',
    dosage: '',
  });

  useEffect(() => {
    loadMedications();
  }, [user]);

  const loadMedications = async () => {
    if (!user) return;

    const { data: medsData } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (medsData) {
      setMedications(medsData);

      const { data: schedulesData } = await supabase
        .from('medication_schedules')
        .select('*')
        .in(
          'medication_id',
          medsData.map((m) => m.id)
        )
        .eq('active', true);

      if (schedulesData) setSchedules(schedulesData);
    }
  };

  const validateForm = () => {
    const newErrors = {
      medication_name: '',
      dosage: '',
    };

    if (!formData.medication_name.trim()) {
      newErrors.medication_name = 'Please enter medication name';
    }

    if (!formData.dosage.trim()) {
      newErrors.dosage = 'Please enter dosage';
    }

    setErrors(newErrors);
    return !newErrors.medication_name && !newErrors.dosage;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (editingId) {
      await updateMedication();
    } else {
      await addMedication();
    }
  };

  const addMedication = async () => {
    if (!user) return;

    const { data: medData, error: medError } = await supabase
      .from('medications')
      .insert({
        user_id: user.id,
        medication_name: formData.medication_name,
        dosage: formData.dosage,
        instructions: formData.instructions,
      })
      .select()
      .single();

    if (medError || !medData) {
      alert('Error adding medication');
      return;
    }

    const scheduleInserts = formData.reminder_times
      .filter((time) => time.trim())
      .map((time) => ({
        medication_id: medData.id,
        reminder_time: time,
      }));

    if (scheduleInserts.length > 0) {
      await supabase.from('medication_schedules').insert(scheduleInserts);
    }

    resetForm();
    loadMedications();
  };

  const updateMedication = async () => {
    if (!editingId) return;

    await supabase
      .from('medications')
      .update({
        medication_name: formData.medication_name,
        dosage: formData.dosage,
        instructions: formData.instructions,
      })
      .eq('id', editingId);

    await supabase
      .from('medication_schedules')
      .delete()
      .eq('medication_id', editingId);

    const scheduleInserts = formData.reminder_times
      .filter((time) => time.trim())
      .map((time) => ({
        medication_id: editingId,
        reminder_time: time,
      }));

    if (scheduleInserts.length > 0) {
      await supabase.from('medication_schedules').insert(scheduleInserts);
    }

    resetForm();
    loadMedications();
  };

  const deleteMedication = async (id: string) => {
    if (!confirm('Are you sure you want to delete this medication?')) return;

    await supabase.from('medications').update({ active: false }).eq('id', id);

    loadMedications();
  };

  const editMedication = (med: Medication) => {
    const medSchedules = schedules
      .filter((s) => s.medication_id === med.id)
      .map((s) => s.reminder_time);

    setFormData({
      medication_name: med.medication_name,
      dosage: med.dosage,
      instructions: med.instructions,
      reminder_times: medSchedules.length > 0 ? medSchedules : [''],
    });

    setEditingId(med.id);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      medication_name: '',
      dosage: '',
      instructions: '',
      reminder_times: [''],
    });
    setErrors({ medication_name: '', dosage: '' });
    setEditingId(null);
    setShowAddForm(false);
  };

  const addReminderTime = () => {
    setFormData({
      ...formData,
      reminder_times: [...formData.reminder_times, ''],
    });
  };

  const updateReminderTime = (index: number, value: string) => {
    const newTimes = [...formData.reminder_times];
    newTimes[index] = value;
    setFormData({ ...formData, reminder_times: newTimes });
  };

  const removeReminderTime = (index: number) => {
    const newTimes = formData.reminder_times.filter((_, i) => i !== index);
    setFormData({ ...formData, reminder_times: newTimes.length > 0 ? newTimes : [''] });
  };

  return (
    <section className="w-full space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="section-title">
            <Pill size={32} className="text-blue-600" />
            <span>Medication library</span>
          </div>
          <p className="section-subtitle mt-1">
            Track every prescription with dosing details and reminder times.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="action-primary"
          >
            <Plus size={18} />
            Add medication
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-6 sm:px-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                {editingId ? 'Edit medication' : 'Add new medication'}
              </h3>
              <p className="text-sm text-slate-600">
                Set clear instructions so reminders reflect how you actually take it.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="action-secondary border-transparent bg-white/70 text-slate-600 hover:border-slate-200 hover:bg-white"
            >
              <X size={18} />
              Cancel
            </button>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Medication name *
              </label>
              <input
                type="text"
                value={formData.medication_name}
                onChange={(e) =>
                  setFormData({ ...formData, medication_name: e.target.value })
                }
                className={`w-full rounded-xl border px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                  errors.medication_name ? 'border-red-400' : 'border-slate-200'
                }`}
                placeholder="e.g., Losartan"
              />
              {errors.medication_name && (
                <p className="mt-1 text-sm text-red-600">{errors.medication_name}</p>
              )}
            </div>

            <div className="md:col-span-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Dosage *</label>
              <input
                type="text"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                className={`w-full rounded-xl border px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                  errors.dosage ? 'border-red-400' : 'border-slate-200'
                }`}
                placeholder="e.g., 50mg tablet"
              />
              {errors.dosage && <p className="mt-1 text-sm text-red-600">{errors.dosage}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Instructions
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) =>
                  setFormData({ ...formData, instructions: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="e.g., Take with breakfast and a full glass of water"
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Reminder times
              </label>
              <p className="text-sm text-slate-500">
                Choose the exact times you expect a reminderâ€"add as many as you need.
              </p>
              <div className="mt-4 space-y-3">
                {formData.reminder_times.map((time, index) => (
                  <div key={index} className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => updateReminderTime(index, e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    {formData.reminder_times.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReminderTime(index)}
                        className="action-secondary w-full sm:w-auto"
                      >
                        <X size={16} />
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addReminderTime}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add another reminder
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="action-secondary sm:w-auto"
            >
              Clear form
            </button>
            <button
              type="submit"
              className="action-primary bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600 sm:w-auto"
            >
              {editingId ? 'Update medication' : 'Save medication'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4 sm:space-y-5">
        {medications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center text-slate-500">
            <Pill size={60} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-semibold text-slate-600">No medications added yet</p>
            <p className="mt-2 text-sm">
              Add your first medication to start receiving smart reminders.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {medications.map((med) => {
              const medSchedules = schedules.filter((s) => s.medication_id === med.id);

              return (
                <div key={med.id} className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-900">
                        {med.medication_name}
                      </h3>
                      {!med.active && <span className="pill-tag bg-slate-200 text-slate-600">Inactive</span>}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Keep this list current if your prescription changes.</p>
                    <dl className="mt-4 flex flex-wrap gap-6 text-sm text-slate-600">
                      <div>
                        <dt className="font-semibold text-slate-700">Dosage</dt>
                        <dd className="mt-1 text-base text-slate-800">{med.dosage}</dd>
                      </div>
                      {med.instructions && (
                        <div className="max-w-sm">
                          <dt className="font-semibold text-slate-700">Instructions</dt>
                          <dd className="mt-1 text-base text-slate-800">{med.instructions}</dd>
                        </div>
                      )}
                    </dl>
                    {medSchedules.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Clock size={18} className="text-blue-500" />
                        {medSchedules.map((schedule) => (
                          <span
                            key={schedule.id}
                            className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                          >
                            {schedule.reminder_time.slice(0, 5)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 md:flex-col">
                    <button
                      onClick={() => editMedication(med)}
                      className="action-secondary w-full md:w-40"
                    >
                      <Edit2 size={18} />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMedication(med.id)}
                      className="action-secondary w-full border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:text-red-700 md:w-40"
                    >
                      <Trash2 size={18} />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}


