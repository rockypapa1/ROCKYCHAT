import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';

// Pages
import Login from './pages/Login';
import Chats from './pages/Chats';
import ChatRoom from './pages/ChatRoom';
import Calls from './pages/Calls';
import Profile from './pages/Profile';
import Layout from './components/Layout';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Test connection
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Ensure user document exists
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'User',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
            lastSeen: serverTimestamp(),
            status: 'online'
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        <Route element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Chats />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        
        <Route path="/chat/:chatId" element={user ? <ChatRoom /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
