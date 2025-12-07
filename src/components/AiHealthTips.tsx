
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getHealthTips, HealthTip } from '../lib/gemini';
import { Sparkles, ArrowLeft, Loader2, BookOpen } from 'lucide-react';

export default function AiHealthTips({ onBack }: { onBack: () => void }) {
    const { user } = useAuth();
    const [tips, setTips] = useState<HealthTip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) loadTips();
    }, [user]);

    const loadTips = async () => {
        try {
            // 1. Fetch Medications
            const { data: meds } = await supabase
                .from('medications')
                .select('medication_name')
                .eq('user_id', user?.id)
                .eq('active', true);

            // 2. Fetch User Conditions
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('medical_conditions')
                .eq('id', user?.id)
                .single();

            const medNames = meds?.map(m => m.medication_name) || [];
            const conditions = profile?.medical_conditions || [];

            if (medNames.length === 0 && conditions.length === 0) {
                setTips([{ title: 'Welcome!', content: 'Add medications or update your health profile to get personalized AI tips.', category: 'lifestyle' }]);
                setLoading(false);
                return;
            }

            // 3. Get AI Tips
            const aiTips = await getHealthTips(medNames, conditions);
            setTips(aiTips);
        } catch (error) {
            console.error('Error loading tips:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles className="text-purple-600" /> AI Health Wisdom
                    </h1>
                    <p className="text-slate-600">Personalized insights based on your regime.</p>
                </div>
                <button onClick={onBack} className="action-secondary">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin text-purple-600" size={32} />
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {tips.map((tip, i) => (
                        <div key={i} className="surface-card p-6 border-l-4 border-l-purple-500 hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                   ${tip.category === 'medication' ? 'bg-blue-100 text-blue-700' :
                                        tip.category === 'nutrition' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {tip.category}
                                </span>
                                {tip.category === 'medication' && <BookOpen size={16} className="text-purple-400" />}
                            </div>
                            <h3 className="font-bold text-lg text-slate-900 mb-2">{tip.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">{tip.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
