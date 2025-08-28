import { convertImage } from './imageService';
import { GoogleGenAI, Type } from "@google/genai";

// --- HELPER FUNCTIONS FOR FILE CONVERSION ---

/**
 * Converts a text string into a PNG Blob by rendering it on a canvas.
 * @param text The text content to render.
 * @returns A Promise that resolves to a PNG Blob.
 */
const convertTextToPng = (text: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));

        const font = '16px monospace';
        const lineHeight = 20;
        const padding = 20;
        const maxWidth = 800;
        
        ctx.font = font;
        
        const lines: string[] = [];
        const paragraphs = text.split('\n');
        for (const paragraph of paragraphs) {
            const words = paragraph.split(' ');
            let currentLine = words[0] || '';
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < maxWidth - (padding * 2)) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
        }

        canvas.width = maxWidth;
        canvas.height = (lines.length * lineHeight) + (padding * 2);

        ctx.fillStyle = '#1e293b'; // slate-800
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#cbd5e1'; // slate-300
        ctx.font = font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        lines.forEach((line, i) => {
            ctx.fillText(line, padding, padding + (i * lineHeight));
        });

        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed for text conversion'));
        }, 'image/png');
    });
};


// --- CREATION LOGIC ---

export interface CreatePolyglotResult {
  blob: Blob;
  newContainerName: string;
}

/**
 * Creates a polyglot file by concatenating two files.
 * This version can automatically convert the container file to a PNG for better compatibility.
 * It also embeds a metadata header for the hidden file for accurate decoding.
 *
 * @param containerFile The outer file that will act as the container.
 * @param hiddenFile The inner file to be hidden.
 * @param autoConvert Whether to automatically convert the container file if needed.
 * @returns A Promise that resolves to an object containing the Blob and the new filename.
 */
export const createPolyglot = async (containerFile: File, hiddenFile: File, autoConvert: boolean): Promise<CreatePolyglotResult> => {
  
  let finalContainerFile = containerFile;
  let newContainerName = containerFile.name;

  const isConvertibleText = containerFile.type.startsWith('text/');
  const isPoorImageContainer = ['image/bmp', 'image/webp', 'image/tiff'].includes(containerFile.type);

  if (autoConvert && (isConvertibleText || isPoorImageContainer)) {
      const originalNameNoExt = containerFile.name.substring(0, containerFile.name.lastIndexOf('.')) || containerFile.name;
      newContainerName = `${originalNameNoExt}.png`;
      let convertedBlob: Blob;

      if (isConvertibleText) {
          const textContent = await containerFile.text();
          convertedBlob = await convertTextToPng(textContent);
      } else { // isPoorImageContainer
          convertedBlob = await (await convertImage(containerFile, 'image/png')).blob;
      }
      finalContainerFile = new File([convertedBlob], newContainerName, { type: 'image/png' });
  }

  const containerBuffer = await finalContainerFile.arrayBuffer();
  const hiddenBuffer = await hiddenFile.arrayBuffer();

  const metadata = {
    name: hiddenFile.name,
    type: hiddenFile.type || 'application/octet-stream',
  };
  const metadataString = JSON.stringify(metadata);
  const metadataBuffer = new TextEncoder().encode(metadataString);
  const metadataLength = metadataBuffer.byteLength;

  const lengthBuffer = new ArrayBuffer(4);
  new DataView(lengthBuffer).setUint32(0, metadataLength, false);

  const combinedLength = containerBuffer.byteLength + lengthBuffer.byteLength + metadataLength + hiddenBuffer.byteLength;
  const combinedArray = new Uint8Array(combinedLength);

  let offset = 0;
  combinedArray.set(new Uint8Array(containerBuffer), offset);
  offset += containerBuffer.byteLength;
  combinedArray.set(new Uint8Array(lengthBuffer), offset);
  offset += lengthBuffer.byteLength;
  combinedArray.set(metadataBuffer, offset);
  offset += metadataLength;
  combinedArray.set(new Uint8Array(hiddenBuffer), offset);

  const combinedBlob = new Blob([combinedArray], { type: finalContainerFile.type });

  return { blob: combinedBlob, newContainerName };
};


// --- DECODING LOGIC ---

const findSequence = (haystack: Uint8Array, needle: number[], start: number = 0): number => {
    for (let i = start; i <= haystack.length - needle.length; i++) {
        let found = true;
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) {
                found = false;
                break;
            }
        }
        if (found) return i;
    }
    return -1;
};

const signatures: { [key: string]: { sig: number[], offset?: number, mime: string, ext: string } } = {
    'PNG': { sig: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mime: 'image/png', ext: 'png' },
    'JPEG': { sig: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg', ext: 'jpg' },
    'GIF87a': { sig: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mime: 'image/gif', ext: 'gif' },
    'GIF89a': { sig: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mime: 'image/gif', ext: 'gif' },
    'ZIP': { sig: [0x50, 0x4B, 0x03, 0x04], mime: 'application/zip', ext: 'zip' },
    'PDF': { sig: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf', ext: 'pdf' },
    'EXE': { sig: [0x4D, 0x5A], mime: 'application/vnd.microsoft.portable-executable', ext: 'exe' },
    'APK': { sig: [0x50, 0x4B, 0x03, 0x04], mime: 'application/vnd.android.package-archive', ext: 'apk' },
};

const detectFileType = (data: Uint8Array): { mime: string, ext: string } | null => {
    for (const type in signatures) {
        const { sig, offset = 0 } = signatures[type];
        if (data.length < offset + sig.length) continue;
        let match = true;
        for (let i = 0; i < sig.length; i++) {
            if (data[offset + i] !== sig[i]) {
                match = false;
                break;
            }
        }
        if (match) return { mime: signatures[type].mime, ext: signatures[type].ext };
    }
    return null;
};

export interface DecodedFile {
    blob: Blob;
    name: string;
    type: string;
    size: number;
}

// Helper function to process a potential payload (the hidden file's data)
const processPayload = (payload: Uint8Array): DecodedFile | null => {
    // First, try to decode using our custom metadata header
    if (payload.length > 4) {
        try {
            const dataView = new DataView(payload.buffer, payload.byteOffset, 4);
            const metadataLength = dataView.getUint32(0, false);

            if (payload.length >= 4 + metadataLength && metadataLength > 0 && metadataLength < payload.length) {
                const metadataBuffer = payload.slice(4, 4 + metadataLength);
                const metadataString = new TextDecoder().decode(metadataBuffer);
                const metadata = JSON.parse(metadataString);
                
                const fileData = payload.slice(4 + metadataLength);
                
                if (typeof metadata.name === 'string' && typeof metadata.type === 'string' && fileData.length > 0) {
                    const blob = new Blob([fileData], { type: metadata.type });
                    return {
                        blob,
                        name: metadata.name,
                        type: metadata.type,
                        size: blob.size,
                    };
                }
            }
        } catch (error) {
            console.warn("Could not decode with metadata header, falling back to signature detection.", error);
        }
    }

    // Fallback to signature detection if metadata header fails or isn't present
    if (payload.length > 0) {
        // Search for a known file signature near the beginning of the payload.
        // This is more robust than assuming the signature is at the exact start.
        for (const type in signatures) {
            const { sig } = signatures[type];
            const startIndex = findSequence(payload, sig, 0);

            // We accept a signature if it's found within the first 16 bytes.
            // This allows for some padding/garbage after the container's EOF.
            if (startIndex !== -1 && startIndex < 16) {
                const fileData = payload.slice(startIndex);
                const { mime, ext } = signatures[type];
                const name = `hidden-file.${ext}`;
                const blob = new Blob([fileData], { type: mime });
                return {
                    blob,
                    name,
                    type: mime,
                    size: blob.size,
                };
            }
        }

        // If no signature is found, default to a generic binary file.
        const blob = new Blob([payload], { type: 'application/octet-stream' });
        return {
            blob,
            name: 'hidden-file.dat',
            type: 'application/octet-stream',
            size: blob.size,
        };
    }

    return null;
};

const decodeM4AContainer = (data: Uint8Array, expectedType: 'exe' | 'apk'): DecodedFile | null => {
    let offset = 0;
    const dataView = new DataView(data.buffer);

    try {
        while (offset + 8 <= data.length) {
            const currentBoxStart = offset;
            let boxSize = dataView.getUint32(offset, false);
            const boxType = new TextDecoder().decode(data.subarray(offset + 4, offset + 8));

            if (!/^[a-zA-Z0-9\s]{4}$/.test(boxType)) {
                break; // Invalid box type, likely start of hidden data
            }

            if (boxSize === 1) { // 64-bit size
                if (offset + 16 > data.length) break;
                const sizeHigh = dataView.getUint32(offset + 8, false);
                if (sizeHigh > 0) break; // File too large for this parser
                boxSize = dataView.getUint32(offset + 12, false);
                offset += boxSize;
            } else if (boxSize === 0) { // Extends to end of file
                offset = data.length;
                break;
            } else {
                offset += boxSize;
            }

            if (offset > data.length) {
                offset = currentBoxStart; // Box size is invalid
                break;
            }
        }
    } catch (e) {
        console.error("Error parsing M4A boxes, using last valid offset.", e);
    }
    
    const splitIndex = offset;

    if (splitIndex > 0 && splitIndex < data.length) {
        const payload = data.slice(splitIndex);
        const signatureKey = expectedType.toUpperCase();
        if (signatures[signatureKey]) {
            const { sig, mime, ext } = signatures[signatureKey];
            if (findSequence(payload, sig, 0) === 0) {
                 const blob = new Blob([payload], { type: mime });
                 return {
                     blob,
                     name: `hidden.${ext}`,
                     type: mime,
                     size: blob.size,
                 };
            }
        }
    }
    return null;
};

export interface DecodeOptions {
    executableType?: 'exe' | 'apk';
}

export const decodePolyglot = async (polyglotFile: File, options?: DecodeOptions): Promise<DecodedFile | null> => {
    const buffer = await polyglotFile.arrayBuffer();
    const data = new Uint8Array(buffer);

    const isM4A = polyglotFile.name.toLowerCase().endsWith('.m4a') || polyglotFile.type === 'audio/mp4';
    if (isM4A && options?.executableType) {
        const result = decodeM4AContainer(data, options.executableType);
        if (result) return result;
    }

    const markers = {
        PNG: { header: [0x89, 0x50, 0x4E, 0x47], full_eof: [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82], eof_len: 12 },
        JPEG: { header: [0xFF, 0xD8, 0xFF], eof: [0xFF, 0xD9], eof_len: 2 },
        GIF: { header: [0x47, 0x49, 0x46], eof: [0x3B], eof_len: 1 },
    };

    let splitIndex = -1;

    const startsWith = (arr: Uint8Array, prefix: number[]) => {
        if (arr.length < prefix.length) return false;
        for (let i = 0; i < prefix.length; i++) {
            if (arr[i] !== prefix[i]) return false;
        }
        return true;
    }

    if (startsWith(data, markers.PNG.header)) {
        const eofIndex = findSequence(data, markers.PNG.full_eof);
        if (eofIndex !== -1) splitIndex = eofIndex + markers.PNG.eof_len;
    }
    else if (startsWith(data, markers.JPEG.header)) {
        let lastKnownIndex = -1;
        let searchOffset = 0;
        while (searchOffset < data.length) {
            const tempIndex = findSequence(data, markers.JPEG.eof, searchOffset);
            if (tempIndex !== -1) {
                lastKnownIndex = tempIndex;
                searchOffset = tempIndex + 1;
            } else {
                break;
            }
        }
        if (lastKnownIndex !== -1) splitIndex = lastKnownIndex + markers.JPEG.eof_len;
    }
    else if (startsWith(data, markers.GIF.header)) {
        const eofIndex = data.lastIndexOf(markers.GIF.eof[0], data.length - 2);
        if (eofIndex !== -1) splitIndex = eofIndex + markers.GIF.eof_len;
    }
    
    if (splitIndex !== -1 && splitIndex < data.length) {
        const payload = data.slice(splitIndex);
        return processPayload(payload);
    }

    return null;
};


// --- AI-ASSISTED DECODING ---

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

export const decodePolyglotWithAI = async (polyglotFile: File): Promise<DecodedFile | null> => {
    const buffer = await polyglotFile.arrayBuffer();
    const data = new Uint8Array(buffer);

    let containerType = polyglotFile.type || "unknown";
    if (containerType === 'application/octet-stream' || !containerType) {
        const detected = detectFileType(data);
        if (detected) containerType = detected.mime;
    }

    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

    const prompt = `You are a file format analysis expert. A file has been provided which is suspected to be a polyglot file, created by concatenating a hidden file onto the end of a container file.
Your task is to identify the exact byte offset where the hidden file begins.
Container file type: ${containerType}
Total file size: ${data.length} bytes.
Here are the first 256 bytes of the file (in hexadecimal):
${bytesToHex(data.slice(0, 256))}
Here are the last 1024 bytes of the file (in hexadecimal):
${bytesToHex(data.slice(-1024))}
Based on the structure of the container file's end-of-file markers and the potential start of a new file signature or our custom metadata in the trailing bytes, determine the split index. The container file should end, and the hidden file should begin immediately after. Our custom metadata starts with a 4-byte big-endian integer specifying the length of a JSON string.
Respond ONLY with a JSON object with a single key "splitIndex", which should be an integer representing the starting byte of the hidden file. If you cannot determine the index, respond with a splitIndex of -1.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        splitIndex: {
                            type: Type.NUMBER,
                            description: 'The byte offset where the hidden file begins, or -1 if not found.',
                        },
                    },
                    required: ['splitIndex'],
                }
            }
        });

        const jsonResponse = JSON.parse(response.text);
        const splitIndex = jsonResponse.splitIndex;

        if (typeof splitIndex === 'number' && splitIndex > 0 && splitIndex < data.length) {
            console.log(`AI suggested split index: ${splitIndex}`);
            const payload = data.slice(splitIndex);
            return processPayload(payload);
        } else {
            console.log("AI could not determine a valid split index.");
            return null;
        }

    } catch (err) {
        console.error("Error during AI-assisted decoding:", err);
        throw new Error("The AI model failed to process the file. Please try again.");
    }
};