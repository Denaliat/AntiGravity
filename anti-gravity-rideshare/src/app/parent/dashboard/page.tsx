'use client';

import { useState } from 'react';

// Mock interaction for prototype
type ChildUser = {
    id: string;
    name: string;
    isLocationHidden: boolean;
};

export default function ParentDashboard() {
    const [children, setChildren] = useState<ChildUser[]>([
        { id: 'child-1', name: 'Timmy Child', isLocationHidden: false }
    ]);

    const toggleLocation = async (childId: string, currentValue: boolean) => {
        try {
            const res = await fetch(`/api/parent/child/${childId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isLocationHidden: !currentValue })
            });

            if (res.ok) {
                setChildren(children.map(c =>
                    c.id === childId ? { ...c, isLocationHidden: !currentValue } : c
                ));
            }
        } catch (e) {
            console.error(e);
            alert('Failed to update settings');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-8">Parent Dashboard</h1>

                <div className="bg-white rounded-xl shadow p-6">
                    <h2 className="text-xl font-semibold mb-4 text-slate-700">My Children</h2>

                    <div className="space-y-4">
                        {children.map(child => (
                            <div key={child.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition">
                                <div>
                                    <p className="font-bold text-lg text-slate-800">{child.name}</p>
                                    <p className="text-sm text-slate-500">ID: {child.id}</p>
                                </div>

                                <div className="flex items-center space-x-3">
                                    <span className="text-sm font-medium text-slate-600">Location Access:</span>
                                    <button
                                        onClick={() => toggleLocation(child.id, child.isLocationHidden)}
                                        className={`px-4 py-2 rounded-full font-semibold text-sm transition ${!child.isLocationHidden
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            }`}
                                    >
                                        {child.isLocationHidden ? 'Hidden' : 'Visible'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
