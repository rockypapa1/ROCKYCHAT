import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Search, Plus, Phone, Video, MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: any;
  type: string;
  otherUser?: any;
}

export default function Chats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const chatPromises = snapshot.docs.map(async (chatDoc) => {
          const data = chatDoc.data();
          const otherUserId = data.participants.find((id: string) => id !== auth.currentUser?.uid);
          
          let otherUser = null;
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              otherUser = userDoc.data();
            }
          }

          return {
            id: chatDoc.id,
            ...data,
            otherUser
          } as Chat;
        });

        let resolvedChats = await Promise.all(chatPromises);
        // Sort by lastMessageTime descending
        resolvedChats.sort((a, b) => {
          const timeA = a.lastMessageTime?.toMillis() || 0;
          const timeB = b.lastMessageTime?.toMillis() || 0;
          return timeB - timeA;
        });

        setChats(resolvedChats);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'chats');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone.trim() || !auth.currentUser) return;

    try {
      // Find user by phone number
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('phoneNumber', '==', newChatPhone.trim()));
      
      const { getDocs } = await import('firebase/firestore');
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        alert('User not found with this mobile number');
        return;
      }

      const otherUser = querySnapshot.docs[0];
      
      if (otherUser.id === auth.currentUser.uid) {
        alert('You cannot chat with yourself');
        return;
      }

      // Check if chat already exists
      const existingChat = chats.find(c => c.participants.includes(otherUser.id));
      if (existingChat) {
        setIsNewChatOpen(false);
        navigate(`/chat/${existingChat.id}`);
        return;
      }

      // Create new chat
      const chatRef = doc(collection(db, 'chats'));
      await setDoc(chatRef, {
        participants: [auth.currentUser.uid, otherUser.id],
        type: 'direct',
        lastMessage: '',
        lastMessageTime: serverTimestamp()
      });

      setIsNewChatOpen(false);
      navigate(`/chat/${chatRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-xl z-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Chats</h1>
        
        <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
          <DialogTrigger asChild>
            <button className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-emerald-500 hover:bg-zinc-800 transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateChat} className="space-y-4 pt-4">
              <Input 
                placeholder="Enter mobile number..." 
                type="tel"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                className="bg-zinc-900 border-zinc-800 h-12 rounded-xl focus-visible:ring-emerald-500"
                required
              />
              <button 
                type="submit"
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-medium rounded-xl transition-colors"
              >
                Start Chat
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="px-6 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 bg-zinc-900 border-none rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        {loading ? (
          <div className="flex justify-center pt-10">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center pt-20 px-6">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No messages yet</h3>
            <p className="text-zinc-500 text-sm">Start a conversation by tapping the plus button above.</p>
          </div>
        ) : (
          <div className="space-y-1 pb-20">
            {chats.filter(c => c.otherUser?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())).map((chat) => (
              <div 
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-900 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <div className="relative">
                  <Avatar className="w-14 h-14 border border-zinc-800">
                    <AvatarImage src={chat.otherUser?.photoURL} />
                    <AvatarFallback className="bg-zinc-800 text-zinc-300">
                      {chat.otherUser?.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {chat.otherUser?.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-black rounded-full"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-white truncate pr-2">
                      {chat.otherUser?.displayName || 'Unknown User'}
                    </h3>
                    {chat.lastMessageTime && (
                      <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                        {formatDistanceToNow(chat.lastMessageTime.toDate(), { addSuffix: false }).replace('about ', '')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 truncate">
                    {chat.lastMessage || 'Started a conversation'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
