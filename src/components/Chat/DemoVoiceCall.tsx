/**
 * مكون مكالمة صوتية تجريبي - يعمل بدون ميكروفون
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { PhoneIcon, PhoneXMarkIcon, MicrophoneIcon } from '@heroicons/react/24/solid';
import { addDoc, collection, serverTimestamp, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DemoVoiceCallProps {
  chatId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  isInitiator: boolean;
  onEnd: () => void;
  existingCallId?: string;  // للمستقبل: معرف المكالمة الموجودة
}

export default function DemoVoiceCall({
  chatId,
  callerId,
  callerName,
  receiverId,
  receiverName,
  isInitiator,
  onEnd,
  existingCallId,
}: DemoVoiceCallProps) {
  const [callStatus, setCallStatus] = useState<'initiating' | 'ringing' | 'ongoing' | 'ended'>(
    isInitiator ? 'initiating' : 'ringing'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentCallDocId, setCurrentCallDocId] = useState<string | null>(null);

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // إنشاء مكالمة في Firestore (للمتصل)
  const createCallInFirestore = async () => {
    try {
      console.log('📞 إنشاء مكالمة في Firestore...');
      const callDoc = await addDoc(collection(db, 'calls'), {
        chatId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        status: 'ringing',
        createdAt: serverTimestamp(),
      });
      setCurrentCallDocId(callDoc.id);
      console.log('✅ تم إنشاء المكالمة:', callDoc.id);
      return callDoc.id;
    } catch (error) {
      console.error('❌ فشل إنشاء المكالمة:', error);
      return null;
    }
  };

  // مراقبة حالة المكالمة في Firestore
  useEffect(() => {
    if (!currentCallDocId && !isInitiator) {
      // المستقبل: نحتاج للحصول على call ID من Firestore
      // سيتم تعيينه عبر listener في ChatWindow
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setupListener = async () => {
      // انتظر قليلاً حتى يتم إنشاء المكالمة
      await new Promise(resolve => setTimeout(resolve, 500));

      if (currentCallDocId) {
        console.log('👂 بدء مراقبة حالة المكالمة:', currentCallDocId);
        const callDocRef = doc(db, 'calls', currentCallDocId);
        
        unsubscribe = onSnapshot(callDocRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log('📡 تحديث حالة المكالمة:', data.status);
            
            if (data.status === 'ended' || data.status === 'rejected') {
              console.log('🔴 المكالمة انتهت من الطرف الآخر');
              setCallStatus('ended');
              stopAudio();
              setTimeout(() => {
                onEnd();
              }, 1000);
            }
          }
        }, (error) => {
          console.error('❌ خطأ في listener:', error);
        });
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        console.log('🔌 إيقاف listener المكالمة');
        unsubscribe();
      }
    };
  }, [currentCallDocId]);

  useEffect(() => {
    if (isInitiator) {
      console.log('📞 المتصل: بدء المكالمة...');
      // إنشاء المكالمة في Firestore
      createCallInFirestore();
      
      // محاكاة الاتصال
      setTimeout(() => {
        setCallStatus('ringing');
        playRingtone();
      }, 1000);
    } else {
      console.log('📞 المستقبل: استقبال المكالمة...');
      // المستقبل: استخدام call ID الموجود
      if (existingCallId) {
        setCurrentCallDocId(existingCallId);
        console.log('✅ تم تعيين call ID للمستقبل:', existingCallId);
      }
      // المستقبل يبدأ في حالة "ongoing" مباشرة لأنه ضغط "رد"
      setCallStatus('ongoing');
      startCallDuration();
      playOngoingTone();
    }

    return () => {
      stopAudio();
    };
  }, []);

  // الحصول على أو إنشاء AudioContext (إعادة استخدام)
  const getOrCreateAudioContext = () => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        console.log('🔧 إنشاء AudioContext جديد للمكالمة');
        audioContextRef.current = new AudioContext();
      }
      // استئناف إذا كان متوقفاً
      if (audioContextRef.current.state === 'suspended') {
        console.log('⚠️ AudioContext متوقف - استئناف...');
        audioContextRef.current.resume();
      }
      return audioContextRef.current;
    } catch (error) {
      console.error('❌ خطأ في AudioContext:', error);
      throw error;
    }
  };

  // تشغيل نغمة الرنين
  const playRingtone = () => {
    try {
      const audioContext = getOrCreateAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440; // نغمة A
      gainNode.gain.value = 0.1;

      oscillator.start();

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;

      // إيقاف بعد 1 ثانية وتكرار
      setTimeout(() => {
        try {
          oscillator.stop();
          setTimeout(() => {
            if (callStatus !== 'ended') {
              playRingtone();
            }
          }, 1000);
        } catch (e) {
          console.warn('⚠️ خطأ في إيقاف oscillator:', e);
        }
      }, 1000);
    } catch (error) {
      console.warn('⚠️ خطأ في تشغيل الرنين:', error);
    }
  };

  // الرد على المكالمة
  const answerCall = async () => {
    console.log('📞 الرد على المكالمة...');
    stopAudio();
    setCallStatus('ongoing');
    startCallDuration();
    playOngoingTone();
    console.log('✅ المكالمة نشطة الآن');
  };

  // تشغيل نغمة خلال المكالمة (محاكاة)
  const playOngoingTone = () => {
    try {
      const audioContext = getOrCreateAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = 200; // نغمة منخفضة
      gainNode.gain.value = 0.05; // صوت منخفض جداً

      oscillator.start();

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
    } catch (error) {
      console.warn('⚠️ خطأ في تشغيل نغمة المكالمة:', error);
    }
  };

  // إيقاف الصوت
  const stopAudio = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      oscillatorRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        // تحقق من حالة AudioContext قبل إغلاقه
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (e) {
        console.warn('⚠️ Error closing AudioContext:', e);
      }
      audioContextRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current = null;
    }
  };

  // رفض المكالمة
  const rejectCall = () => {
    stopAudio();
    setCallStatus('ended');
    setTimeout(onEnd, 500);
  };

  // بدء عداد المكالمة
  const startCallDuration = () => {
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // إنهاء المكالمة
  const endCall = async () => {
    console.log('🔴 إنهاء المكالمة...');
    
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
    stopAudio();
    setCallStatus('ended');
    
    // تحديث حالة المكالمة في Firestore
    if (currentCallDocId) {
      try {
        console.log('📤 تحديث Firestore: ended');
        const callDoc = doc(db, 'calls', currentCallDocId);
        await updateDoc(callDoc, {
          status: 'ended',
          endedAt: serverTimestamp(),
          duration: callDuration,
        });
        console.log('✅ تم تحديث حالة المكالمة في Firestore');
      } catch (error) {
        console.error('❌ خطأ في إنهاء المكالمة:', error);
      }
    }
    
    setTimeout(onEnd, 500);
  };

  // كتم/إلغاء كتم الصوت
  const toggleMute = () => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0.05 : 0;
    }
    setIsMuted(!isMuted);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* تنبيه Demo Mode */}
        <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-lg p-2 text-center">
          <p className="text-xs text-yellow-800">
            🧪 <strong>وضع تجريبي</strong> - مكالمة بدون ميكروفون حقيقي
          </p>
        </div>

        {/* حالة المكالمة */}
        <div className="text-center mb-8">
          {callStatus === 'initiating' && (
            <>
              <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-700">جاري الاتصال...</p>
            </>
          )}
          
          {callStatus === 'ringing' && (
            <>
              <div className="animate-pulse rounded-full h-20 w-20 bg-green-500 mx-auto mb-4 flex items-center justify-center">
                <PhoneIcon className="h-10 w-10 text-white" />
              </div>
              <p className="text-lg text-gray-700">
                {isInitiator ? 'يرن...' : `مكالمة من ${callerName}`}
              </p>
            </>
          )}

          {callStatus === 'ongoing' && (
            <>
              <div className="rounded-full h-20 w-20 bg-green-500 mx-auto mb-4 flex items-center justify-center relative">
                <PhoneIcon className="h-10 w-10 text-white" />
                {/* موجة صوتية متحركة */}
                <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-75"></div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {formatDuration(callDuration)}
              </p>
              <p className="text-sm text-gray-600">جارية (تجريبية)</p>
            </>
          )}
        </div>

        {/* اسم المتصل/المستقبل */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {isInitiator ? receiverName : callerName}
          </h3>
        </div>

        {/* أزرار التحكم */}
        <div className="flex justify-center gap-4">
          {callStatus === 'ongoing' && (
            <>
              {/* زر كتم الصوت */}
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all transform hover:scale-110 ${
                  isMuted
                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                    : 'bg-white text-gray-900 border-2 border-gray-300 hover:bg-gray-50'
                }`}
                title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
              >
                <MicrophoneIcon className={`h-8 w-8 ${isMuted ? 'opacity-50' : ''}`} />
              </button>

              {/* زر إنهاء المكالمة */}
              <button
                onClick={endCall}
                className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all transform hover:scale-110"
                title="إنهاء المكالمة"
              >
                <PhoneXMarkIcon className="h-8 w-8" />
              </button>
            </>
          )}

          {(callStatus === 'initiating' || callStatus === 'ringing') && (
            <button
              onClick={endCall}
              className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all transform hover:scale-110"
              title="إلغاء"
            >
              <PhoneXMarkIcon className="h-8 w-8" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

