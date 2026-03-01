'use client';

import { useRef, useState } from 'react';

interface FileUploadFieldProps {
    label: string;
    hint?: string;
    accept?: string;
    value: File | null;
    onChange: (file: File | null) => void;
    required?: boolean;
}

export default function FileUploadField({
    label,
    hint,
    accept = 'image/*,application/pdf',
    value,
    onChange,
    required,
}: FileUploadFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFile = (file: File) => {
        onChange(file);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleRemove = () => {
        onChange(null);
        setPreview(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
                {label}
                {required && <span className="text-rose-400 ml-1">*</span>}
            </label>

            {value ? (
                /* File selected — show preview or filename pill */
                <div className="relative rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4">
                    {preview ? (
                        <img
                            src={preview}
                            alt="Document preview"
                            className="w-full max-h-48 object-contain rounded-lg mb-3"
                        />
                    ) : (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">
                                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white truncate max-w-xs">{value.name}</p>
                                <p className="text-xs text-zinc-500">{(value.size / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Ready to upload
                        </span>
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            ) : (
                /* Drop zone */
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer ${dragging
                            ? 'border-emerald-400 bg-emerald-950/30'
                            : 'border-zinc-600 bg-zinc-800/40 hover:border-zinc-500 hover:bg-zinc-800/60'
                        }`}
                >
                    <svg className="w-8 h-8 text-zinc-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-sm text-zinc-400">
                        <span className="text-emerald-400 font-medium">Click to upload</span> or drag & drop
                    </p>
                    {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
                </button>
            )}

            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                }}
            />
        </div>
    );
}
