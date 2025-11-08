/**
 * مكون المكالمات الصوتية - WebRTC
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { PhoneIcon, PhoneXMarkIcon, MicrophoneIcon } from '@heroicons/react/24/solid';
import { addDoc, collection, doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CallStatus } from '@/types/shared';

interface VoiceCallProps {
  chatId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  isInitiator: boolean;
  onEnd: () => void;
}

export default function VoiceCall({
  chatId,
  callerId,
  callerName,
  receiverId,
  receiverName,
  isInitiator,
  onEnd,
}: VoiceCallProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>(
    isInitiator ? CallStatus.INITIATING : CallStatus.RINGING
  );
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // إعداد WebRTC
  const setupWebRTC = async () => {
    try {
      // التحقق من وجود ميكروفون
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioInput = devices.some(device => device.kind === 'audioinput');
      
      if (!hasAudioInput) {
        alert('⚠️ لم يتم العثور على ميكروفون. تأكد من توصيل ميكروفون بجهازك.');
        return null;
      }

      // الحصول على stream الصوتي المحلي
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // إعداد RTCPeerConnection
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      };

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // إضافة tracks المحلية
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // الاستماع للـ remote stream
      peerConnection.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // معالجة ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate && currentCallId) {
          try {
            const callDoc = doc(db, 'calls', currentCallId);
            await updateDoc(callDoc, {
              iceCandidates: [...(event.candidate ? [event.candidate.toJSON()] : [])],
            });
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        }
      };

      // معالجة تغييرات الاتصال
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
          setCallStatus(CallStatus.ONGOING);
          startCallDuration();
        } else if (
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'failed'
        ) {
          endCall();
        }
      };

      return peerConnection;
    } catch (error: any) {
      console.error('Error setting up WebRTC:', error);
      
      if (error.name === 'NotFoundError') {
        alert('⚠️ لم يتم العثور على ميكروفون!\n\nتأكد من:\n1. توصيل ميكروفون بجهازك\n2. تفعيل الميكروفون في إعدادات النظام\n\n💡 يمكنك استخدام التسجيلات الصوتية بدلاً من المكالمات.');
      } else if (error.name === 'NotAllowedError') {
        alert('🚫 تم رفض الوصول للميكروفون!\n\nيرجى السماح بالوصول للميكروفون من إعدادات المتصفح.');
      } else {
        alert('❌ فشل إعداد المكالمة. تأكد من السماح بالوصول للميكروفون.');
      }
      
      return null;
    }
  };

  // بدء المكالمة (للمتصل)
  const initiateCall = async () => {
    try {
      const peerConnection = await setupWebRTC();
      if (!peerConnection) return;

      // إنشاء Offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // حفظ بيانات المكالمة في Firestore
      const callDoc = await addDoc(collection(db, 'calls'), {
        chatId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        status: CallStatus.RINGING,
        offer: offer as any,
        createdAt: serverTimestamp(),
      });

      setCurrentCallId(callDoc.id);

      // الاستماع للـ Answer
      const unsubscribe = onSnapshot(callDoc, async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && !peerConnection.currentRemoteDescription) {
          const answer = new RTCSessionDescription(data.answer);
          await peerConnection.setRemoteDescription(answer);
        }

        if (data?.status === CallStatus.REJECTED) {
          setCallStatus(CallStatus.REJECTED);
          endCall();
        }
      });

    } catch (error) {
      console.error('Error initiating call:', error);
      alert('فشل بدء المكالمة');
      endCall();
    }
  };

  // الرد على المكالمة (للمستقبل)
  const answerCall = async (callId: string, offer: any) => {
    try {
      const peerConnection = await setupWebRTC();
      if (!peerConnection) return;

      // تعيين Remote Description (Offer)
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // إنشاء Answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // حفظ الـ Answer في Firestore
      const callDoc = doc(db, 'calls', callId);
      await updateDoc(callDoc, {
        answer: answer as any,
        status: CallStatus.ONGOING,
        startedAt: serverTimestamp(),
      });

      setCallStatus(CallStatus.ONGOING);
      startCallDuration();
    } catch (error) {
      console.error('Error answering call:', error);
      alert('فشل الرد على المكالمة');
      endCall();
    }
  };

  // رفض المكالمة
  const rejectCall = async () => {
    if (currentCallId) {
      const callDoc = doc(db, 'calls', currentCallId);
      await updateDoc(callDoc, {
        status: CallStatus.REJECTED,
        endedAt: serverTimestamp(),
      });
    }
    endCall();
  };

  // بدء عداد المكالمة
  const startCallDuration = () => {
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // إنهاء المكالمة
  const endCall = async () => {
    // إيقاف العداد
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }

    // إيقاف الـ tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // إغلاق peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // تحديث حالة المكالمة في Firestore
    if (currentCallId) {
      const callDoc = doc(db, 'calls', currentCallId);
      await updateDoc(callDoc, {
        status: CallStatus.ENDED,
        endedAt: serverTimestamp(),
        duration: callDuration,
      });
    }

    setCallStatus(CallStatus.ENDED);
    onEnd();
  };

  // كتم/إلغاء كتم الصوت
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // تنسيق الوقت
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // بدء المكالمة تلقائياً إذا كان المتصل
  useEffect(() => {
    if (isInitiator) {
      initiateCall();
    }
  }, [isInitiator]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* حالة المكالمة */}
        <div className="text-center mb-8">
          {callStatus === CallStatus.INITIATING && (
            <>
              <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-700">جاري الاتصال...</p>
            </>
          )}
          
          {callStatus === CallStatus.RINGING && (
            <>
              <div className="animate-pulse rounded-full h-20 w-20 bg-green-500 mx-auto mb-4 flex items-center justify-center">
                <PhoneIcon className="h-10 w-10 text-white" />
              </div>
              <p className="text-lg text-gray-700">
                {isInitiator ? 'يرن...' : `مكالمة واردة من ${callerName}`}
              </p>
            </>
          )}

          {callStatus === CallStatus.ONGOING && (
            <>
              <div className="rounded-full h-20 w-20 bg-green-500 mx-auto mb-4 flex items-center justify-center">
                <PhoneIcon className="h-10 w-10 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {formatDuration(callDuration)}
              </p>
              <p className="text-sm text-gray-600">جارية</p>
            </>
          )}

          {callStatus === CallStatus.REJECTED && (
            <>
              <div className="rounded-full h-20 w-20 bg-red-500 mx-auto mb-4 flex items-center justify-center">
                <PhoneXMarkIcon className="h-10 w-10 text-white" />
              </div>
              <p className="text-lg text-gray-700">تم رفض المكالمة</p>
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
          {callStatus === CallStatus.RINGING && !isInitiator && (
            <>
              {/* زر الرد */}
              <button
                onClick={() => answerCall(currentCallId!, { type: 'offer' })}
                className="p-4 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all transform hover:scale-110"
                title="رد"
              >
                <PhoneIcon className="h-8 w-8" />
              </button>

              {/* زر الرفض */}
              <button
                onClick={rejectCall}
                className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all transform hover:scale-110"
                title="رفض"
              >
                <PhoneXMarkIcon className="h-8 w-8" />
              </button>
            </>
          )}

          {callStatus === CallStatus.ONGOING && (
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
                <MicrophoneIcon className={`h-8 w-8 ${isMuted ? 'line-through' : ''}`} />
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

          {(callStatus === CallStatus.INITIATING || callStatus === CallStatus.RINGING) && isInitiator && (
            <button
              onClick={endCall}
              className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all transform hover:scale-110"
              title="إلغاء"
            >
              <PhoneXMarkIcon className="h-8 w-8" />
            </button>
          )}
        </div>

        {/* ملفات الصوت المخفية */}
        <audio ref={localAudioRef} muted autoPlay />
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
}

