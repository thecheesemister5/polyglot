import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import AiAssistantModal from './components/AiAssistantModal';
import { createPolyglot, decodePolyglot, DecodedFile, decodePolyglotWithAI, DecodeOptions } from './services/polyglotService';
import { convertImage, ConvertResult } from './services/imageService';


const DownloadIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const LoadingSpinner: React.FC<{className?: string}> = ({ className }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const SearchIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const MagicIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 15l-1.012.988-1.011-.988L6 15l.988-1.012L6 13l1.012-.988L6 11l1.012.988L8 12l.988-1.012L8 10l1.012.988L10 11l.988-1.012L10 9l1.012.988L12 10l.988-1.012L12 8l1.012.988L14 9l.988-1.012L14 7l1.012.988L16 8l.988-1.012L16 6l1.012.988L18 7l.988-1.012L18 5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; description: string; }> = ({ checked, onChange, label, description }) => (
  <div className="flex items-center justify-between w-full max-w-lg p-4 bg-slate-800/50 rounded-lg">
    <div className="flex flex-col mr-4">
      <span className="font-semibold text-white">{label}</span>
      <span className="text-sm text-slate-400">{description}</span>
    </div>
    <button
      type="button"
      className={`${checked ? 'bg-indigo-600' : 'bg-slate-700'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
      />
    </button>
  </div>
);


type PolyglotMode = 'create' | 'decode' | 'convert';

const App: React.FC = () => {
    const [polyglotMode, setPolyglotMode] = useState<PolyglotMode>('create');

    // State for 'create' mode
    const [containerFile, setContainerFile] = useState<File | null>(null);
    const [hiddenFile, setHiddenFile] = useState<File | null>(null);
    const [polyglotFile, setPolyglotFile] = useState<Blob | null>(null);
    const [polyglotFilename, setPolyglotFilename] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [autoConvert, setAutoConvert] = useState<boolean>(true);
    const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);


    // State for 'decode' mode
    const [decodeFile, setDecodeFile] = useState<File | null>(null);
    const [extractedFile, setExtractedFile] = useState<DecodedFile | null>(null);
    const [isDecoding, setIsDecoding] = useState<boolean>(false);
    const [decodeError, setDecodeError] = useState<string | null>(null);
    const [useAiDecode, setUseAiDecode] = useState<boolean>(true);
    const [decodeStatus, setDecodeStatus] = useState<string>('Decoding...');
    const [isM4aFile, setIsM4aFile] = useState<boolean>(false);
    const [executableType, setExecutableType] = useState<'exe' | 'apk'>('exe');


    // State for 'convert' mode
    const [convertFile, setConvertFile] = useState<File | null>(null);
    const [convertedFile, setConvertedFile] = useState<ConvertResult | null>(null);
    const [isConverting, setIsConverting] = useState<boolean>(false);
    const [convertError, setConvertError] = useState<string | null>(null);
    const [targetFormat, setTargetFormat] = useState<string>('image/png');
    const [quality, setQuality] = useState<number>(0.8);

    const handlePolyglotModeChange = (newMode: PolyglotMode) => {
        setPolyglotMode(newMode);
        // Clear all state to prevent confusion between modes
        setContainerFile(null);
        setHiddenFile(null);
        setPolyglotFile(null);
        setPolyglotFilename(null);
        setCreateError(null);
        setIsCreating(false);
        setIsAssistantOpen(false);
        setDecodeFile(null);
        setExtractedFile(null);
        setDecodeError(null);
        setIsDecoding(false);
        setUseAiDecode(true);
        setDecodeStatus('Decoding...');
        setIsM4aFile(false);
        setExecutableType('exe');
        setConvertFile(null);
        setConvertedFile(null);
        setConvertError(null);
        setIsConverting(false);
    };

    // --- Create Mode Logic ---
    const handleCombineFiles = useCallback(async () => {
        if (!containerFile || !hiddenFile) {
            setCreateError("Please select both files before combining.");
            return;
        }
        setIsCreating(true);
        setCreateError(null);
        setPolyglotFile(null);
        setPolyglotFilename(null);
        try {
            const { blob, newContainerName } = await createPolyglot(containerFile, hiddenFile, autoConvert);
            setPolyglotFile(blob);
            setPolyglotFilename(newContainerName);
        } catch (err) {
            setCreateError("An error occurred while combining the files. Please try again.");
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    }, [containerFile, hiddenFile, autoConvert]);

    const handleDownloadPolyglot = useCallback(() => {
        if (!polyglotFile || !polyglotFilename) return;
        const url = URL.createObjectURL(polyglotFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = polyglotFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [polyglotFile, polyglotFilename]);

    // --- Decode Mode Logic ---
    const handleDecodeFile = useCallback(async () => {
        if (!decodeFile) {
            setDecodeError("Please select a file to decode.");
            return;
        }
        setIsDecoding(true);
        setDecodeError(null);
        setExtractedFile(null);
        setDecodeStatus('Decoding...');
        try {
            const decodeOptions: DecodeOptions | undefined = isM4aFile ? { executableType } : undefined;
            let result = await decodePolyglot(decodeFile, decodeOptions);
            
            if (!result && useAiDecode) {
                setDecodeStatus('Standard check failed. Trying AI analysis...');
                result = await decodePolyglotWithAI(decodeFile);
            }

            if (result) {
                setExtractedFile(result);
            } else {
                let errorMessage = "No hidden file found. The file might not be a supported polyglot (e.g. PNG, JPG, GIF container) or it contains no hidden data.";
                if (isM4aFile) {
                    errorMessage = `Could not find a hidden ${executableType.toUpperCase()} file in the M4A container. Try the other executable type or AI-assisted decoding.`
                } else if (useAiDecode) {
                    errorMessage = "AI-assisted decoding could not find a hidden file. The file may not contain hidden data or the format is too complex.";
                }
                setDecodeError(errorMessage);
            }
        } catch (err) {
            const errorMessage = (err instanceof Error) ? err.message : "An unknown error occurred during decoding.";
            setDecodeError(errorMessage);
            console.error(err);
        } finally {
            setIsDecoding(false);
        }
    }, [decodeFile, useAiDecode, isM4aFile, executableType]);

    const handleDownloadExtracted = useCallback(() => {
        if (!extractedFile) return;
        const url = URL.createObjectURL(extractedFile.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = extractedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [extractedFile]);

    // --- Convert Mode Logic ---
    const handleConvertImage = useCallback(async () => {
        if (!convertFile) {
            setConvertError("Please select an image to convert.");
            return;
        }
        if (!convertFile.type.startsWith('image/')) {
            setConvertError("Only image files can be converted.");
            return;
        }

        setIsConverting(true);
        setConvertError(null);
        setConvertedFile(null);
        try {
            const result = await convertImage(convertFile, targetFormat, quality);
            setConvertedFile(result);
        } catch (err) {
            setConvertError("An error occurred during conversion. The file may not be a supported image format.");
            console.error(err);
        } finally {
            setIsConverting(false);
        }
    }, [convertFile, targetFormat, quality]);

    const handleDownloadConverted = useCallback(() => {
        if (!convertedFile) return;
        const url = URL.createObjectURL(convertedFile.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = convertedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [convertedFile]);

    const renderCreateMode = () => (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FileUpload
                    id="container-file"
                    file={containerFile}
                    onFileSelect={setContainerFile}
                    onClear={() => setContainerFile(null)}
                    title="Container File"
                    description="The visible file (e.g., an image or text file)."
                />
                <FileUpload
                    id="hidden-file"
                    file={hiddenFile}
                    onFileSelect={setHiddenFile}
                    onClear={() => setHiddenFile(null)}
                    title="Hidden File"
                    description="The file to hide inside the container."
                />
            </div>

            <div className="mt-8 flex flex-col items-center space-y-4">
                <ToggleSwitch
                    checked={autoConvert}
                    onChange={setAutoConvert}
                    label="Auto-convert container"
                    description="Convert text or incompatible image types to a robust PNG container."
                />

                <button
                    onClick={handleCombineFiles}
                    disabled={!containerFile || !hiddenFile || isCreating}
                    className="flex items-center justify-center w-full max-w-xs px-8 py-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
                >
                    {isCreating ? (
                        <><LoadingSpinner className="w-5 h-5 mr-3"/><span>Combining...</span></>
                    ) : (
                        "Combine Files"
                    )}
                </button>

                {containerFile && !isCreating && (
                    <button
                        onClick={() => setIsAssistantOpen(true)}
                        className="flex items-center justify-center w-full max-w-xs px-8 py-3 bg-slate-700 text-indigo-300 font-semibold rounded-lg shadow-md hover:bg-slate-600 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
                    >
                        <MagicIcon className="w-5 h-5 mr-3"/>
                        <span>Ask AI Assistant</span>
                    </button>
                )}

                {createError && <p className="mt-4 text-red-400">{createError}</p>}
                
                {polyglotFile && polyglotFilename && (
                    <div className="mt-8 p-6 bg-slate-800/50 border border-slate-700 rounded-lg text-center w-full max-w-md animate-fade-in">
                        <h3 className="text-xl font-semibold text-white">Success!</h3>
                        <p className="mt-2 text-slate-400">Your polyglot file is ready for download.</p>
                        <button
                            onClick={handleDownloadPolyglot}
                            className="mt-4 inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-500 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-green-500"
                        >
                            <DownloadIcon className="w-5 h-5 mr-2" />
                            Download {polyglotFilename}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderDecodeMode = () => (
        <div className="w-full max-w-2xl mx-auto animate-fade-in">
            <FileUpload
                id="decode-file"
                file={decodeFile}
                onFileSelect={(file) => {
                    setDecodeFile(file);
                    setExtractedFile(null);
                    setDecodeError(null);
                    const isM4a = file.name.toLowerCase().endsWith('.m4a') || file.type === 'audio/mp4';
                    setIsM4aFile(isM4a);
                }}
                onClear={() => {
                    setDecodeFile(null);
                    setExtractedFile(null);
                    setDecodeError(null);
                    setIsM4aFile(false);
                }}
                title="Polyglot File"
                description="Upload the file you want to inspect for hidden data."
            />
            <div className="mt-8 flex flex-col items-center space-y-6">
                {isM4aFile && (
                    <div className="w-full max-w-lg p-4 bg-slate-800/50 rounded-lg animate-fade-in">
                        <h3 className="font-semibold text-white mb-2">M4A Container Settings</h3>
                        <p className="text-sm text-slate-400 mb-3">
                            This appears to be an M4A file. Specify the suspected hidden executable type.
                        </p>
                        <div className="flex rounded-md shadow-sm">
                            <button
                                type="button"
                                onClick={() => setExecutableType('exe')}
                                className={`relative inline-flex items-center justify-center px-4 py-2 rounded-l-md text-sm font-medium transition-colors focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-1/2 ${
                                    executableType === 'exe'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                EXE File
                            </button>
                            <button
                                type="button"
                                onClick={() => setExecutableType('apk')}
                                className={`relative -ml-px inline-flex items-center justify-center px-4 py-2 rounded-r-md text-sm font-medium transition-colors focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-1/2 ${
                                    executableType === 'apk'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                APK File
                            </button>
                        </div>
                    </div>
                )}
                 <ToggleSwitch
                    checked={useAiDecode}
                    onChange={setUseAiDecode}
                    label="AI-Assisted Fallback"
                    description="If standard decoding fails, use AI to analyze the file structure."
                />
                <button
                    onClick={handleDecodeFile}
                    disabled={!decodeFile || isDecoding}
                    className="flex items-center justify-center w-full max-w-xs px-8 py-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
                >
                    {isDecoding ? (
                        <><LoadingSpinner className="w-5 h-5 mr-3"/><span>{decodeStatus}</span></>
                    ) : (
                         useAiDecode ? 
                        <><MagicIcon className="w-5 h-5 mr-2"/><span>Decode with AI Fallback</span></> :
                        <><SearchIcon className="w-5 h-5 mr-2"/><span>Decode File</span></>
                    )}
                </button>

                {decodeError && <p className="mt-4 text-red-400 text-center max-w-md">{decodeError}</p>}

                {extractedFile && (
                    <div className="mt-8 p-6 bg-slate-800/50 border border-slate-700 rounded-lg text-left w-full max-w-md animate-fade-in">
                        <h3 className="text-xl font-semibold text-white text-center mb-4">Hidden File Found!</h3>
                        <div className="space-y-2 text-slate-300">
                           <p><span className="font-semibold text-slate-400">Detected Name:</span> {extractedFile.name}</p>
                           <p><span className="font-semibold text-slate-400">Detected Type:</span> {extractedFile.type}</p>
                           <p><span className="font-semibold text-slate-400">Size:</span> {formatBytes(extractedFile.size)}</p>
                        </div>
                        <div className="text-center">
                           <button
                                onClick={handleDownloadExtracted}
                                className="mt-6 inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-500 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-green-500"
                            >
                                <DownloadIcon className="w-5 h-5 mr-2" />
                                Download Extracted File
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
    
    const renderConvertMode = () => {
        const showQualitySlider = targetFormat === 'image/jpeg' || targetFormat === 'image/webp';

        return (
            <div className="w-full max-w-2xl mx-auto animate-fade-in">
                <FileUpload
                    id="convert-file"
                    file={convertFile}
                    onFileSelect={(file) => {
                        setConvertFile(file);
                        setConvertedFile(null);
                        setConvertError(null);
                    }}
                    onClear={() => {
                        setConvertFile(null);
                        setConvertedFile(null);
                        setConvertError(null);
                    }}
                    title="Image to Convert"
                    description="Upload an image to change its format."
                />
                <div className="mt-8 flex flex-col items-center space-y-6">
                    <div className="w-full max-w-md p-4 bg-slate-800/50 rounded-lg">
                        <label htmlFor="format-select" className="block text-sm font-medium text-slate-300 mb-2">Target Format</label>
                        <select
                            id="format-select"
                            value={targetFormat}
                            onChange={(e) => setTargetFormat(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="image/png">PNG</option>
                            <option value="image/jpeg">JPEG</option>
                            <option value="image/webp">WebP</option>
                            <option value="image/gif">GIF</option>
                            <option value="image/bmp">BMP</option>
                        </select>
                    </div>

                    {showQualitySlider && (
                        <div className="w-full max-w-md p-4 bg-slate-800/50 rounded-lg animate-fade-in">
                            <label htmlFor="quality-slider" className="block text-sm font-medium text-slate-300 mb-2">Quality: <span className="font-bold text-white">{Math.round(quality * 100)}%</span></label>
                            <input
                                id="quality-slider"
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={quality}
                                onChange={(e) => setQuality(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    )}

                    <button
                        onClick={handleConvertImage}
                        disabled={!convertFile || isConverting}
                        className="flex items-center justify-center w-full max-w-xs px-8 py-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
                    >
                        {isConverting ? (
                            <><LoadingSpinner className="w-5 h-5 mr-3" /><span>Converting...</span></>
                        ) : (
                            <><MagicIcon className="w-5 h-5 mr-2" /><span>Convert Image</span></>
                        )}
                    </button>

                    {convertError && <p className="mt-4 text-red-400 text-center max-w-md">{convertError}</p>}

                    {convertedFile && (
                        <div className="mt-8 p-6 bg-slate-800/50 border border-slate-700 rounded-lg text-left w-full max-w-md animate-fade-in">
                            <h3 className="text-xl font-semibold text-white text-center mb-4">Conversion Successful!</h3>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
                                <img src={URL.createObjectURL(convertedFile.blob)} alt="Converted preview" className="w-32 h-32 object-contain rounded-md bg-slate-700/50 p-1" />
                                <div className="space-y-2 text-slate-300 flex-grow">
                                    <p><span className="font-semibold text-slate-400">New Name:</span> <span className="break-all">{convertedFile.name}</span></p>
                                    <p><span className="font-semibold text-slate-400">New Size:</span> {formatBytes(convertedFile.blob.size)}</p>
                                    {convertFile && <p><span className="font-semibold text-slate-400">Original Size:</span> {formatBytes(convertFile.size)}</p>}
                                </div>
                            </div>
                            <div className="text-center">
                               <button
                                    onClick={handleDownloadConverted}
                                    className="mt-6 inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-500 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-green-500"
                                >
                                    <DownloadIcon className="w-5 h-5 mr-2" />
                                    Download Converted Image
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderCurrentPolyglotMode = () => {
        switch (polyglotMode) {
            case 'create':
                return renderCreateMode();
            case 'decode':
                return renderDecodeMode();
            case 'convert':
                return renderConvertMode();
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-6xl mx-auto">
                <header className="text-center mb-10">
                    <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                        File Embedding Tools
                    </h1>
                    <p className="mt-4 text-lg text-slate-400 max-w-3xl mx-auto">
                        A suite of tools for embedding files within other files using various techniques.
                    </p>
                </header>

                <main>
                    <div className="mb-4 flex justify-center border-b border-slate-700">
                         <div className="px-4 sm:px-6 py-3 font-semibold text-xl sm:text-2xl text-white">
                            Polyglot
                        </div>
                        {/* Future main modes like "Steganography" can be added here */}
                    </div>

                    <div className="mb-8 flex justify-center border-b border-slate-800">
                        <button onClick={() => handlePolyglotModeChange('create')} className={`px-4 sm:px-6 py-3 font-medium text-base sm:text-lg transition-colors focus:outline-none ${polyglotMode === 'create' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}>
                            Create
                        </button>
                         <button onClick={() => handlePolyglotModeChange('convert')} className={`px-4 sm:px-6 py-3 font-medium text-base sm:text-lg transition-colors focus:outline-none ${polyglotMode === 'convert' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}>
                            Convert
                        </button>
                        <button onClick={() => handlePolyglotModeChange('decode')} className={`px-4 sm:px-6 py-3 font-medium text-base sm:text-lg transition-colors focus:outline-none ${polyglotMode === 'decode' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}>
                            Decode
                        </button>
                    </div>

                    {renderCurrentPolyglotMode()}
                </main>
                 <AiAssistantModal 
                    isOpen={isAssistantOpen}
                    onClose={() => setIsAssistantOpen(false)}
                    containerFile={containerFile}
                />
            </div>
        </div>
    );
};

export default App;