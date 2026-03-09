import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  MessageSquare, Send, Plus, ChevronLeft, Bell, Megaphone,
  User, Radio, Loader2, Info, Users,
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { isAdminRole, isCoachRole, isStaffRole } from '@/lib/roles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDisplayName = (profile) => {
  if (!profile) return 'Usuario';
  const fn = profile.first_name || '';
  const ln = profile.last_name || '';
  return `${fn} ${ln}`.trim() || profile.full_name || profile.email || 'Usuario';
};

const getInitials = (profile) => {
  if (!profile) return 'U';
  const fn = profile.first_name || profile.full_name || '';
  const ln = profile.last_name || '';
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  return (fn[0] || 'U').toUpperCase();
};

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const SCOPE_LABELS = {
  all: 'Todos los usuarios',
  coaches: 'Todos los coaches',
  clients: 'Todos los clientes',
  coach_clients: 'Mis clientes',
};

const getConversationPreview = (msg, isMine = false) => {
  if (!msg?.body) return '';
  const base = msg.body.trim();
  const prefixed = isMine ? `Tu: ${base}` : base;
  if (msg.type === 'announcement') return `Anuncio: ${prefixed}`;
  return prefixed;
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar = ({ profile, size = 'md', isCoach = false }) => {
  const sz = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-sm';
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className={cn(sz, 'rounded-full object-cover shrink-0')} />;
  }
  return (
    <div className={cn(
      sz,
      'rounded-full flex items-center justify-center font-semibold shrink-0',
      isCoach ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/20 text-primary',
    )}>
      {getInitials(profile)}
    </div>
  );
};

// ─── ConversationItem (left panel row) ────────────────────────────────────────

const ConversationItem = ({ conv, isSelected, onClick }) => {
  const isChannel = conv.type === 'channel';
  const isDirect = conv.type === 'direct';
  const icon = isChannel ? (
    <div className="h-9 w-9 rounded-full bg-violet-500/20 text-violet-500 flex items-center justify-center shrink-0">
      <Megaphone className="h-4 w-4" />
    </div>
  ) : (
    <Avatar profile={conv.otherProfile} />
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/70 text-foreground',
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-sm font-medium">{conv.displayName}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(conv.updated_at)}</span>
        </div>
        {isDirect && (
          <span className="block truncate text-[12px] text-muted-foreground">
            {conv.lastMessagePreview || 'Sin mensajes todavía'}
          </span>
        )}
        {isChannel && conv.broadcast_scope && (
          <span className="text-[11px] text-muted-foreground">
            {SCOPE_LABELS[conv.broadcast_scope] || conv.broadcast_scope}
          </span>
        )}
      </div>
      {conv.unreadCount > 0 && (
        <span className="shrink-0 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
        </span>
      )}
    </button>
  );
};

// ─── MessageBubble ────────────────────────────────────────────────────────────

const MessageBubble = ({ msg, isMine, senderProfile, showSenderName = false }) => {
  if (msg.type === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[11px] text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
          {msg.body}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 items-end', isMine ? 'flex-row-reverse' : 'flex-row')}>
      {!isMine && <Avatar profile={senderProfile} size="sm" />}
      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isMine
          ? 'rounded-br-sm bg-primary text-primary-foreground'
          : msg.type === 'announcement'
            ? 'rounded-bl-sm bg-violet-500/15 border border-violet-500/30 text-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
      )}>
        {!isMine && showSenderName && senderProfile && (
          <p className="text-[11px] font-semibold mb-1 opacity-70">{getDisplayName(senderProfile)}</p>
        )}
        {msg.type === 'announcement' && (
          <div className="flex items-center gap-1 mb-1">
            <Megaphone className="h-3 w-3 text-violet-500" />
            <span className="text-[11px] font-semibold text-violet-500">Anuncio</span>
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        <p className={cn(
          'text-[10px] mt-1',
          isMine ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground',
        )}>
          {formatTime(msg.created_at)}
          {msg.edited_at && ' · editado'}
        </p>
      </div>
    </div>
  );
};

// ─── CommunicationPage ────────────────────────────────────────────────────────

const CommunicationPage = () => {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
    refreshUnreadCommCount,
  } = useNotifications();
  const { toast } = useToast();

  const isAdmin = isAdminRole(user?.role);
  const isCoach = isCoachRole(user?.role);
  const isStaff = isStaffRole(user?.role);

  // Conversations list
  const [conversations, setConversations] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);

  // Selected conversation
  const [selectedId, setSelectedId] = useState(null); // UUID | 'system' | null
  const [messages, setMessages] = useState([]);
  const [profileCache, setProfileCache] = useState({}); // user_id → profile
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Sending
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  // Mobile: show list or view
  const [showList, setShowList] = useState(true);

  // New channel dialog
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelScope, setChannelScope] = useState(isAdmin ? 'all' : 'coach_clients');
  const [channelDesc, setChannelDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const cacheProfiles = useCallback(async (userIds) => {
    const missing = userIds.filter(id => id && !profileCache[id]);
    if (!missing.length) return profileCache;
    let fetchedMap = {};
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, first_name, last_name, avatar_url, email')
      .in('user_id', missing);
    if (data) {
      fetchedMap = data.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {});
      setProfileCache(prev => {
        const next = { ...prev };
        data.forEach(p => { next[p.user_id] = p; });
        return next;
      });
    }
    return { ...profileCache, ...fetchedMap };
  }, [profileCache]);

  // ─── Load conversations ──────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConvs(true);
    try {
      // Server-side inbox with unread counts + direct profile fields
      const { data: convData, error } = await supabase.rpc('comm_list_conversations_v2');

      if (error) throw error;
      if (!convData?.length) { setConversations([]); return; }

      const fallbackDirectProfiles = {};
      convData.forEach((conv) => {
        if (conv.type !== 'direct' || !conv.other_user_id) return;
        fallbackDirectProfiles[conv.other_user_id] = {
          user_id: conv.other_user_id,
          full_name: conv.other_full_name,
          first_name: conv.other_first_name,
          last_name: conv.other_last_name,
          avatar_url: conv.other_avatar_url,
          email: conv.other_email,
        };
      });

      if (Object.keys(fallbackDirectProfiles).length > 0) {
        setProfileCache(prev => ({ ...fallbackDirectProfiles, ...prev }));
      }

      const convIds = convData.map(c => c.id);
      let lastMessageMap = {};
      if (convIds.length > 0) {
        const previewScanLimit = Math.max(convIds.length * 20, 200);
        const { data: recentMsgs } = await supabase
          .from('comm_messages')
          .select('conversation_id, body, type, sender_id, created_at')
          .in('conversation_id', convIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(previewScanLimit);

        (recentMsgs || []).forEach((msg) => {
          if (!lastMessageMap[msg.conversation_id]) {
            lastMessageMap[msg.conversation_id] = msg;
          }
        });
      }

      // Cache profiles we need
      const profileIds = [
        ...convData.filter(c => c.type === 'direct').map(c => c.other_user_id),
        ...convData.filter(c => c.type === 'channel').map(c => c.created_by),
      ].filter(Boolean);
      const profilesMap = {
        ...fallbackDirectProfiles,
        ...(await cacheProfiles(profileIds)),
      };

      // Build enriched conversations
      const enriched = convData.map(conv => {
        const lastReadAt = conv.last_read_at ? new Date(conv.last_read_at) : null;
        const unreadCount = conv.unread_count || 0;

        let displayName = conv.name || 'Canal';
        let otherProfile = null;

        if (conv.type === 'direct') {
          const otherId = conv.other_user_id;
          otherProfile = profilesMap[otherId] || profileCache[otherId] || null;
          displayName = getDisplayName(otherProfile);
        } else if (conv.type === 'channel' && !conv.name) {
          displayName = 'Canal sin nombre';
        }

        const lastMsg = lastMessageMap[conv.id];

        return {
          ...conv,
          myRole: conv.my_role || null,
          lastReadAt,
          unreadCount,
          lastMessageBody: lastMsg?.body || '',
          lastMessageType: lastMsg?.type || null,
          lastMessageSenderId: lastMsg?.sender_id || null,
          lastMessagePreview: getConversationPreview(lastMsg, lastMsg?.sender_id === user.id),
          displayName,
          otherProfile,
        };
      });

      setConversations(enriched);
    } catch (err) {
      console.error('Error loading conversations:', err);
      toast({ title: 'Error al cargar conversaciones', variant: 'destructive' });
    } finally {
      setLoadingConvs(false);
    }
  }, [user, cacheProfiles, profileCache, toast]);

  useEffect(() => { loadConversations(); }, [user]);

  // ─── Load messages ───────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (convId) => {
    if (!convId || convId === 'system') return;
    setLoadingMsgs(true);
    try {
      const { data, error } = await supabase
        .from('comm_messages')
        .select('id, conversation_id, sender_id, body, type, metadata, created_at, edited_at')
        .eq('conversation_id', convId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);

      // Cache sender profiles
      const senderIds = [...new Set((data || []).map(m => m.sender_id).filter(Boolean))];
      await cacheProfiles(senderIds);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoadingMsgs(false);
    }
  }, [cacheProfiles]);

  const updateConversationFromMessage = useCallback((msg) => {
    if (!msg?.conversation_id) return;
    setConversations(prev => {
      const updated = prev.map((conv) => {
        if (conv.id !== msg.conversation_id) return conv;
        const isMine = msg.sender_id === user.id;
        const shouldIncreaseUnread = !isMine && selectedId !== conv.id;
        return {
          ...conv,
          updated_at: msg.created_at || new Date().toISOString(),
          lastMessageBody: msg.body || '',
          lastMessageType: msg.type || null,
          lastMessageSenderId: msg.sender_id || null,
          lastMessagePreview: getConversationPreview(msg, isMine),
          unreadCount: shouldIncreaseUnread ? (conv.unreadCount || 0) + 1 : (conv.unreadCount || 0),
        };
      });
      return updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    });
  }, [selectedId, user]);

  // ─── Mark conversation as read ───────────────────────────────────────────────

  const markConvRead = useCallback(async (convId) => {
    if (!convId || convId === 'system') return;
    try {
      const { error } = await supabase.rpc('comm_mark_conversation_read', {
        p_conv_id: convId,
      });
      if (error) throw error;

      setConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c)
      );
      refreshUnreadCommCount();
    } catch (err) {
      console.error('Error marking conversation as read:', err);
    }
  }, [refreshUnreadCommCount]);

  // ─── Select conversation ─────────────────────────────────────────────────────

  const handleSelectConv = (id) => {
    setSelectedId(id);
    setShowList(false);
    if (id && id !== 'system') {
      loadMessages(id);
      markConvRead(id);
    }
  };

  // ─── Realtime: new messages ──────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedId || selectedId === 'system') return;

    const channel = supabase
      .channel(`comm-msgs-${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comm_messages',
        filter: `conversation_id=eq.${selectedId}`,
      }, async (payload) => {
        const msg = payload.new;
        setMessages(prev => (
          prev.some((existing) => existing.id === msg.id)
            ? prev
            : [...prev, msg]
        ));
        updateConversationFromMessage(msg);
        if (msg.sender_id) await cacheProfiles([msg.sender_id]);
        if (msg.sender_id !== user.id) {
          markConvRead(selectedId);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId, cacheProfiles, markConvRead, updateConversationFromMessage, user]);

  // Realtime: refresh conv list on any new message (update order/unread)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('comm-conv-list-refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comm_messages' }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadConversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Send message ────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const body = msgText.trim();
    if (!body || !selectedId || selectedId === 'system' || sending) return;

    setSending(true);
    try {
      const { data: newMsg, error } = await supabase
        .from('comm_messages')
        .insert({
          conversation_id: selectedId,
          sender_id: user.id,
          body,
          type: 'text',
        })
        .select('id, conversation_id, sender_id, body, type, metadata, created_at, edited_at')
        .single();
      if (error) throw error;

      if (newMsg) {
        setMessages(prev => (
          prev.some((existing) => existing.id === newMsg.id)
            ? prev
            : [...prev, newMsg]
        ));
        updateConversationFromMessage(newMsg);
      }

      setMsgText('');
      loadConversations();
      textareaRef.current?.focus();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error al enviar mensaje', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Contact admin ───────────────────────────────────────────────────────────

  const handleContactAdmin = async () => {
    try {
      const { data, error } = await supabase.rpc('comm_get_or_create_admin_convo');
      if (error) throw error;
      await loadConversations();
      handleSelectConv(data);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error al contactar con el admin', variant: 'destructive' });
    }
  };

  // ─── Create broadcast channel ────────────────────────────────────────────────

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('comm_create_channel', {
        p_name: channelName.trim(),
        p_description: channelDesc.trim() || null,
        p_broadcast_scope: channelScope || null,
      });
      if (error) throw error;
      setShowNewChannel(false);
      setChannelName('');
      setChannelDesc('');
      await loadConversations();
      handleSelectConv(data);
      toast({ title: 'Canal creado', description: channelName });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error al crear el canal', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // ─── Derived: current conversation ──────────────────────────────────────────

  const selectedConv = conversations.find(c => c.id === selectedId);
  const canWrite = (() => {
    if (!selectedId || selectedId === 'system') return false;
    if (isAdmin) return true;
    if (!selectedConv) return false;
    if (selectedConv.type === 'direct') return selectedConv.myRole === 'member';
    if (selectedConv.type === 'channel') return selectedConv.myRole === 'owner';
    return false;
  })();

  const channels = conversations.filter(c => c.type === 'channel');
  const directs = conversations.filter(c => c.type === 'direct');
  const totalConvUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet>
        <title>Centro de Comunicaciones - Bibofit</title>
      </Helmet>

      <div className="flex h-full min-h-0 overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <aside className={cn(
          'flex flex-col border-r border-border bg-background transition-all',
          'w-full md:w-80 md:flex shrink-0',
          !showList && 'hidden md:flex',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h1 className="font-semibold text-foreground">Comunicaciones</h1>
            {isStaff && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewChannel(true)}
              >
                <Plus className="h-4 w-4" />
                <span className="text-xs">Canal</span>
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {/* Sistema */}
            <button
              onClick={() => handleSelectConv('system')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                selectedId === 'system'
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted/70 text-foreground',
              )}
            >
              <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">Notificaciones del sistema</span>
              </div>
              {unreadCount > 0 && (
                <span className="shrink-0 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Canales */}
            {channels.length > 0 && (
              <>
                <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Canales
                </p>
                {channels.map(conv => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isSelected={selectedId === conv.id}
                    onClick={() => handleSelectConv(conv.id)}
                  />
                ))}
              </>
            )}

            {/* Mensajes directos */}
            {directs.length > 0 && (
              <>
                <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mensajes directos
                </p>
                {directs.map(conv => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isSelected={selectedId === conv.id}
                    onClick={() => handleSelectConv(conv.id)}
                  />
                ))}
              </>
            )}

            {/* Empty state */}
            {!loadingConvs && channels.length === 0 && directs.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground px-4">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Aún no hay conversaciones.</p>
                {!isStaff && (
                  <p className="mt-1">Usa el botón de abajo para contactar con el admin.</p>
                )}
              </div>
            )}

            {loadingConvs && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Bottom actions */}
          <div className="p-3 border-t border-border space-y-2">
            {!isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-muted-foreground"
                onClick={handleContactAdmin}
              >
                <Users className="h-4 w-4" />
                Contactar con el admin
              </Button>
            )}
          </div>
        </aside>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <main className={cn(
          'flex-1 flex flex-col min-w-0 bg-background',
          showList && 'hidden md:flex',
        )}>

          {/* ── Empty state ─────────────────────────────────────────────── */}
          {!selectedId && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MessageSquare className="h-12 w-12 opacity-30" />
              <p className="text-sm">Selecciona una conversación para empezar</p>
            </div>
          )}

          {/* ── System notifications view ────────────────────────────────── */}
          {selectedId === 'system' && (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Button
                  variant="ghost" size="icon" className="md:hidden h-8 w-8"
                  onClick={() => { setShowList(true); setSelectedId(null); }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">Notificaciones del sistema</p>
                </div>
                {unreadCount > 0 && (
                  <Button size="sm" variant="secondary" onClick={markAllAsRead} className="text-xs h-7">
                    Marcar leídas
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No tienes notificaciones todavía.
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => !n.is_read && markAsRead(n.id)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3.5 transition-colors',
                        n.is_read
                          ? 'border-border bg-muted/50'
                          : 'border-primary/40 bg-primary/8 hover:bg-primary/12',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{n.title}</p>
                        {!n.is_read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground/70">
                        {new Date(n.created_at).toLocaleString('es-ES')}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── Conversation view ────────────────────────────────────────── */}
          {selectedId && selectedId !== 'system' && (
            <>
              {/* Conversation header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Button
                  variant="ghost" size="icon" className="md:hidden h-8 w-8"
                  onClick={() => { setShowList(true); setSelectedId(null); }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {selectedConv?.type === 'channel' ? (
                  <div className="h-9 w-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <Megaphone className="h-4 w-4 text-violet-500" />
                  </div>
                ) : (
                  <Avatar profile={selectedConv?.otherProfile} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {selectedConv?.displayName || '…'}
                  </p>
                  {selectedConv?.type === 'channel' && selectedConv?.broadcast_scope && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Radio className="h-3 w-3" />
                      {SCOPE_LABELS[selectedConv.broadcast_scope]}
                    </p>
                  )}
                  {selectedConv?.type === 'direct' && (
                    <p className="text-[11px] text-muted-foreground">Mensaje directo</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingMsgs && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loadingMsgs && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <p className="text-sm">
                      {canWrite ? 'Escribe el primer mensaje.' : 'Todavía no hay mensajes en este canal.'}
                    </p>
                  </div>
                )}
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.sender_id === user.id}
                    senderProfile={profileCache[msg.sender_id]}
                    showSenderName={selectedConv?.type === 'group'}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {canWrite ? (
                <div className="px-4 py-3 border-t border-border">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={textareaRef}
                      value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Mensaje"
                      rows={2}
                      className={cn(
                        'flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5',
                        'text-sm placeholder:text-gray-500',
                        'focus:outline-none focus:ring-2 focus:ring-ring',
                        'max-h-32 overflow-y-auto',
                      )}
                      style={{ minHeight: '68px' }}
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={!msgText.trim() || sending}
                      className="h-[42px] w-[42px] shrink-0 rounded-xl"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : selectedConv && (
                <div className="px-4 py-3 border-t border-border">
                  <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Solo lectura — no tienes permiso para escribir en esta conversación
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── New channel dialog ─────────────────────────────────────────────── */}
      <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-violet-500" />
              Nuevo canal de novedades
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ch-name">Nombre del canal</Label>
              <Input
                id="ch-name"
                placeholder="Ej: Novedades de la app"
                value={channelName}
                onChange={e => setChannelName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ch-desc">Descripción (opcional)</Label>
              <Input
                id="ch-desc"
                placeholder="Breve descripción del canal"
                value={channelDesc}
                onChange={e => setChannelDesc(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Destinatarios</Label>
              <Select value={channelScope} onValueChange={setChannelScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="all">Todos los usuarios</SelectItem>}
                  {isAdmin && <SelectItem value="coaches">Solo coaches</SelectItem>}
                  {isAdmin && <SelectItem value="clients">Solo clientes</SelectItem>}
                  <SelectItem value="coach_clients">Mis clientes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Solo tú podrás publicar. Los destinatarios verán el canal en solo lectura.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChannel(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateChannel} disabled={!channelName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear canal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CommunicationPage;
