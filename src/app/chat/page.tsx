'use client';

import { useState } from 'react';
import { useChat, useChatMessages, useAllowedChatUsers } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Layout/Navbar';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { ar } from 'date-fns/locale/ar';
import { Chat, Message } from '@/types/shared';
import {
  PaperAirplaneIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  MicrophoneIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  PhoneIcon as PhoneIconSolid,
  PhoneXMarkIcon 
} from '@heroicons/react/24/solid';
import VoiceRecorder from '@/components/Chat/VoiceRecorder';
import DemoVoiceRecorder from '@/components/Chat/DemoVoiceRecorder';
import AudioPlayer from '@/components/Chat/AudioPlayer';
import VoiceCall from '@/components/Chat/VoiceCall';
import DemoVoiceCall from '@/components/Chat/DemoVoiceCall';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect } from 'react';

// وضع التجريب - استخدم true للعمل بدون ميكروفون
const DEMO_MODE = true;

export default function ChatPage() {
  const { user } = useAuth();
  const { chats, loading: chatsLoading, createOrOpenChat } = useChat();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const { isMuted, toggleMute, playSentSound, testSound, playIncomingCallSound } = useNotificationSound();

  const selectedChat = chats.find((c) => c.id === selectedChatId);

  // الاستماع للمكالمات الواردة
  useEffect(() => {
    if (!user?.uid) return;

    const callsRef = collection(db, 'calls');
    const q = query(
      callsRef,
      where('receiverId', '==', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const callData = {
            id: change.doc.id,
            ...change.doc.data(),
          };
          console.log('📞 مكالمة واردة من:', (callData as any).callerName);
          setIncomingCall(callData);
          playIncomingCallSound();
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-gray-500">يرجى تسجيل الدخول</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
      {/* قائمة المحادثات */}
      <div className="w-full sm:w-96 lg:w-80 bg-white border-l border-gray-200 flex flex-col md:block hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">المحادثات</h2>
            <div className="flex gap-2">
              {/* زر اختبار الصوت */}
              <button
                onClick={testSound}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="اختبار الصوت"
              >
                <span className="text-lg">🔔</span>
              </button>

              {/* زر كتم/إلغاء كتم التنبيهات */}
              <button
                onClick={toggleMute}
                className={`p-2 rounded-lg transition-colors ${
                  isMuted
                    ? 'text-gray-400 hover:bg-gray-50'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
                title={isMuted ? 'إلغاء كتم التنبيهات' : 'كتم التنبيهات'}
              >
                {isMuted ? (
                  <SpeakerXMarkIcon className="h-6 w-6" />
                ) : (
                  <SpeakerWaveIcon className="h-6 w-6" />
                )}
              </button>

              {/* زر محادثة جديدة */}
              <button
                onClick={() => setShowNewChatModal(true)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <PlusIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="بحث في المحادثات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* قائمة المحادثات */}
        <div className="flex-1 overflow-y-auto">
          {chatsLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-gray-500 mb-2">لا توجد محادثات</p>
              <p className="text-sm text-gray-400">
                ابدأ محادثة جديدة من الزر أعلاه
              </p>
            </div>
          ) : (
            chats
              .filter((chat) => {
                if (!searchQuery) return true;
                const otherUser =
                  chat.participantsData[
                    chat.participants.find((p) => p !== user.uid) || ''
                  ];
                return otherUser?.displayName
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase());
              })
              .map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  currentUserId={user.uid}
                  isSelected={chat.id === selectedChatId}
                  onClick={() => setSelectedChatId(chat.id)}
                />
              ))
          )}
        </div>
      </div>

      {/* منطقة المحادثة */}
      <div className="flex-1 flex flex-col w-full">
        {selectedChat ? (
          <ChatWindow chat={selectedChat} currentUserId={user.uid} />
        ) : (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <UserCircleIcon className="h-16 sm:h-24 w-16 sm:w-24 text-gray-300 mx-auto mb-4" />
              <p className="text-sm sm:text-base text-gray-500">اختر محادثة للبدء</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition md:hidden"
              >
                محادثة جديدة
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal لإنشاء محادثة جديدة */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onSelectUser={async (selectedUser) => {
            try {
              const chatId = await createOrOpenChat(selectedUser);
              setSelectedChatId(chatId);
              setShowNewChatModal(false);
            } catch (err) {
              console.error('Error creating chat:', err);
              alert('فشل إنشاء المحادثة');
            }
          }}
        />
      )}

      {/* مكالمة واردة */}
      {incomingCall && (
        <IncomingCallNotification
          call={incomingCall}
          onAccept={() => {
            // فتح المحادثة وبدء المكالمة
            setSelectedChatId(incomingCall.chatId);
            setIncomingCall(null);
            // سيتم فتح مكون المكالمة من ChatWindow
          }}
          onReject={async () => {
            // رفض المكالمة
            try {
              const callDoc = doc(db, 'calls', incomingCall.id);
              await updateDoc(callDoc, {
                status: 'rejected',
                endedAt: serverTimestamp(),
              });
              setIncomingCall(null);
            } catch (error) {
              console.error('Error rejecting call:', error);
            }
          }}
        />
      )}
      </div>
    </div>
  );
}

// مكون عنصر في قائمة المحادثات
function ChatListItem({
  chat,
  currentUserId,
  isSelected,
  onClick,
}: {
  chat: Chat;
  currentUserId: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const otherUserId = chat.participants.find((p) => p !== currentUserId);
  const otherUser = otherUserId ? chat.participantsData[otherUserId] : null;
  const unreadCount = chat.unreadCount?.[currentUserId] || 0;

  if (!otherUser) return null;

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* صورة المستخدم */}
        <div className="relative">
          {otherUser.photoURL ? (
            <img
              src={otherUser.photoURL}
              alt={otherUser.displayName}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-white font-semibold">
                {otherUser.displayName.charAt(0)}
              </span>
            </div>
          )}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -left-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </div>
          )}
        </div>

        {/* معلومات المحادثة */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {otherUser.displayName}
              </h3>
              {chat.lastMessage && chat.lastMessage.timestamp && (
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(
                    typeof chat.lastMessage.timestamp.toDate === 'function'
                      ? chat.lastMessage.timestamp.toDate()
                      : new Date(chat.lastMessage.timestamp),
                    {
                      addSuffix: true,
                      locale: ar,
                    }
                  )}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">
              {chat.lastMessage?.text || 'لا توجد رسائل'}
            </p>
          </div>
      </div>
    </div>
  );
}

// مكون نافذة المحادثة
function ChatWindow({
  chat,
  currentUserId,
}: {
  chat: Chat;
  currentUserId: string;
}) {
  const { messages, loading, sendMessage } = useChatMessages(chat.id);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [incomingCallInChat, setIncomingCallInChat] = useState<any>(null);

  const otherUserId = chat.participants.find((p) => p !== currentUserId);
  const otherUser = otherUserId ? chat.participantsData[otherUserId] : null;
  const { user } = useAuth();
  const { playSentSound, playIncomingCallSound } = useNotificationSound();

  // الاستماع للمكالمات الواردة في هذه المحادثة
  useEffect(() => {
    if (!chat.id || !user?.uid) return;

    const callsRef = collection(db, 'calls');
    const q = query(
      callsRef,
      where('chatId', '==', chat.id),
      where('receiverId', '==', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const callData = {
            id: change.doc.id,
            ...change.doc.data(),
          };
          console.log('📞 مكالمة واردة في المحادثة من:', (callData as any).callerName);
          setIncomingCallInChat(callData);
          playIncomingCallSound();
        }
      });
    });

    return () => unsubscribe();
  }, [chat.id, user?.uid]);

  // حفظ call ID للمستقبل
  const [receiverCallId, setReceiverCallId] = useState<string | null>(null);
  
  useEffect(() => {
    if (incomingCallInChat?.id) {
      setReceiverCallId(incomingCallInChat.id);
    }
  }, [incomingCallInChat?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(messageText.trim());
      playSentSound(); // تشغيل صوت الإرسال
      setMessageText('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  // معالجة التسجيل الصوتي
  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsRecording(false);
    setIsUploading(true);

    try {
      // رفع التسجيل إلى Firebase Storage
      const fileName = `voice_${Date.now()}.webm`;
      const storageRef = ref(storage, `chat_audio/${chat.id}/${fileName}`);
      
      await uploadBytes(storageRef, audioBlob);
      const audioURL = await getDownloadURL(storageRef);

      // إرسال كرسالة صوتية
      await sendMessage('', 'audio' as any, audioURL, fileName);
      playSentSound(); // تشغيل صوت الإرسال
      
      alert('تم إرسال التسجيل الصوتي! ✅');
    } catch (error) {
      console.error('Error uploading audio:', error);
      alert('فشل رفع التسجيل الصوتي');
    } finally {
      setIsUploading(false);
    }
  };

  // بدء تسجيل صوتي
  const startVoiceRecording = () => {
    setIsRecording(true);
  };

  // إلغاء التسجيل
  const cancelRecording = () => {
    setIsRecording(false);
  };

  if (!otherUser || !user) return null;

  return (
    <>
      {/* مكالمة واردة في المحادثة */}
      {incomingCallInChat && !isInCall && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-8">
              <div className="animate-pulse rounded-full h-24 w-24 bg-green-500 mx-auto mb-4 flex items-center justify-center">
                <PhoneIconSolid className="h-12 w-12 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                📞 مكالمة واردة
              </h2>
              <p className="text-lg text-gray-700">
                من: <span className="font-semibold">{incomingCallInChat.callerName}</span>
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={async () => {
                  console.log('✅ قبول المكالمة');
                  try {
                    // تحديث حالة المكالمة في Firestore
                    const callDoc = doc(db, 'calls', incomingCallInChat.id);
                    await updateDoc(callDoc, {
                      status: 'ongoing',
                      startedAt: serverTimestamp(),
                    });
                    console.log('✅ تم تحديث حالة المكالمة إلى ongoing');
                    
                    // فتح واجهة المكالمة
                    setIsInCall(true);
                    setIncomingCallInChat(null);
                  } catch (error) {
                    console.error('❌ خطأ في قبول المكالمة:', error);
                    alert('فشل قبول المكالمة. حاول مرة أخرى.');
                  }
                }}
                className="flex-1 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 font-semibold text-lg"
              >
                <PhoneIconSolid className="h-6 w-6 inline-block ml-2" />
                رد
              </button>
              
              <button
                onClick={async () => {
                  console.log('❌ رفض المكالمة');
                  try {
                    const callDoc = doc(db, 'calls', incomingCallInChat.id);
                    await updateDoc(callDoc, {
                      status: 'rejected',
                      endedAt: serverTimestamp(),
                    });
                    console.log('✅ تم تحديث حالة المكالمة إلى rejected');
                    setIncomingCallInChat(null);
                  } catch (error) {
                    console.error('❌ خطأ في رفض المكالمة:', error);
                  }
                }}
                className="flex-1 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all transform hover:scale-105 font-semibold text-lg"
              >
                <PhoneXMarkIcon className="h-6 w-6 inline-block ml-2" />
                رفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مكون المكالمة الصوتية */}
      {isInCall && (
        DEMO_MODE ? (
          <DemoVoiceCall
            chatId={chat.id}
            callerId={user.uid}
            callerName={user.displayName || 'أنا'}
            receiverId={otherUserId!}
            receiverName={otherUser.displayName || 'المستخدم'}
            isInitiator={false}  // المستقبل - لأنه ضغط "رد" على مكالمة واردة
            existingCallId={receiverCallId || undefined}  // تمرير call ID للمستقبل
            onEnd={() => setIsInCall(false)}
          />
        ) : (
          <VoiceCall
            chatId={chat.id}
            callerId={user.uid}
            callerName={user.displayName || 'أنا'}
            receiverId={otherUserId!}
            receiverName={otherUser.displayName || 'المستخدم'}
            isInitiator={false}  // المستقبل - لأنه ضغط "رد" على مكالمة واردة
            onEnd={() => setIsInCall(false)}
          />
        )
      )}
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {otherUser.photoURL ? (
              <img
                src={otherUser.photoURL}
                alt={otherUser.displayName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-white font-semibold">
                  {otherUser.displayName.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">
                {otherUser.displayName}
              </h3>
              <p className="text-sm text-gray-500">
                {getRoleLabel(otherUser.role)} - {getDepartmentLabel(otherUser.department)}
              </p>
            </div>
          </div>

          {/* زر المكالمة الصوتية */}
          <button
            onClick={() => setIsInCall(true)}
            className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all transform hover:scale-110"
            title="مكالمة صوتية"
          >
            <PhoneIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* الرسائل */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">لا توجد رسائل. ابدأ المحادثة الآن!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === currentUserId}
            />
          ))
        )}
      </div>

      {/* نموذج الإرسال */}
      {isRecording ? (
        DEMO_MODE ? (
          <DemoVoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            onCancel={cancelRecording}
          />
        ) : (
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            onCancel={cancelRecording}
          />
        )
      ) : isUploading ? (
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">جاري رفع التسجيل...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-2">
            {/* زر التسجيل الصوتي */}
            <button
              type="button"
              onClick={startVoiceRecording}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="تسجيل صوتي"
            >
              <MicrophoneIcon className="h-6 w-6" />
            </button>

            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="اكتب رسالتك..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!messageText.trim() || sending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

// مكون فقاعة الرسالة
function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  return (
    <div className={`flex ${isOwn ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-md px-4 py-2 rounded-lg ${
          isOwn
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-900 border border-gray-200'
        }`}
      >
        {!isOwn && (
          <p className="text-xs font-semibold mb-1 opacity-75">
            {message.senderName}
          </p>
        )}

        {/* محتوى الرسالة */}
        {message.type === 'audio' && message.fileURL ? (
          <div className="my-2">
            <AudioPlayer audioUrl={message.fileURL} />
          </div>
        ) : message.type === 'image' && message.fileURL ? (
          <div className="my-2">
            <img
              src={message.fileURL}
              alt="صورة"
              className="max-w-sm rounded-lg"
            />
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        )}

        <p
          className={`text-xs mt-1 ${
            isOwn ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {message.createdAt &&
            formatDistanceToNow(
              typeof message.createdAt.toDate === 'function'
                ? message.createdAt.toDate()
                : new Date(message.createdAt),
              {
                addSuffix: true,
                locale: ar,
              }
            )}
        </p>
      </div>
    </div>
  );
}

// مكون Modal لإنشاء محادثة جديدة
function NewChatModal({
  onClose,
  onSelectUser,
}: {
  onClose: () => void;
  onSelectUser: (user: any) => void;
}) {
  const { allowedUsers, loading } = useAllowedChatUsers();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = allowedUsers.filter((user) =>
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            محادثة جديدة
          </h3>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="بحث عن موظف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* قائمة المستخدمين */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'لا توجد نتائج' : 'لا يوجد مستخدمين متاحين'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.uid}
                onClick={() => onSelectUser(user)}
                className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {user.displayName.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {user.displayName}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {getRoleLabel(user.role)} - {getDepartmentLabel(user.department)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// دوال مساعدة
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ceo: 'المدير التنفيذي',
    sales: 'مبيعات',
    sales_head: 'مدير المبيعات',
    design: 'مصمم',
    design_head: 'مدير التصميم',
    printing: 'طباعة',
    printing_head: 'مدير الطباعة',
    accounting: 'محاسب',
    accounting_head: 'مدير الحسابات',
    dispatch: 'إرسال',
    dispatch_head: 'مدير الإرسال',
  };
  return labels[role] || role;
}

function getDepartmentLabel(department: string): string {
  const labels: Record<string, string> = {
    management: 'الإدارة',
    sales: 'المبيعات',
    design: 'التصميم',
    printing: 'الطباعة',
    accounting: 'الحسابات',
    dispatch: 'الإرسال',
  };
  return labels[department] || department;
}

// مكون إشعار مكالمة واردة
function IncomingCallNotification({
  call,
  onAccept,
  onReject,
}: {
  call: any;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* أنيميشن المكالمة */}
        <div className="text-center mb-8">
          <div className="animate-pulse rounded-full h-24 w-24 bg-green-500 mx-auto mb-4 flex items-center justify-center">
            <PhoneIcon className="h-12 w-12 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            📞 مكالمة واردة
          </h2>
          <p className="text-lg text-gray-700">
            من: <span className="font-semibold">{call.callerName}</span>
          </p>
        </div>

        {/* أزرار الرد والرفض */}
        <div className="flex gap-4">
          <button
            onClick={onAccept}
            className="flex-1 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all transform hover:scale-105 font-semibold text-lg"
          >
            <PhoneIcon className="h-6 w-6 inline-block ml-2" />
            رد
          </button>
          
          <button
            onClick={onReject}
            className="flex-1 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all transform hover:scale-105 font-semibold text-lg"
          >
            <PhoneXMarkIcon className="h-6 w-6 inline-block ml-2" />
            رفض
          </button>
        </div>
      </div>
    </div>
  );
}

