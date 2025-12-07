import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Calendar, FileText, UserPlus, HeartPulse } from 'lucide-react';

export function BasicHealthInfo() {
    const { user } = useAuth();
    const [data, setData] = useState({
        age: '',
        weight: '',
        blood_group: '',
        allergies: '',
        medical_conditions: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const loadData = async () => {
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('age, weight, blood_group, allergies, medical_conditions')
            .eq('id', user?.id)
            .single();

        if (profile) {
            setData({
                age: profile.age || '',
                weight: profile.weight || '',
                blood_group: profile.blood_group || '',
                allergies: (profile.allergies || []).join(', '),
                medical_conditions: (profile.medical_conditions || []).join(', ')
            });
        }
        setLoading(false);
    };

    const updateProfile = async () => {
        if (!user) return;
        await supabase.from('user_profiles').update({
            age: parseInt(data.age) || null,
            weight: parseFloat(data.weight) || null,
            blood_group: data.blood_group,
            allergies: data.allergies.split(',').map(s => s.trim()).filter(Boolean),
            medical_conditions: data.medical_conditions.split(',').map(s => s.trim()).filter(Boolean)
        }).eq('id', user.id);
        alert('Health info updated');
    };

    if (loading) return <div>Loading...</div>;

    return (
        <section className="surface-card px-6 py-6 sm:px-8 sm:py-7 mt-8">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <HeartPulse className="text-blue-600" /> Basic Health Info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <input type="number" placeholder="Age" value={data.age} onChange={e => setData({ ...data, age: e.target.value })} className="form-input" />
                <input type="number" placeholder="Weight (kg)" value={data.weight} onChange={e => setData({ ...data, weight: e.target.value })} className="form-input" />
                <input type="text" placeholder="Blood Group" value={data.blood_group} onChange={e => setData({ ...data, blood_group: e.target.value })} className="form-input" />
                <input type="text" placeholder="Allergies (comma separated)" value={data.allergies} onChange={e => setData({ ...data, allergies: e.target.value })} className="form-input" />
                <textarea placeholder="Medical Conditions (comma separated)" value={data.medical_conditions} onChange={e => setData({ ...data, medical_conditions: e.target.value })} className="form-input sm:col-span-2" />
            </div>
            <button onClick={updateProfile} className="action-primary mt-4">Save Health Info</button>
        </section>
    );
}

export function FamilyMembersManager() {
    const { user } = useAuth();
    const [members, setMembers] = useState<any[]>([]);
    const [newMember, setNewMember] = useState({ name: '', relationship: '', contact_number: '', email: '' });

    useEffect(() => { if (user) loadMembers(); }, [user]);

    const loadMembers = async () => {
        const { data } = await supabase.from('family_members').select('*').eq('user_id', user?.id);
        if (data) setMembers(data);
    };

    const addMember = async () => {
        if (!user) return;
        const { error } = await supabase.from('family_members').insert({ ...newMember, user_id: user.id });
        if (!error) {
            setNewMember({ name: '', relationship: '', contact_number: '', email: '' });
            loadMembers();
        }
    };

    const deleteMember = async (id: string) => {
        await supabase.from('family_members').delete().eq('id', id);
        loadMembers();
    };

    return (
        <section className="surface-card px-6 py-6 sm:px-8 sm:py-7 mt-8">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <UserPlus className="text-blue-600" /> Family Members & Emergency Contacts
            </h2>
            <div className="space-y-4 mt-4">
                {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                            <p className="font-semibold">{m.name} <span className="text-sm text-slate-500">({m.relationship})</span></p>
                            <p className="text-sm text-slate-600">{m.contact_number} | {m.email}</p>
                        </div>
                        <button onClick={() => deleteMember(m.id)} className="text-red-500"><Trash2 size={16} /></button>
                    </div>
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input placeholder="Name" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} className="form-input" />
                    <input placeholder="Relationship" value={newMember.relationship} onChange={e => setNewMember({ ...newMember, relationship: e.target.value })} className="form-input" />
                    <input placeholder="Contact Number" value={newMember.contact_number} onChange={e => setNewMember({ ...newMember, contact_number: e.target.value })} className="form-input" />
                    <input placeholder="Email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} className="form-input" />
                    <button onClick={addMember} className="action-secondary sm:col-span-2 flex justify-center items-center gap-2"><Plus size={16} /> Add Family Member</button>
                </div>
            </div>
        </section>
    );
}

export function DoctorAppointmentsManager() {
    const { user } = useAuth();
    const [appts, setAppts] = useState<any[]>([]);
    const [newAppt, setNewAppt] = useState({ doctor_name: '', specialty: '', appointment_date: '', notes: '' });

    useEffect(() => { if (user) loadAppts(); }, [user]);

    const loadAppts = async () => {
        const { data } = await supabase.from('doctor_appointments').select('*').eq('user_id', user?.id).order('appointment_date', { ascending: true });
        if (data) setAppts(data);
    };

    const addAppt = async () => {
        if (!user) return;
        const { error } = await supabase.from('doctor_appointments').insert({ ...newAppt, user_id: user.id });
        if (!error) {
            setNewAppt({ doctor_name: '', specialty: '', appointment_date: '', notes: '' });
            loadAppts();
        }
    };

    return (
        <section className="surface-card px-6 py-6 sm:px-8 sm:py-7 mt-8">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Doctor Appointments
            </h2>
            <div className="space-y-4 mt-4">
                {appts.map(a => (
                    <div key={a.id} className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-semibold">{a.doctor_name} <span className="text-sm text-slate-500">({a.specialty})</span></p>
                        <p className="text-sm text-blue-600">{new Date(a.appointment_date).toLocaleString()}</p>
                        <p className="text-sm text-slate-600 mt-1">{a.notes}</p>
                    </div>
                ))}
                <div className="grid grid-cols-1 gap-2">
                    <input placeholder="Doctor Name" value={newAppt.doctor_name} onChange={e => setNewAppt({ ...newAppt, doctor_name: e.target.value })} className="form-input" />
                    <input placeholder="Specialty" value={newAppt.specialty} onChange={e => setNewAppt({ ...newAppt, specialty: e.target.value })} className="form-input" />
                    <input type="datetime-local" value={newAppt.appointment_date} onChange={e => setNewAppt({ ...newAppt, appointment_date: e.target.value })} className="form-input" />
                    <input placeholder="Notes" value={newAppt.notes} onChange={e => setNewAppt({ ...newAppt, notes: e.target.value })} className="form-input" />
                    <button onClick={addAppt} className="action-secondary flex justify-center items-center gap-2"><Plus size={16} /> Add Appointment</button>
                </div>
            </div>
        </section>
    );
}
