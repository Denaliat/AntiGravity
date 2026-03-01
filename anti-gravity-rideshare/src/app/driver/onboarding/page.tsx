import DriverOnboardingForm from '@/components/onboarding/DriverOnboardingForm';

export const metadata = {
    title: 'Driver Onboarding — AntiGravity',
    description: 'Complete your driver verification to start accepting rides and deliveries on the AntiGravity platform.',
};

export default function DriverOnboardingPage() {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-start justify-center px-4 py-12">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center gap-2 bg-emerald-950/50 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-4">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-medium text-emerald-400 uppercase tracking-widest">Driver Verification</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Complete Your Application
                    </h1>
                    <p className="text-zinc-400 max-w-md mx-auto text-sm">
                        To protect riders, passengers, and our community, all drivers must complete identity
                        and document verification before going live.
                    </p>
                </div>

                {/* Wizard card */}
                <DriverOnboardingForm />

                {/* Footer */}
                <p className="text-center text-xs text-zinc-600 mt-6">
                    Questions? Contact our{' '}
                    <a href="/support" className="text-zinc-400 underline hover:text-white transition-colors">
                        support team
                    </a>
                    . Your data is handled under our Privacy Policy.
                </p>
            </div>
        </div>
    );
}
