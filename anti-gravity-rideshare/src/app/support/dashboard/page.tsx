'use client';

import { useState } from 'react';

// Mock Data
const INQUIRIES = [
    { id: 'ticket-1', user: 'Alice Rider', subject: 'Lost Item', status: 'OPEN' },
    { id: 'ticket-2', user: 'John Driver', subject: 'Payout Issue', status: 'OPEN' }
];

export default function SupportPage() {
    const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

    // In real app, check permissions via API/Auth Hook
    // const { user } = useAuth();
    // if (!user.permissions.includes('CHAT_SUPPORT')) return <AccessDenied />;

    return (
        <div className="flex h-screen bg-slate-100">
            {/* Sidebar List */}
            <div className="w-1/3 bg-white border-r p-4">
                <h1 className="text-xl font-bold mb-4">Support Queue</h1>
                <div className="space-y-2">
                    {INQUIRIES.map(ticket => (
                        <button
                            key={ticket.id}
                            onClick={() => setSelectedTicket(ticket.id)}
                            className={`w-full text-left p-4 rounded-lg border hover:bg-slate-50 ${selectedTicket === ticket.id ? 'bg-blue-50 border-blue-500' : ''}`}
                        >
                            <p className="font-semibold">{ticket.subject}</p>
                            <p className="text-sm text-slate-500">{ticket.user}</p>
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full mt-2 inline-block">Active</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                {selectedTicket ? (
                    <>
                        <div className="p-4 border-b bg-white font-bold">
                            Ticket: {selectedTicket}
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
                            <div className="flex flex-col space-y-4">
                                <div className="bg-slate-200 self-start p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl max-w-md">
                                    Hello, I need help with my last ride.
                                </div>
                                <div className="bg-blue-600 text-white self-end p-3 rounded-tl-xl rounded-bl-xl rounded-br-xl max-w-md">
                                    Hi there! I'd be happy to help. What seems to be the issue?
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-white border-t">
                            <div className="flex space-x-2">
                                <input className="flex-1 border p-2 rounded" placeholder="Type a reply..." />
                                <button className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Send</button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        Select a ticket to start chatting
                    </div>
                )}
            </div>
        </div>
    );
}
