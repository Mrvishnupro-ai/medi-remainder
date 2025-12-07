import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Pill, Clock, Trash2, Calendar } from 'lucide-react';
import MedicationForm from './MedicationForm';

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  instructions: string;
  medication_type: string;
  end_date: string;
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

      const medIds = medsData.map(m => m.id);
      if (medIds.length > 0) {
        const { data: schedulesData } = await supabase
          .from('medication_schedules')
          .select('*')
          .in('medication_id', medIds)
          .eq('active', true);

        if (schedulesData) setSchedules(schedulesData);
      } else {
        setSchedules([]);
      }
    }
  };

  const deleteMedication = async (id: string) => {
    if (!confirm('Are you sure you want to delete this medication?')) return;
    await supabase.from('medications').update({ active: false }).eq('id', id);
    loadMedications();
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
        <MedicationForm
          onClose={() => setShowAddForm(false)}
          onSave={() => {
            loadMedications();
            setShowAddForm(false);
          }}
        />
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
                      {med.medication_type && <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{med.medication_type}</span>}
                    </div>
                    {med.end_date && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><Calendar size={12} /> Ends: {new Date(med.end_date).toLocaleDateString()}</p>}

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
