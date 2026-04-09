import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Bell, Shield, Key, HelpCircle, ChevronRight, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Profile() {
  const user = auth.currentUser;
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setPhoneNumber(userDoc.data().phoneNumber || '');
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchUserData();
  }, [user]);

  const handleSignOut = () => {
    signOut(auth);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsEditing(true);
    try {
      await updateProfile(user, { displayName, photoURL });
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        photoURL,
        phoneNumber
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      toast.error('Failed to update profile');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black overflow-y-auto">
      <header className="px-6 pt-12 pb-4 sticky top-0 bg-black/80 backdrop-blur-xl z-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Settings</h1>
      </header>

      <div className="px-6 py-6">
        {/* Profile Card */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 flex flex-col items-center text-center mb-8">
          <Avatar className="w-24 h-24 border-4 border-black shadow-xl mb-4">
            <AvatarImage src={user?.photoURL || ''} />
            <AvatarFallback className="bg-zinc-800 text-zinc-300 text-3xl">
              {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          
          <h2 className="text-xl font-semibold text-white mb-1">
            {user?.displayName || 'User'}
          </h2>
          <p className="text-sm text-zinc-500 mb-1">
            {user?.email}
          </p>
          <p className="text-sm text-emerald-500/80 mb-6 font-medium">
            {phoneNumber || 'No mobile number'}
          </p>
          
          <Sheet>
            <SheetTrigger asChild>
              <button className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-full transition-colors">
                Edit Profile
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] bg-zinc-950 border-zinc-800 rounded-t-3xl text-white">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-white">Edit Profile</SheetTitle>
              </SheetHeader>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-zinc-400">Display Name</Label>
                  <Input 
                    id="name" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                    className="bg-zinc-900 border-zinc-800 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-zinc-400">Mobile Number</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)} 
                    className="bg-zinc-900 border-zinc-800 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="photo" className="text-zinc-400">Photo URL</Label>
                  <Input 
                    id="photo" 
                    value={photoURL} 
                    onChange={(e) => setPhotoURL(e.target.value)} 
                    className="bg-zinc-900 border-zinc-800 focus-visible:ring-emerald-500"
                  />
                </div>
                <button 
                  onClick={handleSaveProfile}
                  disabled={isEditing}
                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isEditing ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <><Check className="w-5 h-5" /> Save Changes</>}
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Settings List */}
        <div className="space-y-2 mb-8">
          <button className="w-full flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800/50 rounded-2xl transition-all active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
                <Bell className="w-5 h-5 text-blue-500" />
              </div>
              <span className="font-medium text-zinc-200">Notifications</span>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-600" />
          </button>

          <Sheet>
            <SheetTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800/50 rounded-2xl transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10">
                    <Shield className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="font-medium text-zinc-200">Privacy & Security</span>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] bg-zinc-950 border-zinc-800 rounded-t-3xl text-white overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Privacy & Security
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-6 text-zinc-300">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <h3 className="font-medium text-emerald-500 mb-2">End-to-End Encryption</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Your personal messages and calls to friends and family are built with end-to-end encryption concepts. No one outside of your chats, not even Aura, can read or listen to them.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-white">Data Protection</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl">
                      <div>
                        <p className="font-medium text-sm">Read Receipts</p>
                        <p className="text-xs text-zinc-500">Let others know when you've read their messages</p>
                      </div>
                      <div className="w-10 h-6 bg-emerald-500 rounded-full relative">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl">
                      <div>
                        <p className="font-medium text-sm">Last Seen</p>
                        <p className="text-xs text-zinc-500">Show when you were last active</p>
                      </div>
                      <div className="w-10 h-6 bg-emerald-500 rounded-full relative">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-white">Account Security</h3>
                  <button className="w-full text-left p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors">
                    <p className="font-medium text-sm">Two-Step Verification</p>
                    <p className="text-xs text-zinc-500">Add an extra layer of security</p>
                  </button>
                  <button className="w-full text-left p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors text-red-400">
                    <p className="font-medium text-sm">Delete Account</p>
                    <p className="text-xs text-red-500/70">Permanently delete your data</p>
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <button className="w-full flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800/50 rounded-2xl transition-all active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10">
                <Key className="w-5 h-5 text-amber-500" />
              </div>
              <span className="font-medium text-zinc-200">Account</span>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-600" />
          </button>

          <button className="w-full flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800/50 rounded-2xl transition-all active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10">
                <HelpCircle className="w-5 h-5 text-purple-500" />
              </div>
              <span className="font-medium text-zinc-200">Help & Support</span>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-600" />
          </button>
        </div>

        {/* Sign Out */}
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-medium bg-red-500/10 hover:bg-red-500/20 rounded-2xl transition-colors active:scale-[0.98]"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
