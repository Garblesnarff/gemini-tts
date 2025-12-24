import { Buffer } from 'node:buffer';
import { Mp3Encoder } from '@breezystack/lamejs';

// Convert Base64 PCM to Buffer
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

// Create WAV Header for PCM data
// Gemini: 24kHz, 16-bit, Mono (usually)
export function createWavHeader(pcmLength: number, sampleRate: number = 24000, numChannels: number = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * numChannels * 2; // 16-bit = 2 bytes
  const blockAlign = numChannels * 2;
  const dataSize = pcmLength;
  const fileSize = 36 + dataSize;

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // BitsPerSample

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
}

// Convert PCM Buffer to MP3 Buffer using lamejs
export function pcmToMp3(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1): Buffer {
  const mp3encoder = new Mp3Encoder(numChannels, sampleRate, 128); // 128kbps
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
  
  const sampleBlockSize = 1152;
  const mp3Data: Int8Array[] = [];
  
  // LameJS expects distinct arrays for left/right if stereo, but Gemini is mono usually
  // If mono, passing the same array or just one works depending on lamejs config
  // For mono config above:
  
  let remaining = samples.length;
  let i = 0;
  
  while (remaining >= sampleBlockSize) {
    const chunk = samples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
    remaining -= sampleBlockSize;
    i += sampleBlockSize;
  }
  
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  // Combine chunks into one Buffer
  const totalLength = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
  const result = Buffer.alloc(totalLength);
  let offset = 0;
  for (const buf of mp3Data) {
    const b = Buffer.from(buf);
    b.copy(result, offset);
    offset += b.length;
  }

  return result;
}