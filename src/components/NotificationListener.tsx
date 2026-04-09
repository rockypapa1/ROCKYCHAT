import { useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';

export function NotificationListener() {
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Listen to chats for new messages
    const chatsQ = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
    const unsubChats = onSnapshot(chatsQ, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const data = change.doc.data();
          if (data.lastMessageSenderId && data.lastMessageSenderId !== uid) {
             const timeDiff = Date.now() - (data.lastMessageTime?.toMillis() || 0);
             // Only toast if the message is recent (within 5 seconds) to avoid old toasts on load
             if (timeDiff < 5000) {
               toast('New Message', { description: data.lastMessage });
             }
          }
        }
      });
    });

    // Listen to calls
    const callsQ = query(collection(db, 'calls'), where('participants', 'array-contains', uid));
    const unsubCalls = onSnapshot(callsQ, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
           const data = change.doc.data();
           if (data.receiverId === uid && data.status === 'missed') {
             const timeDiff = Date.now() - (data.createdAt?.toMillis() || 0);
             if (timeDiff < 10000) {
               toast('Missed Call', { 
                 description: 'You missed a call.', 
               });
             }
           }
        }
      });
    });

    return () => {
      unsubChats();
      unsubCalls();
    };
  }, []);

  return null;
}
