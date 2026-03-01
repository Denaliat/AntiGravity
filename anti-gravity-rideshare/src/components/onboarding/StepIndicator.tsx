'use client';

interface Step {
    label: string;
}

interface StepIndicatorProps {
    steps: Step[];
    currentStep: number; // 0-indexed
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
    return (
        <div className="w-full mb-8">
            {/* Step labels — hidden on small screens, shown on md+ */}
            <div className="hidden md:flex items-center justify-between mb-2">
                {steps.map((step, i) => (
                    <span
                        key={i}
                        className={`text-xs font-medium transition-colors ${i < currentStep
                                ? 'text-emerald-500'
                                : i === currentStep
                                    ? 'text-white'
                                    : 'text-zinc-500'
                            }`}
                        style={{ width: `${100 / steps.length}%`, textAlign: 'center' }}
                    >
                        {step.label}
                    </span>
                ))}
            </div>

            {/* Progress bar track */}
            <div className="relative flex items-center">
                {/* Background track */}
                <div className="absolute left-0 right-0 h-1 bg-zinc-700 rounded-full" />

                {/* Filled track */}
                <div
                    className="absolute left-0 h-1 bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                />

                {/* Step dots */}
                <div className="relative flex justify-between w-full">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 z-10 ${i < currentStep
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : i === currentStep
                                        ? 'bg-zinc-900 border-emerald-500 text-emerald-400 ring-4 ring-emerald-500/20'
                                        : 'bg-zinc-800 border-zinc-600 text-zinc-500'
                                }`}
                        >
                            {i < currentStep ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                i + 1
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Current step label for mobile */}
            <p className="md:hidden text-center text-sm text-zinc-400 mt-3">
                Step {currentStep + 1} of {steps.length}: <span className="text-white font-medium">{steps[currentStep]?.label}</span>
            </p>
        </div>
    );
}
