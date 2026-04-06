"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Loader2, User } from "lucide-react";
import type { CommentItem } from "../../../api";
import { addComment, getComments } from "../../../api";

type CommentSectionProps = {
  rfqId: string;
  currentUserId: string;
  initialComments: CommentItem[];
};

const roleBadgeStyles: Record<string, string> = {
  LONDON_SALES: "bg-blue-100 text-blue-700",
  ISTANBUL_PRICING: "bg-amber-100 text-amber-700",
  ISTANBUL_MANAGER: "bg-emerald-100 text-emerald-700",
  ADMIN: "bg-purple-100 text-purple-700",
};

const roleLabels: Record<string, string> = {
  LONDON_SALES: "London",
  ISTANBUL_PRICING: "Pricing",
  ISTANBUL_MANAGER: "Manager",
  ADMIN: "Admin",
};

import { formatRelativeTime } from "@/lib/format";

const formatTime = formatRelativeTime;

function CommentBubble({ comment, isOwn }: { comment: CommentItem; isOwn: boolean }) {
  const initials = comment.author.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
        isOwn ? "bg-primary" : "bg-muted-foreground/50"
      }`}>
        {initials}
      </div>

      {/* Content */}
      <div className={`max-w-[85%] ${isOwn ? "text-right" : ""}`}>
        <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-[11px] font-semibold leading-none">{comment.author.fullName}</span>
          <span className={`inline-block rounded px-1 py-0 text-[9px] font-bold leading-tight ${roleBadgeStyles[comment.author.role] ?? "bg-muted text-muted-foreground"}`}>
            {roleLabels[comment.author.role] ?? comment.author.role}
          </span>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted rounded-tl-sm"
        }`}>
          {comment.body}
        </div>
        <p className={`text-[10px] text-muted-foreground mt-0.5 ${isOwn ? "text-right" : ""}`}>
          {formatTime(comment.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function CommentSection({ rfqId, currentUserId, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [body, setBody] = useState("");
  const [, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  // Poll for new comments every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(async () => {
        try {
          const fresh = await getComments(rfqId);
          setComments(fresh);
        } catch {
          // silently ignore
        }
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [rfqId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const newComment = await addComment(rfqId, text);
      setComments((prev) => [...prev, newComment]);
      setBody("");
      inputRef.current?.focus();
    } catch {
      // Could show error
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <Card className="flex flex-col" style={{ maxHeight: "calc(100vh - 2rem)" }}>
      <CardHeader className="pb-2 px-4 pt-4 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="size-4" />
            Conversation
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">{comments.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 overflow-hidden px-4 pb-4 pt-0">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[200px]"
          style={{ maxHeight: "calc(100vh - 12rem)" }}
        >
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <User className="size-7 mb-2 opacity-30" />
              <p className="text-xs">No messages yet</p>
              <p className="text-[10px] opacity-60">Start the conversation</p>
            </div>
          ) : (
            comments.map((c) => (
              <CommentBubble key={c.id} comment={c} isOwn={c.author.id === currentUserId} />
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2 shrink-0 border-t border-border pt-3">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={sending}
          />
          <Button type="submit" size="sm" disabled={sending || !body.trim()} className="self-end shrink-0 h-9 w-9 p-0">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">Enter to send · Shift+Enter for new line</p>
      </CardContent>
    </Card>
  );
}
