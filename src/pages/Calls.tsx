import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Phone, PhoneCall, PhoneMissed, Video, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface CallRecord {
  id: string;
  callerId: string;
  receiverId: string;
  status: string;
  type: string;
  createdAt: any;
  otherUser?: any;
}

export default function Calls() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('participants', 'array-contains', uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const callPromises = snapshot.docs.map(async (callDoc) => {
          const data = callDoc.data();
          const otherUserId = data.callerId === uid ? data.receiverId : data.callerId;
          
          let otherUser = null;
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              otherUser = userDoc.data();
            }
          }

          return {
            id: callDoc.id,
            ...data,
            otherUser
          } as CallRecord;
        });

        let resolvedCalls = await Promise.all(callPromises);
        resolvedCalls.sort((a, b) => {
          const timeA = a.createdAt?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || 0;
          return timeB - timeA;
        });

        setCalls(resolvedCalls);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'calls');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-xl z-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Calls</h1>
        
        <button className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-emerald-500 hover:bg-zinc-800 transition-colors">
          <PhoneCall className="w-5 h-5" />
        </button>
      </header>

      <ScrollArea className="flex-1 px-4">
        {loading ? (
          <div className="flex justify-center pt-10">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center pt-20 px-6">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No recent calls</h3>
            <p className="text-zinc-500 text-sm">Your recent voice and video calls will appear here.</p>
          </div>
        ) : (
          <div className="space-y-1 pb-20">
            {calls.map((call) => {
              const isOutgoing = call.callerId === auth.currentUser?.uid;
              const isMissed = call.status === 'missed' || (!isOutgoing && call.status === 'ringing'); // Simple mock logic for missed
              
              return (
                <div 
                  key={call.id}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-900 transition-colors cursor-pointer active:scale-[0.98]"
                >
                  <Avatar className="w-12 h-12 border border-zinc-800">
                    <AvatarImage src={call.otherUser?.photoURL} />
                    <AvatarFallback className="bg-zinc-800 text-zinc-300">
                      {call.otherUser?.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium truncate ${isMissed ? 'text-red-500' : 'text-white'}`}>
                      {call.otherUser?.displayName || 'Unknown'}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isMissed ? (
                        <PhoneMissed className="w-3.5 h-3.5 text-red-500" />
                      ) : isOutgoing ? (
                        <PhoneCall className="w-3.5 h-3.5 text-zinc-500 rotate-180" />
                      ) : (
                        <PhoneCall className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                      <span className="text-sm text-zinc-500 truncate capitalize">
                        {call.type} • {isMissed ? 'Missed' : isOutgoing ? 'Outgoing' : 'Incoming'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[13px] text-zinc-500 whitespace-nowrap">
                      {call.createdAt ? formatDistanceToNow(call.createdAt.toDate(), { addSuffix: false }).replace('about ', '') : 'Just now'}
                    </span>
                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-500 hover:bg-zinc-800 transition-colors">
                      {call.type === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
