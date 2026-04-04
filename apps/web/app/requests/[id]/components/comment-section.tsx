"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  LONDON_SALES: "bg-blue-100 text-blue-800 border-blue-200",
  ISTANBUL_PRICING: "bg-amber-100 text-amber-800 border-amber-200",
  ISTANBUL_MANAGER: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
};

const roleLabels: Record<string, string> = {
  LONDON_SALES: "London",
  ISTANBUL_PRICING: "Pricing",
  ISTANBUL_MANAGER: "Manager",
  ADMIN: "Admin",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function CommentBubble({ comment, isOwn }: { comment: CommentItem; isOwn: boolean }) {
  return (
    <div className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
        isOwn ? "bg-primary" : "bg-muted-foreground/60"
      }`}>
        {comment.author.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-2 mb-1 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-xs font-semibold">{comment.author.fullName}</span>
          <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-bold ${roleBadgeStyles[comment.author.role] ?? "bg-muted text-muted-foreground border-border"}`}>
            {roleLabels[comment.author.role] ?? comment.author.role}
          </span>
          <span className="text-[10px] text-muted-foreground">{formatTime(comment.createdAt)}</span>
        </div>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted rounded-tl-sm"
        }`}>
          {comment.body}
        </div>
      </div>
    </div>
  );
}

export function CommentSection({ rfqId, currentUserId, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          // silently ignore polling errors
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
      textareaRef.current?.focus();
    } catch {
      // Could show error toast
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
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="size-5" />
          Conversation
        </CardTitle>
        <Badge variant="outline">{comments.length} message{comments.length !== 1 ? "s" : ""}</Badge>
      </CardHeader>
      <CardContent>
        {/* Messages */}
        <div
          ref={scrollRef}
          className="space-y-4 overflow-y-auto pr-1"
          style={{ maxHeight: "400px", minHeight: comments.length > 0 ? "120px" : "60px" }}
        >
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <User className="size-8 mb-2 opacity-40" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            comments.map((c) => (
              <CommentBubble key={c.id} comment={c} isOwn={c.author.id === currentUserId} />
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="resize-none flex-1"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !body.trim()} className="self-end shrink-0">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
