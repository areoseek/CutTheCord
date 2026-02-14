/**
 * Shared AudioContext configured for media playback.
 *
 * On Android, WebRTC's getUserMedia switches the audio session to
 * "communication" mode (earpiece + phone mic). By creating an
 * AudioContext with latencyHint 'playback' and playing silence through
 * it BEFORE getUserMedia runs, we lock Android into the media audio
 * pipeline (loudspeaker + media mic).
 *
 * This context is passed to LiveKit's webAudioMix option so all remote
 * audio also routes through the media pipeline.
 */

let mediaAudioContext: AudioContext | undefined;

export function getMediaAudioContext(): AudioContext {
  if (!mediaAudioContext) {
    mediaAudioContext = new AudioContext({ latencyHint: 'playback' });
  }
  return mediaAudioContext;
}

/**
 * Must be called from a user gesture (e.g. "Join Voice" tap).
 * Resumes the AudioContext and plays a short silent buffer to establish
 * the media audio session on Android before WebRTC takes over.
 */
export async function primeMediaAudioContext(): Promise<void> {
  const ctx = getMediaAudioContext();

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  // Play a tiny silent buffer to activate the media audio route
  const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}
