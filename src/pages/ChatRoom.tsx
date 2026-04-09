import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { ChevronLeft, Phone, Video, Info, Send, Plus, Image as ImageIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
  readBy: string[];
}

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    // Fetch chat details to get other user
    const fetchChatDetails = async () => {
      try {
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          const otherUserId = data.participants.find((id: string) => id !== auth.currentUser?.uid);
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              setOtherUser({ id: otherUserId, ...userDoc.data() });
            }
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
      }
    };

    fetchChatDetails();

    // Listen for messages
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        
        setMessages(msgs);
        setLoading(false);
        
        // Scroll to bottom
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !auth.currentUser) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const messageRef = doc(collection(db, `chats/${chatId}/messages`));
      await setDoc(messageRef, {
        chatId,
        senderId: auth.currentUser.uid,
        text: messageText,
        createdAt: serverTimestamp(),
        readBy: [auth.currentUser.uid]
      });

      // Update chat last message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: auth.currentUser.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
  };

  const handleCall = async (type: 'audio' | 'video') => {
    if (!auth.currentUser || !otherUser) return;
    try {
      const callRef = doc(collection(db, 'calls'));
      await setDoc(callRef, {
        participants: [auth.currentUser.uid, otherUser.id],
        callerId: auth.currentUser.uid,
        receiverId: otherUser.id,
        status: 'ringing',
        type,
        createdAt: serverTimestamp()
      });
      toast(`Calling ${otherUser.displayName}...`, { description: `${type === 'video' ? 'Video' : 'Audio'} call started.` });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'calls');
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-black border-x border-zinc-900 relative">
      {/* Header */}
      <header className="h-20 px-4 flex items-center justify-between bg-black/80 backdrop-blur-xl border-b border-zinc-900 z-10 pt-safe">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors -ml-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <Avatar className="w-10 h-10 border border-zinc-800">
                <AvatarImage src={otherUser?.photoURL} />
                <AvatarFallback className="bg-zinc-800 text-zinc-300">
                  {otherUser?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              {otherUser?.status === 'online' && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-black rounded-full"></div>
              )}
            </div>
            <div>
              <h2 className="font-medium text-white text-sm">
                {otherUser?.displayName || 'Loading...'}
              </h2>
              <p className="text-xs text-zinc-500">
                {otherUser?.status === 'online' ? 'Active now' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => handleCall('audio')} className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-500 hover:bg-zinc-900 transition-colors">
            <Phone className="w-5 h-5" />
          </button>
          <button onClick={() => handleCall('video')} className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-500 hover:bg-zinc-900 transition-colors">
            <Video className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-black"
      >
        {loading ? (
          <div className="flex justify-center pt-10">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={otherUser?.photoURL} />
                <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xl">
                  {otherUser?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              Say hi to {otherUser?.displayName?.split(' ')[0] || 'them'}
            </h3>
            <p className="text-zinc-500 text-sm">
              Messages are end-to-end encrypted.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            const showTime = index === 0 || 
              (msg.createdAt?.toMillis() - messages[index-1].createdAt?.toMillis() > 1000 * 60 * 30); // Show time if > 30 mins apart

            return (
              <div key={msg.id} className="flex flex-col">
                {showTime && msg.createdAt && (
                  <span className="text-[11px] text-zinc-600 text-center my-4 font-medium uppercase tracking-wider">
                    {format(msg.createdAt.toDate(), 'MMM d, h:mm a')}
                  </span>
                )}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                  <div 
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed ${
                      isMe 
                        ? 'bg-emerald-600 text-white rounded-br-sm' 
                        : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/80 backdrop-blur-xl border-t border-zinc-900 pb-safe">
        <form 
          onSubmit={handleSendMessage}
          className="flex items-end gap-2"
        >
          <button 
            type="button"
            className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-[15px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
            />
          </div>

          {newMessage.trim() ? (
            <button 
              type="submit"
              className="w-10 h-10 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center text-black hover:bg-emerald-400 transition-colors animate-in zoom-in duration-200"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          ) : (
            <button 
              type="button"
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
