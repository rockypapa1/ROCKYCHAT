import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { MessageCircle, Phone, User } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { NotificationListener } from './NotificationListener';
import { CallManager } from './CallManager';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function Layout() {
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const checkPhone = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (!data.phoneNumber) {
            // Show prompt after 1 second
            setTimeout(() => setNeedsPhone(true), 1000);
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    checkPhone();
  }, []);

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim() || !auth.currentUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        phoneNumber: phoneInput.trim()
      });
      setNeedsPhone(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-black border-x border-zinc-900 relative">
      <NotificationListener />
      <CallManager />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      
      <nav className="h-16 border-t border-zinc-900 bg-black/80 backdrop-blur-xl flex items-center justify-around px-6 pb-safe">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`
          }
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-[10px] font-medium tracking-wide">Chats</span>
        </NavLink>
        
        <NavLink 
          to="/calls" 
          className={({ isActive }) => 
            `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`
          }
        >
          <Phone className="w-6 h-6" />
          <span className="text-[10px] font-medium tracking-wide">Calls</span>
        </NavLink>
        
        <NavLink 
          to="/profile" 
          className={({ isActive }) => 
            `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`
          }
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium tracking-wide">Profile</span>
        </NavLink>
      </nav>
      <Toaster theme="dark" />

      {/* Mandatory Phone Number Prompt */}
      {needsPhone && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-2">Complete your profile</h2>
            <p className="text-sm text-zinc-400 mb-6">Please enter your mobile number to continue using Aura. This helps your friends find you.</p>
            
            <form onSubmit={handleSavePhone} className="space-y-4">
              <input
                type="tel"
                placeholder="Enter mobile number..."
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                required
              />
              <button 
                type="submit"
                disabled={isSaving || !phoneInput.trim()}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black font-medium rounded-xl transition-colors flex items-center justify-center"
              >
                {isSaving ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : 'Save & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
