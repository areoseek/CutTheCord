import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { getSocket } from '../hooks/useSocket';
import * as api from '../api';
import type { Message } from '@ctc/shared';
import Avatar from './Avatar';

export default function ChatArea() {
  const { currentChannel, messages, setMessages, prependMessages, hasMoreMessages, nextCursor, typingUsers, members } = useChatStore();
  const user = useAuthStore((s) => s.user);

  // Resolve avatar: prefer current member data (live), fall back to message data
  const getAvatarUrl = (msg: Message) => {
    // For current user, use authStore (most up-to-date)
    if (msg.author_id === user?.id) return user.avatar_url ?? null;
    // For others, check members list (refreshed on server join)
    const member = members.find(m => m.user_id === msg.author_id);
    if (member) return member.avatar_url ?? null;
    // Fall back to what the message has
    return msg.author_avatar_url ?? null;
  };
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load messages when channel changes
  useEffect(() => {
    if (!currentChannel) return;
    setLoading(true);
    api.getMessages(currentChannel.id)
      .then((data) => {
        setMessages(data.items);
        useChatStore.setState({ nextCursor: data.next_cursor, hasMoreMessages: data.has_more });
        // Scroll to bottom
        setTimeout(() => messagesEndRef.current?.scrollIntoView(), 50);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentChannel?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Load older messages
  const loadMore = useCallback(async () => {
    if (!currentChannel || !hasMoreMessages || !nextCursor || loading) return;
    setLoading(true);
    try {
      const data = await api.getMessages(currentChannel.id, nextCursor);
      prependMessages(data.items, data.next_cursor, data.has_more);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentChannel?.id, hasMoreMessages, nextCursor, loading]);

  // Scroll to top to load more
  const handleScroll = () => {
    const container = containerRef.current;
    if (container && container.scrollTop < 50 && hasMoreMessages) {
      loadMore();
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentChannel) return;

    const content = input.trim();
    setInput('');

    // Stop typing
    const socket = getSocket();
    socket?.emit('typing-stop', currentChannel.id);

    try {
      await api.sendMessage(currentChannel.id, content);
    } catch (e) {
      console.error(e);
      setInput(content);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!currentChannel) return;

    const socket = getSocket();
    socket?.emit('typing-start', currentChannel.id);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('typing-stop', currentChannel.id);
    }, 3000);
  };

  // Build typing indicator text
  const typingArray = Array.from(typingUsers.values())
    .filter(t => t.username !== user?.username)
    .map(t => t.username);

  const typingText = typingArray.length === 0
    ? ''
    : typingArray.length === 1
    ? `${typingArray[0]} is typing...`
    : typingArray.length <= 3
    ? `${typingArray.join(', ')} are typing...`
    : 'Several people are typing...';

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  // Group messages by date
  let lastDate = '';

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2"
      >
        {loading && messages.length === 0 && (
          <div className="text-center text-[#949ba4] py-8">Loading messages...</div>
        )}
        {hasMoreMessages && (
          <div ref={messagesTopRef} className="text-center py-2">
            <button onClick={loadMore} className="text-sm text-indigo-400 hover:text-indigo-300">
              Load older messages
            </button>
          </div>
        )}
        {messages.map((msg, i) => {
          const msgDate = formatDate(msg.created_at);
          const showDate = msgDate !== lastDate;
          lastDate = msgDate;

          // Compact mode: group consecutive messages from same author within 5 min
          const prev = messages[i - 1];
          const isGrouped = prev
            && prev.author_id === msg.author_id
            && !showDate
            && (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 300000;

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 h-px bg-[#3f4147]" />
                  <span className="text-xs text-[#949ba4] font-semibold">{msgDate}</span>
                  <div className="flex-1 h-px bg-[#3f4147]" />
                </div>
              )}
              <div className={`group flex gap-4 hover:bg-[#2e3035] px-2 py-0.5 rounded ${isGrouped ? '' : 'mt-4 first:mt-0'}`}>
                {isGrouped ? (
                  <div className="w-10 flex-shrink-0 flex items-start justify-center">
                    <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                ) : (
                  <div className="flex-shrink-0 mt-0.5">
                    <Avatar username={msg.author_username || '?'} avatarUrl={getAvatarUrl(msg)} size={40} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {!isGrouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-white hover:underline cursor-pointer">
                        {msg.author_username || 'Unknown'}
                      </span>
                      <span className="text-xs text-[#949ba4]">
                        {formatDate(msg.created_at)} at {formatTime(msg.created_at)}
                      </span>
                      {msg.edited_at && (
                        <span className="text-[10px] text-[#949ba4]">(edited)</span>
                      )}
                    </div>
                  )}
                  <div className="text-[#dbdee1] break-words whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <div className="h-6 px-4 text-xs text-[#b5bac1] flex items-center">
        {typingText}
      </div>

      {/* Message input */}
      <form onSubmit={handleSend} className="px-2 sm:px-4 pb-3 sm:pb-6">
        <div className="bg-[#383a40] rounded-lg flex items-center px-3 sm:px-4">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={`Message #${currentChannel?.name || ''}`}
            className="flex-1 bg-transparent py-3 text-[#dbdee1] outline-none placeholder-[#6d6f78]"
            maxLength={4000}
          />
        </div>
      </form>
    </div>
  );
}
