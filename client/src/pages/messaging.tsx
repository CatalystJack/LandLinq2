import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { MessageSquare, Send, User, Clock, Pencil, Check, CheckCheck, AlertCircle, Search, Phone, Mail, MapPin, ExternalLink, Trash2, UserCog, Link2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface ConversationMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  messageType: 'manual' | 'automated';
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed';
  deliveryError?: string | null;
  twilioMessageSid?: string | null;
  sentByUserId?: string | null;
  createdAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
}

interface Conversation {
  id: string;
  brokerId: string;
  status: 'active' | 'archived';
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  broker: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
}

type FilterType = 'all' | 'unread' | 'read';

export default function MessagingPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [urlConversationHandled, setUrlConversationHandled] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editProfileDialogOpen, setEditProfileDialogOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBrokerage, setEditBrokerage] = useState("");
  const [editMarkets, setEditMarkets] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [deleteConversationConfirmOpen, setDeleteConversationConfirmOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSearchQuery, setMergeSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{id: string; firstName: string; lastName: string; email: string | null; phone: string | null}>>([]);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ConversationMessage[]>({
    queryKey: ["/api/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedConversationId) throw new Error("No conversation selected");
      return await apiRequest("POST", `/api/conversations/${selectedConversationId}/messages`, { body });
    },
    onSuccess: () => {
      setMessageBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return await apiRequest("PATCH", `/api/conversations/${conversationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const updateBrokerNameMutation = useMutation({
    mutationFn: async ({ brokerId, firstName, lastName }: { brokerId: string; firstName: string; lastName: string }) => {
      return await apiRequest("PUT", `/api/brokers/${brokerId}`, { firstName, lastName });
    },
    onSuccess: async (updatedBroker) => {
      // Invalidate to mark as stale
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      
      // Force refetch with explicit wait
      await queryClient.refetchQueries({ 
        queryKey: ["/api/conversations"],
        type: 'active'
      });
      
      setEditNameDialogOpen(false);
      toast({
        title: "Name updated",
        description: "Broker name has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update name",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateBrokerProfileMutation = useMutation({
    mutationFn: async ({ brokerId, updates }: { brokerId: string; updates: any }) => {
      return await apiRequest("PUT", `/api/brokers/${brokerId}`, updates);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brokers"] });
      
      await queryClient.refetchQueries({ 
        queryKey: ["/api/conversations"],
        type: 'active'
      });
      
      setEditProfileDialogOpen(false);
      toast({
        title: "Profile updated",
        description: "Broker profile has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!selectedConversationId) throw new Error("No conversation selected");
      return await apiRequest("DELETE", `/api/conversations/${selectedConversationId}/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversationId, "messages"] });
      setDeleteConfirmOpen(false);
      setDeleteMessageId(null);
      toast({
        title: "Message deleted",
        description: "The message has been removed from this conversation",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return await apiRequest("DELETE", `/api/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setDeleteConversationConfirmOpen(false);
      setDeleteConversationId(null);
      setSelectedConversationId(null);
      toast({
        title: "Conversation deleted",
        description: "The conversation and all messages have been removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete conversation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const mergeBrokersMutation = useMutation({
    mutationFn: async ({ sourceBrokerId, targetBrokerId }: { sourceBrokerId: string; targetBrokerId: string }) => {
      return await apiRequest("POST", "/api/brokers/merge", { sourceBrokerId, targetBrokerId });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brokers"] });
      setMergeDialogOpen(false);
      setMergeSearchQuery("");
      setSearchResults([]);
      setSelectedMergeTarget(null);
      setSelectedConversationId(null);
      toast({
        title: "Brokers merged successfully",
        description: `Merged ${data.mergedDeals || 0} deals, ${data.mergedConversations || 0} conversations, and ${data.mergedCommunications || 0} communications`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to merge brokers",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Handle deep linking from analyst dashboard - auto-select conversation from URL params
  useEffect(() => {
    if (urlConversationHandled || conversationsLoading) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const conversationIdFromUrl = urlParams.get('conversationId');
    
    if (conversationIdFromUrl && conversations.length > 0) {
      // Verify the conversation exists
      const targetConversation = conversations.find(c => c.id === conversationIdFromUrl);
      if (targetConversation) {
        setSelectedConversationId(conversationIdFromUrl);
        // Clear the URL param to prevent re-selection on refresh
        window.history.replaceState({}, '', '/messaging');
      }
      setUrlConversationHandled(true);
    } else if (!conversationIdFromUrl) {
      setUrlConversationHandled(true);
    }
  }, [conversationsLoading, conversations, urlConversationHandled]);

  useEffect(() => {
    const searchBrokers = async () => {
      if (mergeSearchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      
      const currentConversation = conversations.find(c => c.id === selectedConversationId);
      const excludeId = currentConversation?.brokerId || '';
      
      try {
        const response = await fetch(`/api/brokers/search?query=${encodeURIComponent(mergeSearchQuery)}&excludeId=${excludeId}`);
        if (response.ok) {
          const results = await response.json();
          setSearchResults(results);
        }
      } catch (error) {
        console.error('Error searching brokers:', error);
      }
    };
    
    const debounceTimer = setTimeout(searchBrokers, 300);
    return () => clearTimeout(debounceTimer);
  }, [mergeSearchQuery, selectedConversationId, conversations]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[MESSAGING] WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notification' && data.notification?.type === 'new_message') {
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          
          if (data.notification.conversationId === selectedConversationId) {
            queryClient.invalidateQueries({ 
              queryKey: ["/api/conversations", selectedConversationId, "messages"] 
            });
          }
          
          if (data.notification.message?.direction === 'inbound') {
            toast({
              title: "New message received",
              description: "A broker sent you a message",
            });
          }
        }
      } catch (error) {
        console.error('[MESSAGING] Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[MESSAGING] WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('[MESSAGING] WebSocket closed');
    };
    
    wsRef.current = ws;
    
    return () => {
      ws.close();
    };
  }, [selectedConversationId, toast]);

  // Auto-scroll to show last message while keeping it visible
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, [messages, selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId) {
      const conversation = conversations.find(c => c.id === selectedConversationId);
      if (conversation && conversation.unreadCount > 0) {
        markAsReadMutation.mutate(selectedConversationId);
      }
    }
  }, [selectedConversationId, conversations]);

  const handleSendMessage = () => {
    if (!messageBody.trim() || !selectedConversationId) return;
    sendMessageMutation.mutate(messageBody);
  };

  const handleOpenEditDialog = () => {
    if (selectedConversation) {
      setEditFirstName(selectedConversation.broker.firstName || "");
      setEditLastName(selectedConversation.broker.lastName || "");
      setEditNameDialogOpen(true);
    }
  };

  const handleSaveEditName = () => {
    if (!selectedConversation) return;
    if (!editFirstName.trim()) {
      toast({
        title: "First name required",
        description: "Please enter a first name",
        variant: "destructive",
      });
      return;
    }
    updateBrokerNameMutation.mutate({
      brokerId: selectedConversation.brokerId,
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    setDeleteMessageId(messageId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteMessage = () => {
    if (deleteMessageId) {
      deleteMessageMutation.mutate(deleteMessageId);
    }
  };

  const handleDeleteConversation = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConversationId(conversationId);
    setDeleteConversationConfirmOpen(true);
  };

  const confirmDeleteConversation = () => {
    if (deleteConversationId) {
      deleteConversationMutation.mutate(deleteConversationId);
    }
  };

  const handleOpenEditProfileDialog = async () => {
    if (selectedConversation) {
      // Fetch full broker details
      try {
        const response = await fetch(`/api/brokers/${selectedConversation.brokerId}`);
        if (response.ok) {
          const brokerData = await response.json();
          setEditFirstName(brokerData.firstName || "");
          setEditLastName(brokerData.lastName || "");
          setEditPhone(brokerData.phone || "");
          setEditEmail(brokerData.email || "");
          setEditBrokerage(brokerData.brokerage || "");
          setEditMarkets(brokerData.marketsCovered?.join(", ") || "");
        } else {
          // Fallback to conversation data
          setEditFirstName(selectedConversation.broker.firstName || "");
          setEditLastName(selectedConversation.broker.lastName || "");
          setEditPhone(selectedConversation.broker.phone || "");
          setEditEmail(selectedConversation.broker.email || "");
          setEditBrokerage("");
          setEditMarkets("");
        }
      } catch (error) {
        // Fallback to conversation data
        setEditFirstName(selectedConversation.broker.firstName || "");
        setEditLastName(selectedConversation.broker.lastName || "");
        setEditPhone(selectedConversation.broker.phone || "");
        setEditEmail(selectedConversation.broker.email || "");
        setEditBrokerage("");
        setEditMarkets("");
      }
      setEditProfileDialogOpen(true);
    }
  };

  const handleSaveProfile = () => {
    if (!selectedConversation) return;
    if (!editFirstName.trim()) {
      toast({
        title: "First name required",
        description: "Please enter a first name",
        variant: "destructive",
      });
      return;
    }
    
    // Parse markets from comma-separated string
    const marketsArray = editMarkets
      .split(",")
      .map(m => m.trim())
      .filter(m => m.length > 0);
    
    updateBrokerProfileMutation.mutate({
      brokerId: selectedConversation.brokerId,
      updates: {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
        brokerage: editBrokerage.trim() || undefined,
        marketsCovered: marketsArray.length > 0 ? marketsArray : undefined,
      },
    });
  };

  const handleOpenMergeDialog = () => {
    setMergeSearchQuery("");
    setSearchResults([]);
    setSelectedMergeTarget(null);
    setMergeDialogOpen(true);
  };

  const handleMergeBrokers = () => {
    if (!selectedConversation || !selectedMergeTarget) return;
    
    mergeBrokersMutation.mutate({
      sourceBrokerId: selectedConversation.brokerId,
      targetBrokerId: selectedMergeTarget,
    });
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  
  // Filter and search conversations
  const filteredConversations = conversations.filter(conversation => {
    // Apply search filter
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${conversation.broker.firstName} ${conversation.broker.lastName}`.toLowerCase();
    const phone = conversation.broker.phone?.toLowerCase() || '';
    const email = conversation.broker.email?.toLowerCase() || '';
    
    const matchesSearch = !searchQuery || 
      fullName.includes(searchLower) || 
      phone.includes(searchLower) || 
      email.includes(searchLower);
    
    if (!matchesSearch) return false;
    
    // Apply unread/read filter
    if (activeFilter === 'unread') {
      return conversation.unreadCount > 0;
    } else if (activeFilter === 'read') {
      return conversation.unreadCount === 0;
    }
    
    return true; // 'all' filter
  });
  
  // Count conversations by filter type
  const unreadCount = conversations.filter(c => c.unreadCount > 0).length;
  const readCount = conversations.filter(c => c.unreadCount === 0).length;
  
  // Get last message for conversation preview
  const getLastMessage = (conversationId: string) => {
    const conversationMessages = messages.filter(m => m.conversationId === conversationId);
    return conversationMessages[conversationMessages.length - 1];
  };

  // Get initials from name
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  // Format phone number for display (E.164 → (XXX) XXX-XXXX)
  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    // Check if it's a US number (10 or 11 digits)
    if (cleaned.length === 11 && cleaned[0] === '1') {
      // Remove leading 1
      const number = cleaned.slice(1);
      return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    // Return as-is if not a standard format
    return phone;
  };

  // Get display name - use phone number if name is "SMS User" or missing
  const getDisplayName = (broker: any): string => {
    const fullName = `${broker.firstName || ''} ${broker.lastName || ''}`.trim();
    
    // Check if name is "SMS User" or empty
    if (fullName === 'SMS User' || !fullName || fullName === 'User') {
      return formatPhoneNumber(broker.phone) || 'Unknown';
    }
    
    return fullName;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="page-messaging">
      <Navigation />
      
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12">
          {/* Left Sidebar - Conversations */}
          <div className="lg:col-span-3 bg-white lg:border-r border-gray-200 flex flex-col" data-testid="sidebar-conversations">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Conversations</h2>
              
              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-50 border-gray-200 text-sm h-9"
                  data-testid="input-search-conversations"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`flex-1 h-9 text-xs font-medium rounded-lg transition-all ${
                    activeFilter === 'all' 
                      ? 'bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2]' 
                      : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-[#4A90E2] hover:text-[#4A90E2]'
                  }`}
                  data-testid="button-filter-all"
                >
                  ALL ({conversations.length})
                </button>
                <button
                  onClick={() => setActiveFilter('unread')}
                  className={`flex-1 h-9 text-xs font-medium rounded-lg transition-all ${
                    activeFilter === 'unread' 
                      ? 'bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2]' 
                      : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-[#4A90E2] hover:text-[#4A90E2]'
                  }`}
                  data-testid="button-filter-unread"
                >
                  UNREAD ({unreadCount})
                </button>
                <button
                  onClick={() => setActiveFilter('read')}
                  className={`flex-1 h-9 text-xs font-medium rounded-lg transition-all ${
                    activeFilter === 'read' 
                      ? 'bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2]' 
                      : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-[#4A90E2] hover:text-[#4A90E2]'
                  }`}
                  data-testid="button-filter-read"
                >
                  READ ({readCount})
                </button>
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto" data-testid="container-conversations">
              {conversationsLoading ? (
                <div className="flex items-center justify-center h-32" data-testid="spinner-conversations-loading">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-catalyst-gold"></div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 px-4" data-testid="text-no-conversations">
                  <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                  </p>
                </div>
              ) : (
                <div>
                  {filteredConversations.map((conversation) => {
                    const initials = getInitials(conversation.broker.firstName, conversation.broker.lastName);
                    return (
                      <div
                        key={conversation.id}
                        className={`relative group w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedConversationId === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                        onClick={() => setSelectedConversationId(conversation.id)}
                        data-testid={`button-conversation-${conversation.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 relative">
                            <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                              {initials}
                            </div>
                            {conversation.unreadCount > 0 && (
                              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" data-testid={`badge-unread-${conversation.id}`}>
                                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <h3 className={`text-sm font-medium truncate ${conversation.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-700'}`} data-testid={`text-broker-name-${conversation.id}`}>
                                {getDisplayName(conversation.broker)}
                              </h3>
                              <div className="flex items-center gap-1">
                                {conversation.lastMessageAt && (
                                  <span className="text-xs text-gray-500 flex-shrink-0" data-testid={`text-last-message-time-${conversation.id}`}>
                                    {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => handleDeleteConversation(conversation.id, e)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                  title="Delete conversation"
                                  data-testid={`button-delete-conversation-${conversation.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {formatPhoneNumber(conversation.broker.phone)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Main Message Area */}
          <div className="flex-1 lg:col-span-9 bg-white flex flex-col" data-testid="card-message-thread">
            {selectedConversation ? (
              <>
                {/* Message Header with Broker Profile */}
                <div className="border-b border-gray-200" data-testid="header-conversation">
                  {/* Top Row - Name and Actions */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center text-white font-medium text-base">
                        {getInitials(selectedConversation.broker.firstName, selectedConversation.broker.lastName)}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900" data-testid="text-selected-broker-name">
                          {selectedConversation.broker.firstName} {selectedConversation.broker.lastName}
                        </h3>
                        <p className="text-xs text-gray-500">Broker</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2] rounded-lg h-9 px-4 text-sm font-medium uppercase transition-all flex items-center"
                        data-testid="button-see-broker-profile"
                        onClick={() => setLocation(`/broker-management?brokerId=${selectedConversation.brokerId}`)}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        See Full Profile
                      </button>
                      <button
                        onClick={handleOpenEditProfileDialog}
                        className="bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2] rounded-lg h-9 px-4 text-sm font-medium uppercase transition-all flex items-center"
                        data-testid="button-edit-broker-profile"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit Profile
                      </button>
                    </div>
                  </div>

                  {/* Broker Profile Details */}
                  <div className="px-4 pb-4 grid grid-cols-2 gap-3" data-testid="panel-broker-profile">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm text-gray-900 truncate" data-testid="text-broker-phone">
                          {formatPhoneNumber(selectedConversation.broker.phone)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm text-gray-900 truncate" data-testid="text-broker-email">
                          {selectedConversation.broker.email?.includes('@temp.landlinq.ai') 
                            ? <span className="text-gray-400 italic">Not provided</span>
                            : (selectedConversation.broker.email || <span className="text-gray-400 italic">Not provided</span>)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Broker ID</p>
                        <p className="text-sm text-gray-900 font-mono truncate" data-testid="text-broker-id">
                          {selectedConversation.brokerId.slice(0, 8)}...
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Status</p>
                        <Badge 
                          variant={selectedConversation.status === 'active' ? 'default' : 'secondary'} 
                          className="text-xs"
                          data-testid="badge-conversation-status"
                        >
                          {selectedConversation.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages Area - iMessage-like: newest at bottom, scroll up for history */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col" data-testid="container-messages">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-32" data-testid="spinner-messages-loading">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400" data-testid="text-no-messages">
                      <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                      <p className="text-sm">No messages yet</p>
                      <p className="text-xs mt-1">Send a message to start the conversation</p>
                    </div>
                  ) : (
                    <>
                      {/* Spacer to push messages to bottom when few messages */}
                      <div className="flex-1" />
                      {/* Messages list */}
                      <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'} mb-2 group`}
                          data-testid={`container-message-${message.id}`}
                        >
                          <div className={`flex items-start gap-2 max-w-[65%] ${message.direction === 'outbound' ? 'flex-row-reverse' : ''}`}>
                            <div className="flex flex-col items-end">
                              <div
                                className={`rounded-lg px-4 py-2.5 ${
                                  message.direction === 'outbound'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-600 text-white'
                                }`}
                                data-testid={`bubble-message-${message.id}`}
                              >
                                <p className="text-sm whitespace-pre-wrap break-words" data-testid={`text-message-body-${message.id}`}>{message.body}</p>
                              </div>
                              {message.direction === 'outbound' && (
                                <div className="flex items-center gap-1 mt-1 text-xs">
                                  {message.deliveryStatus === 'failed' && (
                                    <div className="flex items-center gap-1 text-red-500" data-testid={`status-failed-${message.id}`}>
                                      <AlertCircle className="w-3 h-3" />
                                      <span>Failed to send</span>
                                    </div>
                                  )}
                                  {message.deliveryStatus === 'pending' && (
                                    <div className="flex items-center gap-1 text-gray-400" data-testid={`status-pending-${message.id}`}>
                                      <Clock className="w-3 h-3" />
                                      <span>Sending...</span>
                                    </div>
                                  )}
                                  {message.deliveryStatus === 'sent' && (
                                    <div className="flex items-center gap-1 text-gray-500" data-testid={`status-sent-${message.id}`}>
                                      <Check className="w-3 h-3" />
                                    </div>
                                  )}
                                  {message.deliveryStatus === 'delivered' && (
                                    <div className="flex items-center gap-1 text-green-600" data-testid={`status-delivered-${message.id}`}>
                                      <CheckCheck className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMessage(message.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                              data-testid={`button-delete-message-${message.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      </div>
                      <div ref={messagesEndRef} className="h-4" />
                    </>
                  )}
                </div>

                {/* Message Input Area */}
                <div className="border-t border-gray-200 bg-white p-4" data-testid="container-message-composer">
                  <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                    <Textarea
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Type a message"
                      className="border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm pt-3"
                      rows={3}
                      maxLength={160}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      data-testid="input-message-body"
                    />
                    <div className="px-3 py-2 flex items-center justify-between bg-gray-50 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-xs">{messageBody.length}/160</span>
                      </div>
                      <Button
                        onClick={handleSendMessage}
                        disabled={!messageBody.trim() || sendMessageMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-sm"
                        data-testid="button-send-message"
                      >
                        {sendMessageMutation.isPending ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" data-testid="spinner-sending-message"></div>
                        ) : (
                          "Send"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50" data-testid="container-no-selection">
                <div className="text-center text-gray-400">
                  <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-sm" data-testid="text-select-conversation">Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent className="bg-white border-gray-200" data-testid="dialog-edit-broker-name">
          <DialogHeader>
            <DialogTitle className="text-catalyst-navy">Edit Broker Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">First Name *</label>
              <Input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="John"
                className="bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                data-testid="input-edit-first-name"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Last Name</label>
              <Input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Smith"
                className="bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                data-testid="input-edit-last-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditNameDialogOpen(false)}
              className="text-gray-600 hover:text-catalyst-navy"
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditName}
              disabled={updateBrokerNameMutation.isPending}
              className="bg-catalyst-gold hover:bg-catalyst-gold/90 text-catalyst-navy"
              data-testid="button-save-edit"
            >
              {updateBrokerNameMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-gray-200" data-testid="dialog-delete-message">
          <DialogHeader>
            <DialogTitle className="text-catalyst-navy">Delete Message</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteMessageId(null);
              }}
              className="text-gray-600 hover:text-catalyst-navy"
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteMessage}
              disabled={deleteMessageMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white border-red-500 focus:ring-red-500 focus:border-red-500 focus-visible:ring-red-500"
              data-testid="button-confirm-delete"
            >
              {deleteMessageMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConversationConfirmOpen} onOpenChange={setDeleteConversationConfirmOpen}>
        <DialogContent className="bg-white border-gray-200" data-testid="dialog-delete-conversation">
          <DialogHeader>
            <DialogTitle className="text-catalyst-navy flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Conversation
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete this entire conversation? This will permanently remove all messages and cannot be undone.
            </p>
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> This action is irreversible. The broker's profile will NOT be deleted, only the conversation history.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteConversationConfirmOpen(false);
                setDeleteConversationId(null);
              }}
              className="text-gray-600 hover:text-catalyst-navy"
              data-testid="button-cancel-delete-conversation"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteConversation}
              disabled={deleteConversationMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white border-red-500 focus:ring-red-500 focus:border-red-500 focus-visible:ring-red-500"
              data-testid="button-confirm-delete-conversation"
            >
              {deleteConversationMutation.isPending ? "Deleting..." : "Delete Conversation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editProfileDialogOpen} onOpenChange={setEditProfileDialogOpen}>
        <DialogContent className="bg-white border-gray-200 max-w-lg" data-testid="dialog-edit-broker-profile">
          <DialogHeader>
            <DialogTitle className="text-catalyst-navy">Edit Broker Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">First Name *</label>
                <Input
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="John"
                  className="bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                  data-testid="input-profile-first-name"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Last Name</label>
                <Input
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Smith"
                  className="bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                  data-testid="input-profile-last-name"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Phone</label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                data-testid="input-profile-phone"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Email</label>
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="john.smith@brokerage.com"
                type="email"
                className="bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                data-testid="input-profile-email"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Brokerage</label>
              <Input
                value={editBrokerage}
                onChange={(e) => setEditBrokerage(e.target.value)}
                placeholder="ABC Realty"
                className="bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                data-testid="input-profile-brokerage"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Markets Covered</label>
              <Input
                value={editMarkets}
                onChange={(e) => setEditMarkets(e.target.value)}
                placeholder="Austin, Dallas, Houston (comma-separated)"
                className="bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                data-testid="input-profile-markets"
              />
              <p className="text-xs text-gray-400 mt-1">Enter markets separated by commas</p>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-4 pt-4">
            <button
              onClick={() => {
                setEditProfileDialogOpen(false);
                handleOpenMergeDialog();
              }}
              className="w-full bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:!bg-white hover:!text-[#4A90E2] hover:!border-[#4A90E2] focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:ring-offset-2 rounded-lg h-10 text-sm font-medium uppercase transition-all duration-200 flex items-center justify-center group"
              data-testid="button-link-to-existing"
            >
              <Link2 className="w-4 h-4 mr-2 group-hover:text-[#4A90E2]" />
              Link to Existing Broker Profile
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Merge this SMS contact into an existing email-based broker profile
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setEditProfileDialogOpen(false)}
              className="text-gray-600 hover:text-catalyst-navy"
              data-testid="button-cancel-profile-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={updateBrokerProfileMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-save-profile"
            >
              {updateBrokerProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="bg-white border-gray-200 max-w-lg" data-testid="dialog-merge-brokers">
          <DialogHeader>
            <DialogTitle className="text-catalyst-navy flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Link to Existing Broker
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm text-amber-800">
                This will merge the current SMS broker profile into an existing broker. 
                All deals, messages, and communications will be transferred.
              </p>
            </div>
            
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Search for existing broker</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={mergeSearchQuery}
                  onChange={(e) => setMergeSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  className="pl-10 bg-white border-gray-300 text-catalyst-navy placeholder:text-gray-400"
                  data-testid="input-merge-search"
                />
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                {searchResults.map((broker) => (
                  <button
                    key={broker.id}
                    onClick={() => setSelectedMergeTarget(broker.id)}
                    className={`w-full text-left p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                      selectedMergeTarget === broker.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    data-testid={`button-select-broker-${broker.id}`}
                  >
                    <div className="font-medium text-sm text-gray-900">
                      {broker.firstName} {broker.lastName}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {broker.email && <span className="mr-3">{broker.email}</span>}
                      {broker.phone && <span>{broker.phone}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {mergeSearchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No matching brokers found
              </p>
            )}
            
            {selectedMergeTarget && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Selected:</strong> {searchResults.find(b => b.id === selectedMergeTarget)?.firstName} {searchResults.find(b => b.id === selectedMergeTarget)?.lastName}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setMergeDialogOpen(false);
                setMergeSearchQuery("");
                setSearchResults([]);
                setSelectedMergeTarget(null);
              }}
              className="text-gray-600 hover:text-catalyst-navy"
              data-testid="button-cancel-merge"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMergeBrokers}
              disabled={!selectedMergeTarget || mergeBrokersMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="button-confirm-merge"
            >
              {mergeBrokersMutation.isPending ? "Merging..." : "Merge Brokers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
