import JSZip from 'jszip';
import { Mp3Encoder } from '@breezystack/lamejs';
import { GeneratedAudio } from '../types';

// Decodes Base64 string to raw binary string
function atobBinary(base64: string): string {
  return window.atob(base64);
}

// Converts binary string to Uint8Array
function binaryToBytes(binary: string): Uint8Array {
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Decodes raw PCM data (Gemini output) into an AudioBuffer
export async function decodeAudioData(
  base64Data: string,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const binaryString = atobBinary(base64Data);
  const bytes = binaryToBytes(binaryString);
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert PCM 16-bit int to float [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Convert AudioBuffer to WAV Blob
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true); // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArr], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

// Convert AudioBuffer to MP3 Blob using lamejs
export function audioBufferToMp3(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const mp3encoder = new Mp3Encoder(channels, sampleRate, 128); // 128kbps

  // Get PCM data from AudioBuffer (Float32 -> Int16)
  const samples = buffer.getChannelData(0); // Assuming mono for now, Gemini is mono mostly
  const sampleBlockSize = 1152;
  const mp3Data = [];

  const samplesInt16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    samplesInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  let remaining = samplesInt16.length;
  let i = 0;
  
  while (remaining >= sampleBlockSize) {
    const chunk = samplesInt16.subarray(i, i + sampleBlockSize);
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

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

// Zip multiple audio files
export async function createBatchZip(items: GeneratedAudio[]): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("gemini-vox-export");

  if (!folder) throw new Error("Could not create zip folder");

  items.forEach(item => {
    if (item.audioBuffer) {
        // Prefer MP3 for zip if possible, otherwise WAV
        // To be safe and fast, let's use WAV for batch as it's raw
        const blob = audioBufferToWav(item.audioBuffer);
        const filename = `${item.id}-${item.voice.replace(/\s+/g, '_')}.wav`;
        folder.file(filename, blob);
    }
  });

  return await zip.generateAsync({ type: "blob" });
}

// Stitch multiple AudioBuffers (for chunking support)
export function stitchBuffers(buffers: AudioBuffer[], ctx: AudioContext): AudioBuffer {
    const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
    const result = ctx.createBuffer(1, totalLength, buffers[0].sampleRate);
    const data = result.getChannelData(0);
    
    let offset = 0;
    for (const buf of buffers) {
        data.set(buf.getChannelData(0), offset);
        offset += buf.length;
    }
    return result;
}
