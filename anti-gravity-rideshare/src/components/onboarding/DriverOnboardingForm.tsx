'use client';

import { useState } from 'react';
import StepIndicator from './StepIndicator';
import FileUploadField from './FileUploadField';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
    // Step 1 — Personal Details
    name: string;
    phone: string;
    dateOfBirth: string;
    // Step 2 — Driver's License
    licenseNumber: string;
    licenseExpiry: string;
    licenseFile: File | null;
    // Step 3 — Insurance
    insurancePolicyNumber: string;
    insuranceExpiry: string;
    insuranceFile: File | null;
    // Step 4 — Vehicle Registration
    registrationExpiry: string;
    registrationFile: File | null;
    // Step 5 — Background Check (no expiry enforced)
    backgroundFile: File | null;
    // Step 6 — Selfie Match
    selfieFile: File | null;
    // Step 7 — Consent
    consentChecked: boolean;
}

const INITIAL_STATE: FormState = {
    name: '', phone: '', dateOfBirth: '',
    licenseNumber: '', licenseExpiry: '', licenseFile: null,
    insurancePolicyNumber: '', insuranceExpiry: '', insuranceFile: null,
    registrationExpiry: '', registrationFile: null,
    backgroundFile: null,
    selfieFile: null,
    consentChecked: false,
};

const STEPS = [
    { label: 'Personal' },
    { label: 'License' },
    { label: 'Insurance' },
    { label: 'Vehicle Reg' },
    { label: 'Background' },
    { label: 'Selfie' },
    { label: 'Consent' },
    { label: 'Review' },
];

// ── Shared Field Components ───────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">
                {label}{required && <span className="text-rose-400 ml-1">*</span>}
            </label>
            {children}
        </div>
    );
}

const inputClass =
    'w-full rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all';

// ── Main Component ────────────────────────────────────────────────────────────

export default function DriverOnboardingForm() {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState<FormState>(INITIAL_STATE);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const canAdvance = (): boolean => {
        switch (step) {
            case 0: return !!(form.name && form.phone && form.dateOfBirth);
            case 1: return !!(form.licenseNumber && form.licenseExpiry && form.licenseFile);
            case 2: return !!(form.insurancePolicyNumber && form.insuranceExpiry && form.insuranceFile);
            case 3: return !!form.registrationFile;
            case 4: return !!form.backgroundFile;
            case 5: return !!form.selfieFile;
            case 6: return form.consentChecked;
            case 7: return true;
            default: return true;
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const fd = new FormData();
            // For prototype: userId comes from a hardcoded or auth-session value.
            // In production this would come from your auth session.
            const userId = (window as any).__userId ?? 'demo-user';
            fd.append('userId', userId);
            fd.append('name', form.name);
            fd.append('dateOfBirth', form.dateOfBirth);
            fd.append('licenseNumber', form.licenseNumber);
            fd.append('licenseExpiry', form.licenseExpiry);
            fd.append('insurancePolicyNumber', form.insurancePolicyNumber);
            fd.append('insuranceExpiry', form.insuranceExpiry);
            fd.append('registrationExpiry', form.registrationExpiry);
            if (form.licenseFile) fd.append('licenseFile', form.licenseFile);
            if (form.insuranceFile) fd.append('insuranceFile', form.insuranceFile);
            if (form.registrationFile) fd.append('registrationFile', form.registrationFile);
            if (form.backgroundFile) fd.append('backgroundFile', form.backgroundFile);
            if (form.selfieFile) fd.append('selfieFile', form.selfieFile);

            const res = await fetch('/api/driver/onboarding', { method: 'POST', body: fd });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Submission failed');
            setSubmitted(true);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Success State ─────────────────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="text-center py-16 space-y-4 animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto">
                    <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Application Submitted!</h2>
                <p className="text-zinc-400 max-w-sm mx-auto">
                    Your documents are under review. Our safety team will verify each document individually.
                    We'll notify you once your account is approved.
                </p>
                <p className="text-xs text-zinc-600">
                    This process typically takes 1–3 business days.
                </p>
            </div>
        );
    }

    // ── Step Renders ──────────────────────────────────────────────────────────
    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <div className="space-y-5">
                        <Field label="Full Name" required>
                            <input className={inputClass} placeholder="Jane Smith"
                                value={form.name} onChange={e => set('name', e.target.value)} />
                        </Field>
                        <Field label="Phone Number" required>
                            <input className={inputClass} placeholder="+1 (555) 000-0000" type="tel"
                                value={form.phone} onChange={e => set('phone', e.target.value)} />
                        </Field>
                        <Field label="Date of Birth" required>
                            <input className={inputClass} type="date"
                                value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
                        </Field>
                    </div>
                );

            case 1:
                return (
                    <div className="space-y-5">
                        <Field label="License Number" required>
                            <input className={inputClass} placeholder="D1234-56789"
                                value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} />
                        </Field>
                        <Field label="License Expiry Date" required>
                            <input className={inputClass} type="date"
                                value={form.licenseExpiry} onChange={e => set('licenseExpiry', e.target.value)} />
                        </Field>
                        <FileUploadField
                            label="Driver's License Photo" required
                            hint="JPG, PNG or PDF — front of card"
                            value={form.licenseFile}
                            onChange={f => set('licenseFile', f)}
                        />
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-5">
                        <Field label="Insurance Policy Number" required>
                            <input className={inputClass} placeholder="POL-123456"
                                value={form.insurancePolicyNumber} onChange={e => set('insurancePolicyNumber', e.target.value)} />
                        </Field>
                        <Field label="Insurance Expiry Date" required>
                            <input className={inputClass} type="date"
                                value={form.insuranceExpiry} onChange={e => set('insuranceExpiry', e.target.value)} />
                        </Field>
                        <FileUploadField
                            label="Insurance Card / Document" required
                            hint="JPG, PNG or PDF"
                            value={form.insuranceFile}
                            onChange={f => set('insuranceFile', f)}
                        />
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-5">
                        <p className="text-sm text-zinc-400">
                            Upload your vehicle registration document. This confirms your vehicle is
                            legally registered and eligible to operate on the platform.
                        </p>
                        <Field label="Registration Expiry Date">
                            <input className={inputClass} type="date"
                                value={form.registrationExpiry} onChange={e => set('registrationExpiry', e.target.value)} />
                        </Field>
                        <FileUploadField
                            label="Vehicle Registration Document" required
                            hint="JPG, PNG or PDF — registration certificate"
                            value={form.registrationFile}
                            onChange={f => set('registrationFile', f)}
                        />
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-5">
                        <div className="rounded-xl bg-amber-950/30 border border-amber-500/20 p-4 text-sm text-amber-300 space-y-1">
                            <p className="font-semibold">Why this is required</p>
                            <p className="text-amber-400/80">Our platform serves vulnerable populations including children and seniors.
                                A Vulnerable Sector Check is mandatory for all drivers under our safety charter.</p>
                        </div>
                        <FileUploadField
                            label="Vulnerable Sector Check (RCMP)" required
                            hint="PDF preferred — issued within the last 6 months"
                            value={form.backgroundFile}
                            onChange={f => set('backgroundFile', f)}
                        />
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-5">
                        <p className="text-sm text-zinc-400">
                            Upload a clear selfie or portrait photo. This will be used to verify your
                            identity matches your submitted driver's license.
                        </p>
                        <FileUploadField
                            label="Identity Selfie / Portrait Photo" required
                            hint="JPG or PNG — clear face, good lighting, no sunglasses"
                            accept="image/*"
                            value={form.selfieFile}
                            onChange={f => set('selfieFile', f)}
                        />
                    </div>
                );

            case 6:
                return (
                    <div className="space-y-6">
                        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700 p-5 text-sm text-zinc-300 space-y-3 leading-relaxed">
                            <p className="font-semibold text-white text-base">Authorization & Consent</p>
                            <p>By submitting this application, you authorize AntiGravity to:</p>
                            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                                <li>Verify the authenticity of all submitted documents</li>
                                <li>Process your Vulnerable Sector Check with appropriate authorities</li>
                                <li>Retain document records for audit and oversight purposes</li>
                                <li>Periodically re-verify your eligibility as documents expire</li>
                                <li>Share relevant information with the Safety & Fairness Ombudsperson</li>
                            </ul>
                            <p className="text-xs text-zinc-500">
                                Your documents are stored securely and handled in accordance with our
                                Privacy Policy. You may request removal of your data at any time.
                            </p>
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={form.consentChecked}
                                onChange={e => set('consentChecked', e.target.checked)}
                                className="mt-0.5 w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                            />
                            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                                I have read and agree to the above authorizations. I confirm all submitted
                                information is accurate and up to date.
                            </span>
                        </label>
                    </div>
                );

            case 7:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400 mb-2">
                            Please review your submission before sending.
                        </p>
                        {[
                            { label: 'Full Name', value: form.name },
                            { label: 'Phone', value: form.phone },
                            { label: 'Date of Birth', value: form.dateOfBirth },
                            { label: 'License Number', value: form.licenseNumber },
                            { label: 'License Expiry', value: form.licenseExpiry },
                            { label: 'License Photo', value: form.licenseFile?.name },
                            { label: 'Insurance Policy #', value: form.insurancePolicyNumber },
                            { label: 'Insurance Expiry', value: form.insuranceExpiry },
                            { label: 'Insurance Document', value: form.insuranceFile?.name },
                            { label: 'Reg. Expiry', value: form.registrationExpiry || '—' },
                            { label: 'Vehicle Registration', value: form.registrationFile?.name },
                            { label: 'Background Check', value: form.backgroundFile?.name },
                            { label: 'Selfie Photo', value: form.selfieFile?.name },
                        ].map(({ label, value }) => value && (
                            <div key={label} className="flex justify-between text-sm py-2 border-b border-zinc-800">
                                <span className="text-zinc-500">{label}</span>
                                <span className="text-white font-medium text-right max-w-[55%] truncate">{value}</span>
                            </div>
                        ))}
                        {error && (
                            <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-3 text-sm text-rose-400">
                                {error}
                            </div>
                        )}
                    </div>
                );
        }
    };

    // ── Layout ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full space-y-6">
            <StepIndicator steps={STEPS} currentStep={step} />

            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 md:p-8 min-h-[340px]">
                <h2 className="text-lg font-semibold text-white mb-6">
                    {STEPS[step].label === 'Review' ? 'Review & Submit' : STEPS[step].label}
                </h2>
                {renderStep()}
            </div>

            {/* Navigation */}
            <div className="flex justify-between gap-3">
                <button
                    type="button"
                    onClick={() => setStep(s => s - 1)}
                    disabled={step === 0}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium border border-zinc-700 text-zinc-300
                               hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    ← Back
                </button>

                {step < STEPS.length - 1 ? (
                    <button
                        type="button"
                        onClick={() => setStep(s => s + 1)}
                        disabled={!canAdvance()}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white
                                   hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        Continue →
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white
                                   hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all
                                   flex items-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Submitting…
                            </>
                        ) : 'Submit Application'}
                    </button>
                )}
            </div>
        </div>
    );
}
