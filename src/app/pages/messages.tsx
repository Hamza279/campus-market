"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getListingImageSrc } from "./image-url";
import {
  getConversationDetail,
  getConversations,
  sendConversationMessage,
} from "./messages.data";
import type { ConversationSummary, MarketplaceMessage } from "./messages.data";
import styles from "./messages.module.css";

interface MessagesProps {
  conversationId?: string;
}

const formatTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const Messages = ({ conversationId }: MessagesProps) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(Boolean(conversationId));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const activeId = conversationId ?? "";

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoadingInbox(true);
      try {
        const loaded = await getConversations();
        if (!cancelled) {
          setConversations(loaded);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load conversations.");
        }
      } finally {
        if (!cancelled) {
          setLoadingInbox(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) {
      setActiveConversation(null);
      setMessages([]);
      setLoadingThread(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingThread(true);
      setError(null);
      try {
        const detail = await getConversationDetail(activeId);
        if (!cancelled) {
          setActiveConversation(detail.conversation);
          setMessages(detail.messages);
          setCurrentUserId(detail.currentUserId);
          setConversations((current) =>
            current.map((item) => (item.id === detail.conversation.id ? detail.conversation : item)),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load conversation.");
        }
      } finally {
        if (!cancelled) {
          setLoadingThread(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loadingThread]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const selectedConversation = useMemo(() => {
    return activeConversation ?? conversations.find((item) => item.id === activeId) ?? null;
  }, [activeConversation, activeId, conversations]);

  const handleSend = async () => {
    const message = draft.trim();
    if (!activeId || !message) {
      return;
    }

    setSending(true);
    setError(null);
    try {
      const saved = await sendConversationMessage(activeId, message);
      setMessages((current) => [...current, saved]);
      setDraft("");
      setToastMessage("Message sent");
      setConversations((current) =>
        current.map((item) =>
          item.id === activeId
            ? {
                ...item,
                latestMessage: saved.body,
                latestMessageAt: saved.createdAt,
                latestSenderId: saved.senderId,
              }
            : item,
        ),
      );
    } catch (sendError) {
      const messageText = sendError instanceof Error ? sendError.message : "Failed to send message.";
      setError(messageText);
      setToastMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Messages</h1>
        <p className={styles.subtitle}>Buyer and seller conversations will appear here when someone contacts you from a listing.</p>
      </header>

      {error ? (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.layout}>
        <aside className={styles.inbox} aria-label="Conversation inbox">
          <div className={styles.inboxHeader}>
            <h2>Inbox</h2>
            <span>{conversations.length}</span>
          </div>

          {loadingInbox ? <p className={styles.emptyText}>Loading conversations...</p> : null}

          {!loadingInbox && conversations.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No messages yet</h2>
              <p>Once a buyer reaches out, your real conversations will appear here. Nothing is pre-filled or fake.</p>
              <a href="/listings" className={styles.actionLink}>
                Browse listings
              </a>
            </div>
          ) : null}

          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            const imageSrc = getListingImageSrc(conversation.listingImage);
            return (
              <a
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className={active ? `${styles.conversationCard} ${styles.activeCard}` : styles.conversationCard}
                aria-current={active ? "page" : undefined}
              >
                <img src={imageSrc} alt="" className={styles.listingThumb} />
                <span className={styles.conversationBody}>
                  <span className={styles.conversationTopline}>
                    <strong>{conversation.otherParticipantName}</strong>
                    <time>{formatTimestamp(conversation.latestMessageAt)}</time>
                  </span>
                  <span className={styles.listingTitle}>{conversation.listingTitle}</span>
                  <span className={styles.preview}>{conversation.latestMessage}</span>
                </span>
                {conversation.unreadCount > 0 ? (
                  <span className={styles.unreadBadge} aria-label={`${conversation.unreadCount} unread messages`}>
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </a>
            );
          })}
        </aside>

        <section className={styles.thread} aria-label="Conversation thread">
          {!activeId ? (
            <div className={styles.threadEmpty}>
              <h2>Select a conversation</h2>
              <p>Choose a thread to read details, reply, and keep the sale moving.</p>
            </div>
          ) : null}

          {activeId && loadingThread ? <p className={styles.emptyText}>Loading messages...</p> : null}

          {activeId && !loadingThread && selectedConversation ? (
            <>
              <div className={styles.threadHeader}>
                <div>
                  <h2>{selectedConversation.otherParticipantName}</h2>
                  <a href={`/listings/${selectedConversation.listingId}`}>{selectedConversation.listingTitle}</a>
                </div>
                <span>{selectedConversation.listingPrice}</span>
              </div>

              <div className={styles.messageList}>
                {messages.map((message) => {
                  const mine = message.senderId === currentUserId;
                  return (
                    <div key={message.id} className={mine ? `${styles.messageRow} ${styles.mine}` : styles.messageRow}>
                      <div className={styles.messageBubble}>
                        <p>{message.body}</p>
                        <time>{formatTimestamp(message.createdAt)}</time>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form
                className={styles.composer}
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSend();
                }}
              >
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Write a message..."
                  aria-label="New message"
                />
                <button type="submit" disabled={sending || !draft.trim()}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
            </>
          ) : null}
        </section>
      </div>

      {toastMessage ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
};
