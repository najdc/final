/**
 * مكون تسجيل صوتي تجريبي - يعمل بدون ميكروفون
 * يستخدم Web Speech API لتحويل النص إلى صوت
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, TrashIcon } from '@heroicons/react/24/outline';

interface DemoVoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export default function DemoVoiceRecorder({
  onRecordingComplete,
  onCancel,
}: DemoVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedText, setRecordedText] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioLevelInterval.current) clearInterval(audioLevelInterval.current);
    };
  }, []);

  const startRecording = () => {
    setIsRecording(true);

    // بدء العداد
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    // محاكاة مستوى الصوت (عشوائي)
    audioLevelInterval.current = setInterval(() => {
      setAudioLevel(Math.random() * 0.7 + 0.3); // بين 0.3 و 1.0
    }, 100);
  };

  // إيقاف التسجيل وتوليد صوت تجريبي
  const stopRecording = async () => {
    if (!isRecording) return;

    setIsRecording(false);

    if (timerRef.current) clearInterval(timerRef.current);
    if (audioLevelInterval.current) clearInterval(audioLevelInterval.current);

    // توليد صوت تجريبي باستخدام Web Audio API
    const audioBlob = await generateDemoAudio(recordingTime);
    onRecordingComplete(audioBlob, recordingTime);
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioLevelInterval.current) clearInterval(audioLevelInterval.current);
    onCancel();
  };

  // توليد ملف صوتي تجريبي
  const generateDemoAudio = async (duration: number): Promise<Blob> => {
    // إنشاء AudioContext
    const audioContext = new AudioContext();
    const sampleRate = audioContext.sampleRate;
    const numSamples = sampleRate * Math.min(duration, 3); // حد أقصى 3 ثواني للتجريب

    // إنشاء buffer
    const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    // توليد موجة صوتية (نغمة بسيطة)
    const frequency = 440; // نغمة A4
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // موجة جيبية (sine wave) مع تلاشي تدريجي
      channelData[i] = Math.sin(2 * Math.PI * frequency * t) * (1 - t / duration) * 0.3;
    }

    // تحويل إلى WAV blob
    const wavBlob = audioBufferToWav(audioBuffer);
    return wavBlob;
  };

  // تحويل AudioBuffer إلى WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = buffer.getChannelData(0);
    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    let offset = 0;
    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };

    writeString('RIFF');
    view.setUint32(offset, bufferLength - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, format, true); offset += 2;
    view.setUint16(offset, numberOfChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, bitDepth, true); offset += 2;
    writeString('data');
    view.setUint32(offset, dataLength, true); offset += 4;

    // Audio data
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      {/* رسالة Demo Mode */}
      <div className="mb-3 bg-yellow-50 border border-yellow-300 rounded-lg p-2 text-center">
        <p className="text-xs text-yellow-800">
          🧪 <strong>وضع تجريبي</strong> - تسجيل صوتي بدون ميكروفون (للاختبار فقط)
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* أيقونة الميكروفون */}
        <div className="relative">
          <div
            className={`w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center ${
              isRecording ? 'animate-pulse' : ''
            }`}
          >
            <MicrophoneIcon className="h-8 w-8 text-white" />
          </div>

          {/* دائرة مستوى الصوت */}
          {isRecording && (
            <div
              className="absolute inset-0 rounded-full border-4 border-yellow-400"
              style={{
                transform: `scale(${1 + audioLevel * 0.5})`,
                opacity: audioLevel,
                transition: 'transform 0.1s, opacity 0.1s',
              }}
            />
          )}
        </div>

        {/* معلومات التسجيل */}
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {isRecording ? '🎙️ تسجيل تجريبي...' : '⏸️ متوقف'}
          </p>
          <p className="text-2xl font-mono font-bold text-yellow-600">
            {formatTime(recordingTime)}
          </p>

          {/* شريط مستوى الصوت */}
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="flex gap-2">
          {/* إيقاف وإرسال */}
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-110"
            title="إيقاف وإرسال"
          >
            <StopIcon className="h-6 w-6" />
          </button>

          {/* إلغاء */}
          <button
            onClick={cancelRecording}
            className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all transform hover:scale-110"
            title="إلغاء"
          >
            <TrashIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* تلميحات */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        💡 وضع تجريبي - سيتم إرسال صوت تجريبي (نغمة موسيقية)
      </div>
    </div>
  );
}


