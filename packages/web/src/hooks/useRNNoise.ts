import { useEffect, useRef, useState } from 'react';
import { Rnnoise, DenoiseState } from '@shiguredo/rnnoise-wasm';

interface UseRNNoiseOptions {
  enabled: boolean;
  deviceId?: string;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
}

/**
 * Hook to apply RNNoise noise suppression to microphone input
 * Returns a processed MediaStream that can be used with LiveKit
 */
export function useRNNoise(options: UseRNNoiseOptions) {
  const { enabled, deviceId, echoCancellation = true, autoGainControl = true } = options;

  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      try {
        console.log('[RNNoise] Setup starting, enabled:', enabled);

        // Get microphone with constraints
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation,
            autoGainControl,
            noiseSuppression: false, // We'll use RNNoise instead
            sampleRate: 48000, // RNNoise requires 48kHz
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          },
        };

        const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          rawStream.getTracks().forEach(t => t.stop());
          return;
        }

        // If noise suppression disabled, return raw stream
        if (!enabled) {
          console.log('[RNNoise] Disabled, using raw stream');
          setProcessedStream(rawStream);
          setIsReady(true);
          setError(null);
          cleanupRef.current = () => {
            rawStream.getTracks().forEach(t => t.stop());
          };
          return;
        }

        // Initialize audio context
        const ctx = new AudioContext({ sampleRate: 48000 });
        contextRef.current = ctx;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        // Load RNNoise
        console.log('[RNNoise] Loading WASM...');
        const rnnoise = await Rnnoise.load();
        const denoiseState = rnnoise.createDenoiseState();
        console.log('[RNNoise] Loaded, frameSize:', rnnoise.frameSize);

        // Create audio nodes
        const source = ctx.createMediaStreamSource(rawStream);
        const processor = ctx.createScriptProcessor(4096, 1, 1); // Larger buffer for stability
        const destination = ctx.createMediaStreamDestination();

        // Store in ref to prevent garbage collection
        processorRef.current = processor;

        let inputBuffer: number[] = [];
        let processCount = 0;

        // Audio processing callback
        processor.onaudioprocess = (e) => {
          try {
            const input = e.inputBuffer.getChannelData(0);
            const output = e.outputBuffer.getChannelData(0);

            processCount++;
            if (processCount === 1 || processCount % 100 === 0) {
              console.log('[RNNoise] Processing audio, call #', processCount);
            }

            // Keep AudioContext alive
            if (ctx.state === 'suspended') {
              ctx.resume().catch(console.error);
            }

            // Add input samples to buffer (limit buffer size to prevent memory leak)
            for (let i = 0; i < input.length; i++) {
              inputBuffer.push(input[i]);
            }

            // Prevent buffer overflow - drop old samples if buffer gets too large
            if (inputBuffer.length > rnnoise.frameSize * 10) {
              console.warn('[RNNoise] Buffer overflow, dropping old samples');
              inputBuffer = inputBuffer.slice(-rnnoise.frameSize * 5);
            }

            let writePos = 0;
            let framesProcessed = 0;

            // Process in 480-sample chunks
            while (inputBuffer.length >= rnnoise.frameSize && writePos < output.length) {
              // Extract frame
              const frame = new Float32Array(inputBuffer.slice(0, rnnoise.frameSize));
              inputBuffer = inputBuffer.slice(rnnoise.frameSize);

              // Process through RNNoise
              const processed = new Float32Array(rnnoise.frameSize);
              denoiseState.processFrame(processed, frame);
              framesProcessed++;

              // Write to output
              const writeLen = Math.min(rnnoise.frameSize, output.length - writePos);
              output.set(processed.subarray(0, writeLen), writePos);
              writePos += writeLen;
            }

            if (processCount % 100 === 0) {
              console.log('[RNNoise] Processed', framesProcessed, 'frames, buffer:', inputBuffer.length, 'samples');
            }

            // Fill rest with silence
            if (writePos < output.length) {
              output.fill(0, writePos);
            }
          } catch (err) {
            console.error('[RNNoise] Process error:', err);
            // On error, pass through input
            const input = e.inputBuffer.getChannelData(0);
            output.set(input);
          }
        };

        // Connect nodes: mic → processor → destination (NOT to speakers!)
        source.connect(processor);
        processor.connect(destination);

        console.log('[RNNoise] Pipeline connected (processed audio only)');
        console.log('[RNNoise] Output stream tracks:', destination.stream.getTracks().length);

        if (!mounted) {
          processor.disconnect();
          source.disconnect();
          denoiseState.destroy();
          rawStream.getTracks().forEach(t => t.stop());
          ctx.close();
          return;
        }

        setProcessedStream(destination.stream);
        setIsReady(true);
        setError(null);

        // Cleanup function
        cleanupRef.current = () => {
          console.log('[RNNoise] Cleanup');
          try {
            processor.disconnect();
            source.disconnect();
            denoiseState.destroy();
            rawStream.getTracks().forEach(t => t.stop());
            ctx.close();
          } catch (e) {
            console.error('[RNNoise] Cleanup error:', e);
          }
        };

      } catch (err) {
        console.error('[RNNoise] Setup error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Setup failed');
          setIsReady(false);
        }
      }
    }

    setup();

    return () => {
      mounted = false;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      processorRef.current = null;
      contextRef.current = null;
    };
  }, [enabled, deviceId, echoCancellation, autoGainControl]);

  return { stream: processedStream, isReady, error };
}
