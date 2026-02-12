'use client';

import { useEffect, useState } from 'react';
import { ChangeRequest } from '@/lib/types';

export default function AdminDashboardPage() {
    const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
    const [activeTab, setActiveTab] = useState('OVERVIEW');

    useEffect(() => {
        // Mock fetching data
        fetch('/api/admin/changes').then(res => res.json()).then(data => {
            if (data.requests) setChangeRequests(data.requests);
        });
    }, []);

    const handleApprove = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        await fetch(`/api/admin/changes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        // Refresh
        const res = await fetch('/api/admin/changes');
        const data = await res.json();
        setChangeRequests(data.requests);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                <h1 className="text-3xl font-bold">Admin Command Center</h1>
                <div className="flex space-x-4">
                    <button onClick={() => setActiveTab('OVERVIEW')} className={`px-4 py-2 rounded ${activeTab === 'OVERVIEW' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>Overview</button>
                    <button onClick={() => setActiveTab('DEV_REQUESTS')} className={`px-4 py-2 rounded ${activeTab === 'DEV_REQUESTS' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>Dev Requests</button>
                    <button onClick={() => setActiveTab('ROLES')} className={`px-4 py-2 rounded ${activeTab === 'ROLES' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>Roles & Perms</button>
                </div>
            </header>

            {activeTab === 'OVERVIEW' && (
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-slate-800 p-6 rounded-xl">
                        <h3 className="text-slate-400 mb-2">Total Users</h3>
                        <p className="text-4xl font-bold">1,240</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl">
                        <h3 className="text-slate-400 mb-2">Active Rides</h3>
                        <p className="text-4xl font-bold text-green-400">42</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl">
                        <h3 className="text-slate-400 mb-2">Pending Dev Changes</h3>
                        <p className="text-4xl font-bold text-yellow-400">{changeRequests.filter(r => r.status === 'PENDING').length}</p>
                    </div>
                </div>
            )}

            {activeTab === 'DEV_REQUESTS' && (
                <div className="bg-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-700 text-slate-300">
                            <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Description</th>
                                <th className="p-4">Dev ID</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {changeRequests.map(req => (
                                <tr key={req.id}>
                                    <td className="p-4 font-mono text-sm">{req.id.slice(0, 8)}...</td>
                                    <td className="p-4">{req.description}</td>
                                    <td className="p-4 text-sm text-slate-400">{req.developerId}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                                req.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {req.status === 'PENDING' && (
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleApprove(req.id, 'APPROVED')} className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm">Approve</button>
                                                <button onClick={() => handleApprove(req.id, 'REJECTED')} className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm">Reject</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'ROLES' && (
                <div className="bg-slate-800 p-6 rounded-xl">
                    <h2 className="text-xl font-bold mb-4">Lead Admin Console</h2>
                    <p className="text-slate-400 mb-6">Select a Support Agent to modify permissions.</p>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border border-slate-700 rounded bg-slate-900/50">
                            <div>
                                <p className="font-bold">Support Agent (support-1)</p>
                                <p className="text-sm text-slate-500">Current: [VIEW_USERS, CHAT_SUPPORT]</p>
                            </div>
                            <button className="border border-slate-600 px-4 py-2 rounded hover:bg-slate-700">Edit Permissions</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
