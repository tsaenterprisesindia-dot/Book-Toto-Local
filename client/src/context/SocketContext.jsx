import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { socketBase } from '../api/config.js';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }
    const token = localStorage.getItem('btl_token');
    const { url, options } = socketBase();
    const s = io(url, { auth: { token }, ...options });
    socketRef.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user?.id]);

  return <SocketContext.Provider value={{ socket, socketRef }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
