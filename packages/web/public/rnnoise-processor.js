/**
 * RNNoise AudioWorklet Processor
 * Processes audio samples through RNNoise for noise suppression
 * This runs in the AudioWorklet thread (separate from main thread)
 */

class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 480; // RNNoise processes 480 samples at a time (10ms at 48kHz)
    this.inputBuffer = [];
    this.denoiseState = null;
    this.isReady = false;

    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'init') {
        // Receive the initialized DenoiseState from main thread
        this.denoiseState = event.data.denoiseState;
        this.isReady = true;
        console.log('[AudioWorklet] RNNoise initialized');
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0];
    const outputChannel = output[0];

    // If RNNoise not ready, pass through
    if (!this.isReady || !this.denoiseState) {
      outputChannel.set(inputChannel);
      return true;
    }

    // Add incoming samples to buffer
    this.inputBuffer.push(...inputChannel);

    let writeIndex = 0;

    // Process complete 480-sample frames
    while (this.inputBuffer.length >= this.frameSize && writeIndex < outputChannel.length) {
      // Extract one frame
      const frame = new Float32Array(this.inputBuffer.slice(0, this.frameSize));
      this.inputBuffer = this.inputBuffer.slice(this.frameSize);

      try {
        // Process through RNNoise
        const processedFrame = new Float32Array(this.frameSize);
        this.denoiseState.processFrame(processedFrame, frame);

        // Write to output
        const samplesToWrite = Math.min(this.frameSize, outputChannel.length - writeIndex);
        outputChannel.set(processedFrame.subarray(0, samplesToWrite), writeIndex);
        writeIndex += samplesToWrite;
      } catch (err) {
        // If processing fails, pass through original
        const samplesToWrite = Math.min(this.frameSize, outputChannel.length - writeIndex);
        outputChannel.set(frame.subarray(0, samplesToWrite), writeIndex);
        writeIndex += samplesToWrite;
      }
    }

    // Fill remaining output with silence if needed
    if (writeIndex < outputChannel.length) {
      outputChannel.fill(0, writeIndex);
    }

    return true;
  }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor);
