import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Check, AlertCircle, TrendingUp, DollarSign, MapPin, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: 'new_deal' | 'status_change' | 'milestone' | 'urgent' | 'market_update';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  dealId?: string;
  metadata?: any;
}

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          setIsConnected(true);
          console.log('Connected to notification WebSocket');
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'notification') {
              handleNewNotification(data.notification);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        wsRef.current.onclose = () => {
          setIsConnected(false);
          console.log('Disconnected from notification WebSocket');
          // Attempt to reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        setIsConnected(false);
        // Retry connection after 3 seconds
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();
    
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  // Simulate real-time notifications for demo - DISABLED
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     const mockNotifications = [
  //       {
  //         type: 'new_deal' as const,
  //         title: 'New Deal Submission',
  //         message: '25-acre development opportunity in Atlanta Metro - $3.2M asking',
  //         priority: 'high' as const,
  //         dealId: 'deal_' + Date.now()
  //       },
  //       {
  //         type: 'status_change' as const,
  //         title: 'Deal Status Updated',
  //         message: 'Charlotte townhome project moved to "Under Contract"',
  //         priority: 'medium' as const,
  //         dealId: 'deal_' + Date.now()
  //       },
  //       {
  //         type: 'milestone' as const,
  //         title: 'Pipeline Milestone',
  //         message: 'Q3 pipeline value reached $250M - 25% ahead of target',
  //         priority: 'high' as const
  //       },
  //       {
  //         type: 'market_update' as const,
  //         title: 'Market Alert',
  //         message: 'Tampa Bay rental rates increased 8% - prime for BTR development',
  //         priority: 'medium' as const
  //       },
  //       {
  //         type: 'urgent' as const,
  //         title: 'Time Sensitive',
  //         message: 'Due diligence deadline approaching for Nashville deal (48 hours)',
  //         priority: 'urgent' as const,
  //         dealId: 'deal_urgent'
  //       }
  //     ];

  //     const randomNotification = mockNotifications[Math.floor(Math.random() * mockNotifications.length)];
      
  //     const notification: Notification = {
  //       id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  //       ...randomNotification,
  //       timestamp: new Date(),
  //       read: false,
  //       actionUrl: randomNotification.dealId ? `/deals/${randomNotification.dealId}` : undefined
  //     };

  //     handleNewNotification(notification);
  //   }, 15000); // Every 15 seconds for demo

  //   return () => clearInterval(interval);
  // }, []);

  const handleNewNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50 notifications
    setUnreadCount(prev => prev + 1);
    
    // Show toast for high priority notifications
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      toast({
        title: notification.title,
        description: notification.message,
        duration: 5000,
      });
    }

    // Play notification sound for urgent notifications
    if (notification.priority === 'urgent') {
      playNotificationSound();
    }
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAK...');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (browser restrictions)
      });
    } catch (error) {
      // Ignore audio errors
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const removeNotification = (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'new_deal':
        return <TrendingUp className="h-4 w-4" />;
      case 'status_change':
        return <Check className="h-4 w-4" />;
      case 'milestone':
        return <DollarSign className="h-4 w-4" />;
      case 'market_update':
        return <MapPin className="h-4 w-4" />;
      case 'urgent':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-catalyst-gray-400';
    }
  };

  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'new_deal':
        return 'New Deal';
      case 'status_change':
        return 'Status Update';
      case 'milestone':
        return 'Milestone';
      case 'market_update':
        return 'Market Alert';
      case 'urgent':
        return 'Urgent';
      default:
        return 'Notification';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2"
        data-testid="button-notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs animate-pulse"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
        
        {/* Connection Status Indicator */}
        <div className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`} />
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 md:w-96 sm:w-80 xs:w-72 bg-white border border-catalyst-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden hidden md:block">
          {/* Header */}
          <div className="p-4 border-b border-catalyst-gray-200 bg-catalyst-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-catalyst-navy" />
                <h3 className="font-semibold text-catalyst-navy">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge className="bg-catalyst-gold text-white">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-catalyst-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-catalyst-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-catalyst-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50 border-l-4 border-l-catalyst-gold' : ''
                    }`}
                    onClick={() => {
                      markAsRead(notification.id);
                      if (notification.actionUrl) {
                        window.location.href = notification.actionUrl;
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${getPriorityColor(notification.priority)} text-white`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {getTypeLabel(notification.type)}
                          </Badge>
                          <span className="text-xs text-catalyst-gray-500">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                        </div>
                        
                        <h4 className={`text-sm font-medium mb-1 ${
                          !notification.read ? 'text-catalyst-navy' : 'text-catalyst-gray-700'
                        }`}>
                          {notification.title}
                        </h4>
                        
                        <p className="text-sm text-catalyst-gray-600 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-catalyst-gray-200 bg-catalyst-gray-50">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-center text-catalyst-navy hover:text-catalyst-gold"
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to notifications page
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}