/**
 * مكون تسجيل الصوت
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, TrashIcon } from '@heroicons/react/24/outline';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({
  onRecordingComplete,
  onCancel,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // بدء التسجيل
  const startRecording = async () => {
    try {
      // التحقق من وجود ميكروفون
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioInput = devices.some(device => device.kind === 'audioinput');
      
      if (!hasAudioInput) {
        alert('⚠️ لم يتم العثور على ميكروفون. تأكد من توصيل ميكروفون بجهازك.');
        onCancel();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // إعداد Audio Context للعرض المرئي
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // إعداد MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob, recordingTime);
        
        // تنظيف
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // بدء العداد
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // بدء عرض مستوى الصوت
      updateAudioLevel();
    } catch (error: any) {
      console.error('Error starting recording:', error);
      
      if (error.name === 'NotFoundError') {
        alert('⚠️ لم يتم العثور على ميكروفون!\n\nتأكد من:\n1. توصيل ميكروفون بجهازك\n2. تفعيل الميكروفون في إعدادات النظام');
      } else if (error.name === 'NotAllowedError') {
        alert('🚫 تم رفض الوصول للميكروفون!\n\nيرجى السماح بالوصول للميكروفون من إعدادات المتصفح.');
      } else {
        alert('❌ فشل بدء التسجيل. تأكد من توصيل ميكروفون بجهازك.');
      }
      
      onCancel();
    }
  };

  // تحديث مستوى الصوت
  const updateAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(average / 255); // تحويل إلى نسبة من 0 إلى 1

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  // إيقاف التسجيل
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  // إلغاء التسجيل
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    onCancel();
  };

  // التنظيف عند إلغاء المكون
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // بدء التسجيل تلقائياً
  useEffect(() => {
    startRecording();
  }, []);

  // تنسيق الوقت
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <div className="flex items-center gap-4">
        {/* أيقونة الميكروفون */}
        <div className="relative">
          <div
            className={`w-16 h-16 rounded-full bg-red-500 flex items-center justify-center ${
              isRecording ? 'animate-pulse' : ''
            }`}
          >
            <MicrophoneIcon className="h-8 w-8 text-white" />
          </div>

          {/* دائرة مستوى الصوت */}
          {isRecording && (
            <div
              className="absolute inset-0 rounded-full border-4 border-red-400"
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
            {isRecording ? '🎙️ جاري التسجيل...' : '⏸️ متوقف'}
          </p>
          <p className="text-2xl font-mono font-bold text-red-600">
            {formatTime(recordingTime)}
          </p>

          {/* شريط مستوى الصوت */}
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-100"
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
        💡 تحدث بوضوح - الحد الأقصى 5 دقائق
      </div>
    </div>
  );
}

