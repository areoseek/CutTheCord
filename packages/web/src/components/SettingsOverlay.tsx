import React, { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import AvatarUpload from './AvatarUpload';

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export default function SettingsOverlay() {
  const closeSettings = useUIStore((s) => s.closeSettings);
  const settings = useSettingsStore();
  const [audioInputs, setAudioInputs] = useState<MediaDeviceOption[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceOption[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceOption[]>([]);
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [videoPreview, setVideoPreview] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<'profile' | 'voice' | 'audio-processing'>('voice');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [closeSettings]);

  useEffect(() => {
    async function loadDevices() {
      if (!navigator.mediaDevices) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(t => t.stop());
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
        } catch { /* no devices */ }
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 5)}` })));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput').map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 5)}` })));
        setVideoInputs(devices.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}` })));
      } catch (e) {
        console.error('Failed to enumerate devices:', e);
      }
    }
    loadDevices();

    return () => {
      stopMicTest();
      stopVideoPreview();
    };
  }, []);

  const startMicTest = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: settings.audioInputDeviceId ? { deviceId: { exact: settings.audioInputDeviceId } } : true,
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = settings.inputVolume / 100;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(gainNode).connect(analyser);
      analyserRef.current = analyser;

      setMicTesting(true);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(avg / 255 * 100);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.error('Mic test failed:', e);
    }
  };

  const stopMicTest = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    cancelAnimationFrame(animFrameRef.current);
    setMicTesting(false);
    setMicLevel(0);
  };

  const startVideoPreview = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: settings.videoInputDeviceId ? { deviceId: { exact: settings.videoInputDeviceId } } : true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setVideoPreview(true);
    } catch (e) {
      console.error('Video preview failed:', e);
    }
  };

  const stopVideoPreview = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setVideoPreview(false);
  };

  const noiseGateThreshold = useSettingsStore((s) => s.noiseGateThreshold);

  return (
    <div className="fixed inset-0 z-50 bg-[#313338] flex flex-col sm:flex-row">
      {/* Sidebar */}
      <div className="sm:w-60 bg-[#2b2d31] p-4 flex sm:flex-col flex-shrink-0 overflow-x-auto sm:overflow-x-visible">
        <button onClick={closeSettings} className="text-[#b5bac1] hover:text-white text-sm mb-4 text-left">
          &larr; Back
        </button>
        <h3 className="text-xs font-semibold text-[#949ba4] uppercase mb-2">User Settings</h3>
        <button
          onClick={() => setActiveTab('profile')}
          className={`text-sm text-left px-3 py-2 rounded mb-1 ${activeTab === 'profile' ? 'text-white bg-[#404249]' : 'text-[#b5bac1] hover:text-white hover:bg-[#35373c]'}`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={`text-sm text-left px-3 py-2 rounded mb-1 ${activeTab === 'voice' ? 'text-white bg-[#404249]' : 'text-[#b5bac1] hover:text-white hover:bg-[#35373c]'}`}
        >
          Voice & Video
        </button>
        <button
          onClick={() => setActiveTab('audio-processing')}
          className={`text-sm text-left px-3 py-2 rounded mb-1 ${activeTab === 'audio-processing' ? 'text-white bg-[#404249]' : 'text-[#b5bac1] hover:text-white hover:bg-[#35373c]'}`}
        >
          Audio Processing
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-8 max-w-2xl overflow-y-auto">
        {/* Close button */}
        <button
          onClick={closeSettings}
          className="fixed top-4 right-4 w-9 h-9 rounded-full border-2 border-[#b5bac1] flex items-center justify-center text-[#b5bac1] hover:text-white hover:border-white transition z-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
          </svg>
        </button>

        {activeTab === 'profile' && (
          <>
            <h2 className="text-xl font-bold text-white mb-6">Profile</h2>
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-3">Avatar</label>
              <AvatarUpload />
            </div>
          </>
        )}

        {activeTab === 'voice' && (
          <>
            <h2 className="text-xl font-bold text-white mb-6">Voice & Video Settings</h2>

            {/* Audio Input */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Input Device</label>
              <select
                value={settings.audioInputDeviceId}
                onChange={e => settings.setAudioInput(e.target.value)}
                className="w-full bg-[#1e1f22] rounded px-3 py-2 text-white outline-none"
              >
                <option value="">Default</option>
                {audioInputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Input Volume */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">
                Input Volume: {settings.inputVolume}%
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={settings.inputVolume}
                onChange={e => settings.setInputVolume(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Audio Output */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Output Device</label>
              <select
                value={settings.audioOutputDeviceId}
                onChange={e => settings.setAudioOutput(e.target.value)}
                className="w-full bg-[#1e1f22] rounded px-3 py-2 text-white outline-none"
              >
                <option value="">Default</option>
                {audioOutputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Output Volume */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">
                Output Volume: {settings.outputVolume}%
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={settings.outputVolume}
                onChange={e => settings.setOutputVolume(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Mic Test */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Mic Test</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={micTesting ? stopMicTest : startMicTest}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    micTesting
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {micTesting ? 'Stop Test' : 'Start Test'}
                </button>
                {micTesting && (
                  <div className="flex-1 h-4 bg-[#1e1f22] rounded overflow-hidden relative">
                    <div
                      className="h-full bg-green-500 transition-all duration-75"
                      style={{ width: `${Math.min(micLevel, 100)}%` }}
                    />
                    {noiseGateThreshold > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-400"
                        style={{ left: `${noiseGateThreshold}%` }}
                        title={`Noise gate threshold: ${noiseGateThreshold}%`}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Video Input */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Camera</label>
              <select
                value={settings.videoInputDeviceId}
                onChange={e => settings.setVideoInput(e.target.value)}
                className="w-full bg-[#1e1f22] rounded px-3 py-2 text-white outline-none"
              >
                <option value="">Default</option>
                {videoInputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Video Preview */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Video Preview</label>
              <button
                onClick={videoPreview ? stopVideoPreview : startVideoPreview}
                className={`px-4 py-2 rounded text-sm font-medium mb-3 ${
                  videoPreview
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {videoPreview ? 'Stop Preview' : 'Preview Camera'}
              </button>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full max-w-md rounded bg-black ${videoPreview ? 'block' : 'hidden'}`}
              />
            </div>
          </>
        )}

        {activeTab === 'audio-processing' && (
          <>
            <h2 className="text-xl font-bold text-white mb-6">Audio Processing</h2>

            {/* Noise Suppression */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Noise Suppression</div>
                <div className="text-xs text-[#949ba4]">Reduces background noise from your microphone</div>
              </div>
              <button
                onClick={() => settings.setNoiseSuppression(!settings.noiseSuppression)}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings.noiseSuppression ? 'bg-green-500' : 'bg-[#4e5058]'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.noiseSuppression ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Echo Cancellation */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Echo Cancellation</div>
                <div className="text-xs text-[#949ba4]">Prevents your speakers from feeding back into your mic</div>
              </div>
              <button
                onClick={() => settings.setEchoCancellation(!settings.echoCancellation)}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings.echoCancellation ? 'bg-green-500' : 'bg-[#4e5058]'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.echoCancellation ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Auto Gain Control */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Automatic Gain Control</div>
                <div className="text-xs text-[#949ba4]">Automatically adjusts your microphone volume</div>
              </div>
              <button
                onClick={() => settings.setAutoGainControl(!settings.autoGainControl)}
                className={`w-11 h-6 rounded-full transition-colors relative ${settings.autoGainControl ? 'bg-green-500' : 'bg-[#4e5058]'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.autoGainControl ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Noise Gate */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">
                Noise Gate Threshold: {noiseGateThreshold === 0 ? 'Off' : `${noiseGateThreshold}%`}
              </label>
              <div className="text-xs text-[#949ba4] mb-2">
                Mutes your mic when audio level is below this threshold. Set to 0 to disable.
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={noiseGateThreshold}
                onChange={e => settings.setNoiseGateThreshold(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
