/**
 * Hook للتعامل مع نظام الشات
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  Timestamp,
  writeBatch,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Chat,
  Message,
  MessageType,
  MessageStatus,
  createChatId,
  getAllowedChatUsers,
} from '@/types/shared';
import { useNotificationSound } from './useNotificationSound';

export function useChat() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // جلب جميع المحادثات للمستخدم الحالي
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chatsData: Chat[] = [];
        snapshot.forEach((doc) => {
          chatsData.push({
            id: doc.id,
            ...doc.data(),
          } as Chat);
        });
        setChats(chatsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching chats:', err);
        setError('فشل تحميل المحادثات');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // إنشاء أو فتح محادثة مع مستخدم
  const createOrOpenChat = useCallback(
    async (otherUser: {
      uid: string;
      displayName: string;
      photoURL?: string;
      role: string;
      department: string;
      isHead: boolean;
    }) => {
      if (!user) throw new Error('User not authenticated');

      // إنشاء معرف المحادثة
      const chatId = createChatId(user.uid, otherUser.uid);

      try {
        // إنشاء معرف المحادثة
        const chatRef = doc(db, 'chats', chatId);

        console.log('Chat ID:', chatId);
        console.log('Current user:', user.uid, user.role, user.department, user.isHead);
        console.log('Other user:', otherUser.uid, otherUser.role, otherUser.department, otherUser.isHead);

        // إنشاء محادثة جديدة (أو استخدام الموجودة)
        // نستخدم setDoc مع merge: true لتجنب مشاكل الصلاحيات
        const newChat = {
          type: 'direct',
          participants: [user.uid, otherUser.uid],
          participantsData: {
            [user.uid]: {
              uid: user.uid,
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              role: user.role,
              department: user.department,
              isHead: user.isHead || false,
            },
            [otherUser.uid]: {
              uid: otherUser.uid,
              displayName: otherUser.displayName || '',
              photoURL: otherUser.photoURL || '',
              role: otherUser.role,
              department: otherUser.department,
              isHead: otherUser.isHead || false,
            },
          },
          unreadCount: {
            [user.uid]: 0,
            [otherUser.uid]: 0,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        };

        console.log('Creating chat...');

        // استخدام setDoc لإنشاء المحادثة (بدون merge)
        try {
          await setDoc(chatRef, newChat);
          console.log('Chat created successfully!');
        } catch (createError: any) {
          if (createError.code === 'permission-denied') {
            console.log('Create failed, chat might already exist or permission issue');
            console.log('Trying to verify chat existence...');
          } else {
            throw createError;
          }
        }

        return chatId;
      } catch (err: any) {
        console.error('Error creating/opening chat:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        throw new Error('فشل فتح المحادثة: ' + err.message);
      }
    },
    [user]
  );

  return {
    chats,
    loading,
    error,
    createOrOpenChat,
  };
}

/**
 * Hook لجلب رسائل محادثة معينة
 */
export function useChatMessages(chatId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playMessageSound, playVoiceMessageSound } = useNotificationSound();
  const isFirstLoadRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!chatId || !user?.uid) {
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messagesData: Message[] = [];
        snapshot.forEach((doc) => {
          messagesData.push({
            id: doc.id,
            ...doc.data(),
          } as Message);
        });

        // تشغيل صوت فقط للرسائل الجديدة من المستقبل
        if (!isFirstLoadRef.current && messagesData.length > 0) {
          const lastMessage = messagesData[messagesData.length - 1];
          
          // تحقق: رسالة جديدة + ليست من المستخدم الحالي + لم نشغّل صوتها من قبل
          if (
            lastMessage.id !== lastMessageIdRef.current &&
            lastMessage.senderId !== user.uid
          ) {
            console.log('🔔 تشغيل صوت للرسالة الجديدة من:', lastMessage.senderName);
            
            if (lastMessage.type === 'audio') {
              playVoiceMessageSound();
            } else {
              playMessageSound();
            }
          }
          
          // حفظ معرف آخر رسالة
          if (messagesData.length > 0) {
            lastMessageIdRef.current = messagesData[messagesData.length - 1].id;
          }
        }

        // بعد التحميل الأول، فعّل التنبيهات
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
          if (messagesData.length > 0) {
            lastMessageIdRef.current = messagesData[messagesData.length - 1].id;
          }
        }

        setMessages(messagesData);
        setLoading(false);

        // تحديث حالة القراءة
        markMessagesAsRead(chatId, messagesData, user.uid);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        setError('فشل تحميل الرسائل');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId, user?.uid]);

  // إرسال رسالة
  const sendMessage = useCallback(
    async (
      text: string,
      type: MessageType = MessageType.TEXT,
      fileURL?: string,
      fileName?: string,
      replyTo?: { messageId: string; text: string; senderName: string }
    ) => {
      if (!chatId || !user) throw new Error('Invalid chat or user');

      try {
        // إنشاء الرسالة بدون حقول undefined
        const newMessage: any = {
          chatId,
          senderId: user.uid,
          senderName: user.displayName,
          senderRole: user.role,
          type,
          status: 'sent',
          readBy: [user.uid],
          createdAt: serverTimestamp(),
        };

        // إضافة الحقول الاختيارية فقط إذا كانت موجودة
        if (user.photoURL) {
          newMessage.senderPhotoURL = user.photoURL;
        }
        
        if (type === 'text' && text) {
          newMessage.text = text;
        }
        
        if (fileURL) {
          newMessage.fileURL = fileURL;
        }
        
        if (fileName) {
          newMessage.fileName = fileName;
        }
        
        if (replyTo) {
          newMessage.replyTo = replyTo;
        }

        // إضافة الرسالة
        await addDoc(collection(db, 'chats', chatId, 'messages'), newMessage);

        // تحديث آخر رسالة في المحادثة
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          lastMessage: {
            text: type === 'text' ? text : `[${getMessageTypeLabel(type)}]`,
            senderId: user.uid,
            senderName: user.displayName,
            timestamp: serverTimestamp(),
            type,
          },
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error sending message:', err);
        throw new Error('فشل إرسال الرسالة');
      }
    },
    [chatId, user]
  );

  // تحديد الرسائل كمقروءة
  const markMessagesAsRead = async (
    chatId: string,
    messages: Message[],
    userId: string
  ) => {
    try {
      const batch = writeBatch(db);
      let hasUpdates = false;

      messages.forEach((message) => {
        if (
          message.senderId !== userId &&
          !message.readBy.includes(userId)
        ) {
          const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
          batch.update(messageRef, {
            readBy: [...message.readBy, userId],
            status: 'read',
          });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        await batch.commit();

        // تحديث عدد الرسائل غير المقروءة
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          [`unreadCount.${userId}`]: 0,
        });
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
  };
}

/**
 * Hook لجلب المستخدمين المسموح التواصل معهم
 */
export function useAllowedChatUsers() {
  const { user } = useAuth();
  const [allowedUsers, setAllowedUsers] = useState<
    Array<{
      uid: string;
      displayName: string;
      role: string;
      department: string;
      isHead: boolean;
      photoURL?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchAllowedUsers = async () => {
      try {
        // جلب جميع المستخدمين النشطين
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('isActive', '==', true));
        const snapshot = await getDocs(q);

        const allUsers = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        })) as any[];

        // تحديد المستخدمين المسموح التواصل معهم
        const allowed = getAllowedChatUsers(
          {
            uid: user.uid,
            role: user.role as any,
            department: user.department as any,
            isHead: user.isHead,
          },
          allUsers
        );

        setAllowedUsers(allowed as any);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching allowed users:', err);
        setLoading(false);
      }
    };

    fetchAllowedUsers();
  }, [user]);

  return {
    allowedUsers,
    loading,
  };
}

// دالة مساعدة للحصول على تسمية نوع الرسالة
function getMessageTypeLabel(type: MessageType): string {
  switch (type) {
    case 'image':
      return 'صورة';
    case 'file':
      return 'ملف';
    case 'audio':
      return 'تسجيل صوتي';
    default:
      return 'رسالة';
  }
}

