'use client';

export default function ChildDashboard() {
    const isLocationHidden = false; // In real app, fetch from checking own user object

    return (
        <div className="min-h-screen bg-indigo-50 p-6">
            <div className="max-w-md mx-auto">
                <h1 className="text-2xl font-bold text-indigo-900 mb-6">Hi, Timmy!</h1>

                {/* Status Card */}
                <div className="bg-white rounded-xl shadow p-4 mb-6 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Location Sharing</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${isLocationHidden ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                        {isLocationHidden ? 'OFF' : 'ON'}
                    </span>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <button className="bg-indigo-600 text-white p-6 rounded-xl shadow hover:bg-indigo-700 transition flex flex-col items-center">
                        <span className="text-3xl mb-2">🚗</span>
                        <span className="font-bold">Request Ride</span>
                    </button>
                    <button className="bg-white text-indigo-900 p-6 rounded-xl shadow hover:bg-indigo-50 transition flex flex-col items-center">
                        <span className="text-3xl mb-2">🆘</span>
                        <span className="font-bold">Emergency</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
