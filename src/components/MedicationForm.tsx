
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getMedicationSuggestions, MedicationSuggestion } from '../lib/gemini';
import { Search, Plus, Save, X, Loader2, Sparkles } from 'lucide-react';

export default function MedicationForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        medication_name: '',
        dosage: '',
        medication_type: 'Pill',
        relevant_symptoms: '',
        user_description: '',
        reminder_time: '08:00',
        end_date: '',
        instructions: ''
    });
    const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [saving, setSaving] = useState(false);

    // Debounce search for AI suggestions
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (formData.medication_name.length >= 2) {
                setLoadingSuggestions(true);
                const results = await getMedicationSuggestions(formData.medication_name);
                setSuggestions(results);
                setLoadingSuggestions(false);
            } else {
                setSuggestions([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [formData.medication_name]);

    const handleSuggestionClick = (s: MedicationSuggestion) => {
        setFormData(prev => ({
            ...prev,
            medication_name: s.name,
            dosage: s.dosage,
            medication_type: s.type,
            user_description: s.description
        }));
        setSuggestions([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);

        try {
            // 1. Create Medication
            const { data: medData, error: medError } = await supabase
                .from('medications')
                .insert({
                    user_id: user.id,
                    medication_name: formData.medication_name,
                    dosage: formData.dosage,
                    medication_type: formData.medication_type,
                    instructions: formData.instructions,
                    relevant_symptoms: formData.relevant_symptoms.split(',').map(s => s.trim()).filter(Boolean),
                    user_description: formData.user_description,
                    end_date: formData.end_date || null
                })
                .select()
                .single();

            if (medError) throw medError;

            // 2. Create Schedule
            const { error: schedError } = await supabase
                .from('medication_schedules')
                .insert({
                    medication_id: medData.id,
                    reminder_time: formData.reminder_time
                });

            if (schedError) throw schedError;

            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving medication:', error);
            alert('Failed to save medication');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Plus className="text-blue-600" /> Add Medication
                    </h2>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Medication Name</label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                value={formData.medication_name}
                                onChange={e => setFormData({ ...formData, medication_name: e.target.value })}
                                className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500"
                                placeholder="e.g. Aspirin"
                            />
                            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                            {loadingSuggestions && <Loader2 className="absolute right-3 top-3.5 animate-spin text-blue-500" size={18} />}
                        </div>

                        {/* Suggestions Dropdown */}
                        {suggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
                                <div className="px-3 py-2 bg-blue-50 text-xs font-bold text-blue-600 flex items-center gap-1">
                                    <Sparkles size={12} /> AI Suggestions
                                </div>
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleSuggestionClick(s)}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition"
                                    >
                                        <p className="font-semibold text-slate-900">{s.name}</p>
                                        <p className="text-xs text-slate-500">{s.type} • {s.dosage}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Dosage</label>
                            <input
                                type="text"
                                required
                                value={formData.dosage}
                                onChange={e => setFormData({ ...formData, dosage: e.target.value })}
                                className="form-input w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4"
                                placeholder="e.g. 500mg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Type</label>
                            <select
                                value={formData.medication_type}
                                onChange={e => setFormData({ ...formData, medication_type: e.target.value })}
                                className="form-select w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4"
                            >
                                <option>Pill</option>
                                <option>Syrup</option>
                                <option>Injection</option>
                                <option>Inhaler</option>
                                <option>Drops</option>
                                <option>Other</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Reminder Time</label>
                        <input
                            type="time"
                            required
                            value={formData.reminder_time}
                            onChange={e => setFormData({ ...formData, reminder_time: e.target.value })}
                            className="form-input w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">End Date (Optional)</label>
                        <input
                            type="date"
                            value={formData.end_date}
                            onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                            className="form-input w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Relevant Symptoms</label>
                        <input
                            type="text"
                            value={formData.relevant_symptoms}
                            onChange={e => setFormData({ ...formData, relevant_symptoms: e.target.value })}
                            className="form-input w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4"
                            placeholder="e.g. Headache, Fever"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Description (Optional)</label>
                        <textarea
                            value={formData.user_description}
                            onChange={e => setFormData({ ...formData, user_description: e.target.value })}
                            className="form-input w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4"
                            rows={3}
                            placeholder="Notes..."
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-blue-200 shadow-lg transition hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            Save Medication
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
