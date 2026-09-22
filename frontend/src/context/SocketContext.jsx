import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to server (using the environment variable VITE_API_URL if configured, otherwise fallback to localhost)
    const socketUrl = import.meta.env.VITE_API_URL || (window.location.origin.includes('localhost') ? 'http://localhost:5000' : window.location.origin);
    const socketConn = io(socketUrl, {
      auth: { token },
    });

    socketConn.on('connect', () => {
      console.log('[Socket] Connected to server.');
      // CR joins their specific room, Admins join dashboard
      if (user?.role === 'CR' && user.className) {
        socketConn.emit('join_room', `class:${user.className}`);
      } else if (user?.role === 'HOD' || user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN') {
        socketConn.emit('join_room', 'dashboard');
      }
    });

    socketConn.on('online_users_update', (data) => {
      setOnlineCount(data.count);
      setOnlineUsers(data.users);
    });

    socketConn.on('new_notification', (notif) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 50)); // Keep last 50 notifications
    });

    setSocket(socketConn);

    return () => {
      socketConn.disconnect();
    };
  }, [token, user]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  const value = {
    socket,
    onlineCount,
    onlineUsers,
    notifications,
    clearNotifications,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
