/**
 * Hook للتنبيهات الصوتية
 */

import { useEffect, useRef, useState } from 'react';

export function useNotificationSound() {
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // التحقق من إعدادات الكتم المحفوظة
    const savedMuteState = localStorage.getItem('chatSoundsMuted');
    if (savedMuteState) {
      setIsMuted(savedMuteState === 'true');
    }
  }, []);

  // حفظ حالة الكتم
  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    localStorage.setItem('chatSoundsMuted', String(newState));
  };

  // تشغيل صوت رسالة جديدة
  const playMessageSound = () => {
    console.log('🔔 محاولة تشغيل صوت رسالة جديدة...');
    console.log('📊 حالة الكتم:', isMuted ? 'مكتوم 🔇' : 'مفعّل 🔊');
    
    if (isMuted) {
      console.log('⚠️ الصوت مكتوم - لن يتم التشغيل');
      return;
    }
    
    try {
      const audioContext = getAudioContext();
      console.log('✅ AudioContext جاهز');
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // نغمة لطيفة (C-E-G)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G

      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      
      console.log('🎵 تم تشغيل الصوت بنجاح! ♪ دو - مي - صول ♪');
    } catch (error) {
      console.error('❌ فشل تشغيل الصوت:', error);
    }
  };

  // تشغيل صوت رسالة صوتية
  const playVoiceMessageSound = () => {
    console.log('🎙️ محاولة تشغيل صوت رسالة صوتية...');
    console.log('📊 حالة الكتم:', isMuted ? 'مكتوم 🔇' : 'مفعّل 🔊');
    
    if (isMuted) {
      console.log('⚠️ الصوت مكتوم - لن يتم التشغيل');
      return;
    }
    
    try {
      const audioContext = getAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // نغمة مختلفة للرسائل الصوتية (نغمة أعمق)
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A
      oscillator.frequency.setValueAtTime(554.37, audioContext.currentTime + 0.15); // C#

      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.7);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.7);
      
      console.log('🎵 تم تشغيل صوت رسالة صوتية! ♪ لا - دو# ♪');
    } catch (error) {
      console.error('❌ فشل تشغيل الصوت:', error);
    }
  };

  // تشغيل صوت مكالمة واردة (رنين)
  const playIncomingCallSound = () => {
    if (isMuted) return;
    
    const audioContext = getAudioContext();
    
    // رنين متكرر
    const playRing = (delay: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = 800;

      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime + delay);
      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime + delay + 0.2);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + delay + 0.4);

      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + 0.4);
    };

    // رنتين
    playRing(0);
    playRing(0.5);
  };

  // تشغيل صوت إرسال رسالة
  const playSentSound = () => {
    if (isMuted) return;
    
    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // نغمة قصيرة وسريعة
    oscillator.type = 'sine';
    oscillator.frequency.value = 800;

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  };

  // الحصول على AudioContext (إعادة استخدام)
  const getAudioContext = (): AudioContext => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        console.log('🔧 إنشاء AudioContext جديد');
        audioContextRef.current = new AudioContext();
      }
      
      // استئناف AudioContext إذا كان متوقفاً (بسبب سياسة المتصفح)
      if (audioContextRef.current.state === 'suspended') {
        console.log('⚠️ AudioContext متوقف - محاولة الاستئناف...');
        audioContextRef.current.resume().then(() => {
          console.log('✅ تم استئناف AudioContext');
        }).catch((err) => {
          console.error('❌ فشل استئناف AudioContext:', err);
        });
      }
      
      return audioContextRef.current;
    } catch (error) {
      console.error('❌ خطأ في إنشاء AudioContext:', error);
      throw error;
    }
  };
  
  // دالة اختبار الصوت
  const testSound = () => {
    console.log('🧪 اختبار الصوت...');
    playMessageSound();
  };

  return {
    isMuted,
    toggleMute,
    playMessageSound,
    playVoiceMessageSound,
    playIncomingCallSound,
    playSentSound,
    testSound,
  };
}

