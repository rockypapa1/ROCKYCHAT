import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export function CallManager() {
  const [activeCall, setActiveCall] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const unsubscribes = useRef<(() => void)[]>([]);

  const cleanupCall = () => {
    unsubscribes.current.forEach(unsub => unsub());
    unsubscribes.current = [];
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setOtherUser(null);
    setCallDuration(0);
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const callsQ = query(collection(db, 'calls'), where('participants', 'array-contains', uid));
    const unsubCalls = onSnapshot(callsQ, async (snapshot) => {
      let currentCall = null;
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        if (data.status === 'ringing' || data.status === 'active') {
          currentCall = { id: docSnapshot.id, ...data };
          break;
        }
      }

      if (currentCall) {
        setActiveCall(prev => {
          // Only update if it's a new call or status changed to avoid re-triggering setup
          if (!prev || prev.id !== currentCall.id || prev.status !== currentCall.status) {
            return currentCall;
          }
          return prev;
        });
        
        const otherUserId = currentCall.callerId === uid ? currentCall.receiverId : currentCall.callerId;
        try {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
            setOtherUser(userDoc.data());
          }
        } catch (error) {
          console.error(error);
        }
      } else {
        cleanupCall();
      }
    });

    return () => {
      unsubCalls();
      cleanupCall();
    };
  }, []);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall]);

  const requestMedia = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      setLocalStream(stream);
      setIsVideoOff(type === 'audio');
      return stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
      alert('Microphone/Camera permission is required for calls. Please allow access in your browser settings.');
      return null;
    }
  };

  // Caller Setup
  useEffect(() => {
    const setupCaller = async () => {
      if (!activeCall || !auth.currentUser) return;
      const isCaller = activeCall.callerId === auth.currentUser.uid;
      
      if (isCaller && activeCall.status === 'ringing' && !pcRef.current) {
        const stream = await requestMedia(activeCall.type);
        if (!stream) {
          handleDeclineOrEnd();
          return;
        }

        const pc = new RTCPeerConnection(servers);
        pcRef.current = pc;

        const remote = new MediaStream();
        setRemoteStream(remote);

        pc.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remote.addTrack(track);
          });
        };

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        const callDocRef = doc(db, 'calls', activeCall.id);
        const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
        const answerCandidatesRef = collection(callDocRef, 'answerCandidates');

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            addDoc(offerCandidatesRef, event.candidate.toJSON());
          }
        };

        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        };

        await updateDoc(callDocRef, { offer });

        const unsubAnswer = onSnapshot(callDocRef, (snapshot) => {
          const data = snapshot.data();
          if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
          }
        });
        unsubscribes.current.push(unsubAnswer);

        const unsubCandidates = onSnapshot(answerCandidatesRef, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate);
            }
          });
        });
        unsubscribes.current.push(unsubCandidates);
      }
    };

    setupCaller();
  }, [activeCall]);

  const handleAccept = async () => {
    if (!activeCall || !auth.currentUser) return;
    
    const stream = await requestMedia(activeCall.type);
    if (!stream) return;

    const pc = new RTCPeerConnection(servers);
    pcRef.current = pc;

    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remote.addTrack(track);
      });
    };

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const callDocRef = doc(db, 'calls', activeCall.id);
    const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
    const answerCandidatesRef = collection(callDocRef, 'answerCandidates');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidatesRef, event.candidate.toJSON());
      }
    };

    const callData = (await getDoc(callDocRef)).data();
    const offerDescription = callData?.offer;
    if (offerDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    }

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(callDocRef, { answer, status: 'active' });

    const unsubCandidates = onSnapshot(offerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
    unsubscribes.current.push(unsubCandidates);
  };

  const handleDeclineOrEnd = async () => {
    if (!activeCall) return;
    try {
      await updateDoc(doc(db, 'calls', activeCall.id), {
        status: activeCall.status === 'ringing' ? 'missed' : 'ended'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${activeCall.id}`);
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCall?.status === 'active') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeCall) return null;

  const isIncoming = activeCall.status === 'ringing' && activeCall.receiverId === auth.currentUser?.uid;
  const isOutgoing = activeCall.status === 'ringing' && activeCall.callerId === auth.currentUser?.uid;
  const isActive = activeCall.status === 'active';

  return (
    <div className="absolute inset-0 z-[100] bg-zinc-950 flex flex-col">
      {/* Remote Audio/Video */}
      <video 
        ref={remoteVideoRef}
        autoPlay 
        playsInline 
        className={activeCall.type === 'video' && isActive ? "absolute inset-0 w-full h-full object-cover bg-zinc-900" : "opacity-0 w-0 h-0 absolute"}
      />

      {/* Local Video (PiP) */}
      {activeCall.type === 'video' && localStream && !isVideoOff && (
        <div className={`absolute z-20 overflow-hidden border-2 border-zinc-800 shadow-xl bg-black rounded-xl transition-all duration-500 ${isActive ? 'bottom-32 right-6 w-28 h-40' : 'inset-0 w-full h-full border-none rounded-none opacity-50'}`}>
          <video 
            ref={localVideoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Overlay Content */}
      <div className="relative z-30 flex-1 flex flex-col items-center justify-between py-20 px-6 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none">
        
        {/* Header Info */}
        <div className="flex flex-col items-center text-center space-y-6 mt-10 pointer-events-auto">
          {(!isActive || activeCall.type === 'audio') && (
            <Avatar className="w-32 h-32 border-4 border-zinc-800 shadow-2xl">
              <AvatarImage src={otherUser?.photoURL} />
              <AvatarFallback className="bg-zinc-800 text-zinc-300 text-4xl">
                {otherUser?.displayName?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          )}
          
          <div>
            <h2 className="text-3xl font-semibold text-white mb-2 drop-shadow-md">
              {otherUser?.displayName || 'Unknown'}
            </h2>
            <p className="text-zinc-300 text-lg drop-shadow-md">
              {isIncoming ? `Incoming ${activeCall.type} call...` : 
               isOutgoing ? `Calling...` : 
               formatDuration(callDuration)}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full max-w-xs mx-auto flex items-center justify-center gap-6 pointer-events-auto">
          {isIncoming ? (
            <>
              <button 
                onClick={handleDeclineOrEnd}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20 transition-transform active:scale-95"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
              <button 
                onClick={handleAccept}
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 animate-bounce"
              >
                {activeCall.type === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white text-black' : 'bg-zinc-800/80 text-white hover:bg-zinc-700 backdrop-blur-md'}`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <button 
                onClick={handleDeclineOrEnd}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20 transition-transform active:scale-95"
              >
                <PhoneOff className="w-8 h-8" />
              </button>

              {activeCall.type === 'video' && (
                <button 
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-white text-black' : 'bg-zinc-800/80 text-white hover:bg-zinc-700 backdrop-blur-md'}`}
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
