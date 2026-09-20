/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthModal } from './components/AuthModal.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { ChatView } from './components/ChatView.tsx';
import { DevPanelModal } from './components/DevPanelModal.tsx';
import { User, Chat, Message, GlobalConfig, AppLayoutConfig, StudyTask, FileAttachment } from './types.ts';

const DEFAULT_LAYOUT_CONFIG: AppLayoutConfig = {
  app_name: 'Driia IA',
  app_subtitle: 'Ciências Exatas & Conversação',
  app_logo_url: '/Driia logotipo..jpg',
  primary_color: '#3b82f6',
  quick_prompts: [
    { id: '1', label: 'Equação de 2º Grau', text: 'Resolver equação: 2x² - 8x + 6 = 0 passo a passo', icon: 'calculator' },
    { id: '2', label: 'Cálculo de Derivada', text: 'Calcular a derivada de f(x) = x³ · sin(x)', icon: 'sigma' },
    { id: '3', label: 'Física Clássica', text: 'Explicar a 2ª Lei de Newton (F = m · a) com exemplo numérico', icon: 'atom' },
    { id: '4', label: 'Integral Indefinida', text: 'Calcule a integral de 2x dx passo a passo', icon: 'sparkles' },
  ],
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));

  // Global layout & branding config
  const [layoutConfig, setLayoutConfig] = useState<AppLayoutConfig>(DEFAULT_LAYOUT_CONFIG);

  // Dev Panel state for developer admin
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [activeStudyTask, setActiveStudyTask] = useState<StudyTask | null>(null);

  // Load public layout config
  const loadPublicConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/public-config');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setLayoutConfig(data.config);
          if (data.config.app_name) {
            document.title = `${data.config.app_name} - ${data.config.app_subtitle || 'Ciências Exatas'}`;
          }
        }
      }
    } catch (err) {
      console.error('Error loading public config:', err);
    }
  }, []);

  useEffect(() => {
    loadPublicConfig();
  }, [loadPublicConfig]);

  // Check current session
  const checkAuth = useCallback(async () => {
    try {
      const savedEmail = localStorage.getItem('driia_user_email');
      const headers: Record<string, string> = {};
      if (savedEmail) {
        headers['x-user-email'] = savedEmail;
      }
      const res = await fetch('/api/auth/me', { headers });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setUser(null);
        return;
      }
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
        localStorage.setItem('driia_user_email', data.user.email);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error checking auth session:', err);
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load global config if developer
  const loadGlobalConfig = useCallback(async () => {
    if (!user?.is_admin) return;
    try {
      const email = user.email || localStorage.getItem('driia_user_email') || '';
      const res = await fetch('/api/dev/config', {
        headers: email ? { 'x-user-email': email } : {},
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.config) {
            setGlobalConfig(data.config);
            setLayoutConfig({
              app_name: data.config.app_name || 'Driia IA',
              app_subtitle: data.config.app_subtitle || 'Ciências Exatas & Conversação',
              app_logo_url: data.config.app_logo_url || '',
              primary_color: data.config.primary_color || '#3b82f6',
              quick_prompts: data.config.quick_prompts || [],
              updated_at: data.config.updated_at,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error loading dev global config:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user?.is_admin) {
      loadGlobalConfig();
    }
  }, [user, loadGlobalConfig]);

  // Handle updating global config from dev panel
  const handleUpdateGlobalConfig = async (partial: Partial<GlobalConfig>) => {
    const savedEmail = user?.email || localStorage.getItem('driia_user_email') || '';
    const res = await fetch('/api/dev/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(savedEmail ? { 'x-user-email': savedEmail } : {}),
      },
      body: JSON.stringify(partial),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const errorText = await res.text();
      if (res.status === 413) {
        throw new Error('A imagem ou os dados enviados são muito pesados para o servidor. Por favor, utilize uma imagem mais leve.');
      }
      if (res.status === 403) {
        throw new Error('Acesso negado: apenas o desenvolvedor autorizado pode alterar estas configurações.');
      }
      throw new Error(`Erro do servidor (HTTP ${res.status}): ${errorText.substring(0, 100)}`);
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha ao salvar configurações.');
    }
    if (data.config) {
      setGlobalConfig(data.config);
      setLayoutConfig({
        app_name: data.config.app_name || 'Driia IA',
        app_subtitle: data.config.app_subtitle || 'Ciências Exatas & Conversação',
        app_logo_url: data.config.app_logo_url || '',
        primary_color: data.config.primary_color || '#3b82f6',
        quick_prompts: data.config.quick_prompts || [],
        updated_at: data.config.updated_at,
      });
      if (data.config.app_name) {
        document.title = `${data.config.app_name} - ${data.config.app_subtitle || 'Ciências Exatas'}`;
      }
    }
  };

  // Load chats for user
  const loadChats = useCallback(async () => {
    if (!user) return;
    try {
      const email = user.email || localStorage.getItem('driia_user_email') || '';
      const res = await fetch('/api/chats', {
        headers: email ? { 'x-user-email': email } : {},
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.chats && data.chats.length > 0) {
            setChats(data.chats);
            setActiveChatId(prev => {
              if (prev && data.chats.some((c: Chat) => c.id === prev)) {
                return prev;
              }
              return data.chats[0].id;
            });
          } else {
            setChats([]);
            setActiveChatId(null);
          }
        }
      }
    } catch (err) {
      console.error('Error loading chats:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user, loadChats]);

  // Create New Chat
  const handleNewChat = async () => {
    try {
      const email = user?.email || localStorage.getItem('driia_user_email') || '';
      const res = await fetch('/api/new-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(email ? { 'x-user-email': email } : {}),
        },
        body: JSON.stringify({ user_email: email }),
      });
      const data = await res.json();
      if (data.chat_id) {
        await loadChats();
        setActiveChatId(data.chat_id);
      }
    } catch (err) {
      console.error('Error creating new chat:', err);
    }
  };

  // Handle Login Success: Always create a fresh new conversation so user does not return to previous chat
  const handleLoginSuccess = async (authenticatedUser: User) => {
    setUser(authenticatedUser);
    localStorage.setItem('driia_user_email', authenticatedUser.email);
    try {
      const res = await fetch('/api/new-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': authenticatedUser.email,
        },
        body: JSON.stringify({ user_email: authenticatedUser.email }),
      });
      const data = await res.json();
      if (data.chat_id) {
        await loadChats();
        setActiveChatId(data.chat_id);
      }
    } catch (err) {
      console.error('Error auto-creating new chat on login:', err);
    }
  };

  // Load messages when activeChatId changes
  const loadMessages = useCallback(async (chatId: number, silent = false) => {
    try {
      const res = await fetch(`/api/chat/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        const incomingMsgs: Message[] = data.messages || [];
        
        // Only update state if message count or last message changed
        setMessages(prev => {
          if (prev.length === incomingMsgs.length) {
            const lastPrev = prev[prev.length - 1];
            const lastIncoming = incomingMsgs[incomingMsgs.length - 1];
            if (lastPrev && lastIncoming && lastPrev.id === lastIncoming.id && lastPrev.content === lastIncoming.content) {
              return prev; // No change, keep same reference to prevent re-render
            }
          }
          return incomingMsgs;
        });

        setActiveStudyTask(prev => {
          const newTask = data.active_study_task || null;
          if (!prev && !newTask) return null;
          if (prev && newTask && prev.id === newTask.id && prev.status === newTask.status && prev.end_time === newTask.end_time) {
            return prev;
          }
          return newTask;
        });
      }
    } catch (err) {
      if (!silent) {
        console.error('Error loading messages for chat:', chatId, err);
      }
    }
  }, []);

  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId);
    } else {
      setMessages([]);
      setActiveStudyTask(null);
    }
  }, [activeChatId, loadMessages]);

  // Real-time polling for study tasks & message synchronization
  useEffect(() => {
    if (!activeChatId) return;
    const pollInterval = activeStudyTask ? 2000 : 5000;
    const interval = setInterval(() => {
      loadMessages(activeChatId, true);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [activeChatId, activeStudyTask, loadMessages]);

  // Handle Delete Chat
  const handleDeleteChat = async (chatId: number) => {
    try {
      const email = user?.email || localStorage.getItem('driia_user_email') || '';
      const res = await fetch(`/api/chat/${chatId}`, {
        method: 'DELETE',
        headers: email ? { 'x-user-email': email } : {},
      });
      if (res.ok) {
        const remaining = chats.filter(c => c.id !== chatId);
        setChats(remaining);
        if (activeChatId === chatId) {
          if (remaining.length > 0) {
            setActiveChatId(remaining[0].id);
          } else {
            handleNewChat();
          }
        }
      }
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (content: string, attachments?: FileAttachment[]) => {
    if (!activeChatId) {
      try {
        const email = user?.email || localStorage.getItem('driia_user_email') || '';
        const createRes = await fetch('/api/new-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(email ? { 'x-user-email': email } : {}),
          },
          body: JSON.stringify({ user_email: email }),
        });
        const createData = await createRes.json();
        if (createData.chat_id) {
          setActiveChatId(createData.chat_id);
          await performSendMessage(createData.chat_id, content, attachments);
        }
      } catch (err) {
        console.error('Error initializing chat before message:', err);
      }
      return;
    }

    await performSendMessage(activeChatId, content, attachments);
  };

  const performSendMessage = async (chatId: number, content: string, attachments?: FileAttachment[]) => {
    const tempUserMsg: Message = {
      id: Date.now(),
      chat_id: chatId,
      role: 'user',
      content,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempUserMsg]);
    setLoadingMessage(true);

    try {
      const email = user?.email || localStorage.getItem('driia_user_email') || '';
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(email ? { 'x-user-email': email } : {}),
        },
        body: JSON.stringify({
          chat_id: chatId,
          content,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
          user_email: email,
        }),
      });

      const data = await res.json();
      const reply = data.reply || 'Sem resposta.';
      if (data.active_study_task !== undefined) {
        setActiveStudyTask(data.active_study_task);
      }

      const assistantMsg: Message = {
        id: Date.now() + 1,
        chat_id: chatId,
        role: 'assistant',
        content: reply,
        actionData: data.actionData,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      loadChats();
    } catch (err: any) {
      const errorMsg: Message = {
        id: Date.now() + 1,
        chat_id: chatId,
        role: 'assistant',
        content: 'Erro de conexão ao processar a resposta.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoadingMessage(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      const email = user?.email || localStorage.getItem('driia_user_email') || '';
      await fetch('/api/logout', {
        method: 'POST',
        headers: email ? { 'x-user-email': email } : {},
      });
    } catch (err) {
      console.error('Error logging out:', err);
    }
    localStorage.removeItem('driia_user_email');
    setUser(null);
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-[#080c14] text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: layoutConfig.primary_color, borderTopColor: 'transparent' }}
          />
          <span className="text-sm font-medium tracking-wide">Carregando {layoutConfig.app_name}...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthModal onSuccess={handleLoginSuccess} />;
  }

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  return (
    <div
      className="main-layout flex w-full h-screen relative overflow-hidden"
      style={{
        // @ts-ignore
        '--theme-primary': layoutConfig.primary_color,
      }}
    >
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={id => setActiveChatId(id)}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        user={user}
        onLogout={handleLogout}
        onOpenDevPanel={() => setDevPanelOpen(true)}
        layoutConfig={layoutConfig}
      />

      <ChatView
        chat={activeChat}
        messages={messages}
        loading={loadingMessage}
        onSendMessage={handleSendMessage}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onNewChat={handleNewChat}
        user={user}
        sidebarOpen={sidebarOpen}
        isDeveloper={user?.is_admin}
        onOpenDevPanel={() => setDevPanelOpen(true)}
        layoutConfig={layoutConfig}
        activeStudyTask={activeStudyTask}
      />

      {user?.is_admin && (
        <DevPanelModal
          isOpen={devPanelOpen}
          onClose={() => setDevPanelOpen(false)}
          config={globalConfig}
          onUpdateConfig={handleUpdateGlobalConfig}
          onRefreshConfig={loadGlobalConfig}
          userEmail={user.email}
        />
      )}
    </div>
  );
}
