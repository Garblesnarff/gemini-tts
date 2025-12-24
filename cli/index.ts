#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import process from 'node:process';
import { Buffer } from 'node:buffer';

const program = new Command();
const API_URL = 'http://localhost:3001/api';

program
  .name('gemini-vox')
  .description('CLI for Gemini Vox TTS')
  .version('1.0.0');

program
  .argument('[text]', 'Text to speak')
  .option('-v, --voice <name>', 'Voice name', 'Puck')
  .option('-s, --style <style>', 'Style or prompt', 'Normal')
  .option('-p, --profile <name>', 'Use a saved profile')
  .option('-o, --output <file>', 'Output file path', 'output.mp3')
  .option('-f, --file <path>', 'Read text from file')
  .option('--format <fmt>', 'mp3 or wav', 'mp3')
  .option('--list-profiles', 'List saved profiles')
  .action(async (textArg, options) => {
    try {
        // List Profiles
        if (options.listProfiles) {
            const res = await fetch(`${API_URL}/profiles`);
            const profiles = await res.json();
            console.table(profiles.map((p: any) => ({ Name: p.name, Voice: p.voice, Style: p.style })));
            return;
        }

        // Get Text
        let text = textArg;
        if (options.file) {
            text = await fs.readFile(options.file, 'utf-8');
        }

        if (!text) {
            console.error("Error: Please provide text or a file.");
            process.exit(1);
        }

        console.log(`Generating speech...`);
        
        const payload = {
            text,
            voice: options.voice,
            style: options.style,
            profile: options.profile,
            format: options.format
        };

        const res = await fetch(`${API_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Server error');
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        await fs.writeFile(options.output, buffer);
        console.log(`Saved to ${options.output}`);

    } catch (e: any) {
        if (e.cause?.code === 'ECONNREFUSED') {
            console.error("Error: Could not connect to Gemini Vox server. Is it running on port 3001?");
        } else {
            console.error("Error:", e.message);
        }
    }
  });

program.parse();