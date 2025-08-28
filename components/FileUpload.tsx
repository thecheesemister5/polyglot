
import React, { useState, useCallback, useEffect, useRef } from 'react';

// --- Icons (defined in-component for simplicity) ---
const UploadIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H12a4 4 0 014 4v1.586a1 1 0 01-.293.707l-1.414 1.414a1 1 0 00-.293.707V16m-7-5h5l2 2m-5-2V5" />
    </svg>
);

const FileIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
);

const CloseIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);


// --- Helper Function ---
const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface FileUploadProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  title: string;
  description: string;
  id: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ file, onFileSelect, onClear, title, description, id }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (file && file.type.startsWith('image/')) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }
        setPreviewUrl(null);
    }, [file]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragOut = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    }, [onFileSelect]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files[0]);
        }
    };

    const handleClearClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onClear();
        if(inputRef.current) {
            inputRef.current.value = "";
        }
    };

    const handleClick = () => {
        inputRef.current?.click();
    };

    return (
        <div className="flex flex-col">
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="text-slate-400 mb-4">{description}</p>
            <div
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleClick}
                className={`relative flex-grow flex flex-col justify-center items-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-300 ${isDragging ? 'border-indigo-500 bg-slate-800/50' : 'border-slate-600 hover:border-slate-500 bg-slate-800'}`}
            >
                <input ref={inputRef} id={id} type="file" className="hidden" onChange={handleChange} />
                
                {file ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center text-center">
                        <button onClick={handleClearClick} className="absolute top-2 right-2 p-1.5 bg-slate-700/50 rounded-full hover:bg-slate-600/80 transition-colors">
                            <CloseIcon className="w-5 h-5 text-slate-300"/>
                        </button>
                        {previewUrl ? (
                            <img src={previewUrl} alt="File preview" className="max-h-40 rounded-lg shadow-lg mb-4 object-contain" />
                        ) : (
                            <FileIcon className="w-20 h-20 text-slate-500 mb-4"/>
                        )}
                        <p className="font-semibold text-white break-all" title={file.name}>{file.name}</p>
                        <p className="text-sm text-slate-400">{formatBytes(file.size)}</p>
                    </div>
                ) : (
                    <div className="text-center">
                        <UploadIcon className="mx-auto h-12 w-12 text-slate-500" />
                        <p className="mt-2 font-semibold text-slate-300">
                            Drag & drop a file here
                        </p>
                        <p className="text-sm text-slate-400">or click to select a file</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUpload;
