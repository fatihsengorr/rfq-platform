"use client";

import { useState, useActionState } from "react";
import { IDLE_RESULT } from "../../../../lib/action-result";
import { resendInviteAction, resetPasswordAction, updateActiveAction, updateRoleAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormMessage } from "@/components/ui/form-message";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Search,
  Loader2,
  Pencil,
  Shield,
  KeyRound,
  Power,
  Users,
  Mail,
  Send,
  Clock,
  AlertTriangle,
} from "lucide-react";

type UserRole = "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";

type User = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  hasPassword: boolean;
  inviteStatus: "none" | "pending" | "expired";
};

type UserDirectoryProps = {
  users: User[];
  currentUserId: string;
};

const selectClasses =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/* ── Invite Status Badge ──────────────────────────────────────────── */

function InviteBadge({ user }: { user: User }) {
  if (user.hasPassword) return null;

  if (user.inviteStatus === "pending") {
    return (
      <Badge variant="outline" className="text-[10px] border-warning/40 text-warning bg-warning/5 gap-1">
        <Clock className="size-2.5" />
        Pending Invite
      </Badge>
    );
  }

  if (user.inviteStatus === "expired") {
    return (
      <Badge variant="outline" className="text-[10px] border-danger/40 text-danger bg-danger/5 gap-1">
        <AlertTriangle className="size-2.5" />
        Invite Expired
      </Badge>
    );
  }

  return null;
}

/* ── Edit User Dialog ─────────────────────────────────────────────── */

function EditUserDialog({
  user,
  open,
  onOpenChange,
  isSelf,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSelf: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(updateRoleAction, IDLE_RESULT);
  const [activeState, activeAction, activePending] = useActionState(updateActiveAction, IDLE_RESULT);
  const [pwState, pwAction, pwPending] = useActionState(resetPasswordAction, IDLE_RESULT);
  const [inviteState, inviteAction, invitePending] = useActionState(resendInviteAction, IDLE_RESULT);

  // Confirmation dialog state for deactivation
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const feedback = [roleState, activeState, pwState, inviteState].find((s) => s.status !== "idle");
  const needsInvite = !user.hasPassword;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              {user.fullName} &middot; {user.email}
            </DialogDescription>
          </DialogHeader>

          {feedback && <FormMessage state={feedback} />}

          {/* Invite Warning Banner */}
          {needsInvite && (
            <div className={`rounded-lg border px-3 py-2.5 text-sm flex items-start gap-2 ${
              user.inviteStatus === "expired"
                ? "border-danger/30 bg-danger/5 text-danger"
                : "border-warning/30 bg-warning/5 text-warning"
            }`}>
              {user.inviteStatus === "expired" ? (
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              ) : (
                <Clock className="size-4 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-xs">
                  {user.inviteStatus === "expired"
                    ? "Invitation expired"
                    : "Awaiting password setup"}
                </p>
                <p className="text-xs mt-0.5 opacity-80">
                  {user.inviteStatus === "expired"
                    ? "This user never set their password. Resend the invitation so they can activate their account."
                    : "This user has a pending invitation. They need to click the link in their email to set a password."}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Resend Invite — prominent when needed */}
            {needsInvite && (
              <div className={`rounded-lg border p-4 space-y-3 ${
                user.inviteStatus === "expired" ? "border-danger/30 bg-danger/5" : "border-border"
              }`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Send className="size-4 text-primary" />
                  {user.inviteStatus === "expired" ? "Resend Invitation" : "Invitation"}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Send a new invitation email with a password setup link (valid for 48 hours).
                  </p>
                  <form action={inviteAction} className="shrink-0">
                    <input type="hidden" name="userId" value={user.id} />
                    <Button
                      type="submit"
                      variant={user.inviteStatus === "expired" ? "default" : "outline"}
                      size="sm"
                      disabled={invitePending}
                    >
                      {invitePending ? <Loader2 className="size-3 animate-spin" /> : <Mail className="size-3" />}
                      {user.inviteStatus === "expired" ? "Resend Now" : "Resend"}
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {/* Role Section */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="size-4 text-primary" />
                Change Role
              </div>
              {isSelf ? (
                <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
              ) : (
                <form action={roleAction} className="flex items-end gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="flex-1 grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <select name="role" defaultValue={user.role} className={selectClasses}>
                      <option value="LONDON_SALES">London Sales</option>
                      <option value="ISTANBUL_PRICING">Istanbul Pricing</option>
                      <option value="ISTANBUL_MANAGER">Istanbul Manager</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <Button type="submit" size="sm" disabled={rolePending}>
                    {rolePending && <Loader2 className="size-3 animate-spin" />}
                    Update Role
                  </Button>
                </form>
              )}
            </div>

            {/* Password Section */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="size-4 text-primary" />
                Reset Password
              </div>
              <form action={pwAction} className="flex items-end gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <div className="flex-1 grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">New Password</Label>
                  <Input
                    name="password"
                    type="password"
                    minLength={12}
                    placeholder="Min 12 chars, mixed case, number, special"
                    required
                  />
                </div>
                <Button type="submit" size="sm" disabled={pwPending}>
                  {pwPending && <Loader2 className="size-3 animate-spin" />}
                  Set Password
                </Button>
              </form>
            </div>

            {/* Resend Invite (for users who already have password) */}
            {!needsInvite && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Send className="size-4 text-primary" />
                  Send Password Setup Link
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Send an email with a link to set a new password (valid for 48 hours).
                  </p>
                  <form action={inviteAction} className="shrink-0">
                    <input type="hidden" name="userId" value={user.id} />
                    <Button type="submit" variant="outline" size="sm" disabled={invitePending}>
                      {invitePending ? <Loader2 className="size-3 animate-spin" /> : <Mail className="size-3" />}
                      Send Link
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {/* Activate / Deactivate Section */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Power className="size-4 text-primary" />
                Account Status
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    Currently: <StatusBadge status={user.isActive ? "active" : "inactive"} />
                  </p>
                </div>
                {isSelf ? (
                  <p className="text-xs text-muted-foreground">You cannot deactivate your own account.</p>
                ) : user.isActive ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDeactivate(true)}
                    disabled={activePending}
                  >
                    {activePending && <Loader2 className="size-3 animate-spin" />}
                    Deactivate
                  </Button>
                ) : (
                  <form action={activeAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="isActive" value="true" />
                    <Button type="submit" variant="success" size="sm" disabled={activePending}>
                      {activePending && <Loader2 className="size-3 animate-spin" />}
                      Activate
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation */}
      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title="Deactivate User"
        description={`Are you sure you want to deactivate "${user.fullName}"? They will lose access to the platform immediately.`}
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        loading={activePending}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("userId", user.id);
          fd.set("isActive", "false");
          activeAction(fd);
          setConfirmDeactivate(false);
        }}
      />
    </>
  );
}

/* ── User Card ────────────────────────────────────────────────────── */

function UserCard({
  user,
  isSelf,
  onEdit,
}: {
  user: User;
  isSelf: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      className={`group flex items-center justify-between gap-4 rounded-lg border bg-card p-4 transition-all hover:shadow-sm cursor-pointer ${
        !user.hasPassword && user.inviteStatus === "expired"
          ? "border-danger/30 hover:border-danger/50"
          : !user.hasPassword && user.inviteStatus === "pending"
            ? "border-warning/30 hover:border-warning/50"
            : "border-border hover:border-primary/30"
      }`}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onEdit()}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
            !user.hasPassword
              ? "bg-warning/80"
              : user.isActive
                ? "bg-primary"
                : "bg-muted-foreground/40"
          }`}
        >
          {user.fullName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{user.fullName}</p>
            {isSelf && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                You
              </Badge>
            )}
            <InviteBadge user={user} />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <Mail className="size-3 shrink-0" />
            {user.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <RoleBadge role={user.role} />
        <StatusBadge status={user.isActive ? "active" : "inactive"} />
        <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

/* ── Main Directory ───────────────────────────────────────────────── */

export function UserDirectory({ users, currentUserId }: UserDirectoryProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "active" && u.isActive) ||
      (statusFilter === "inactive" && !u.isActive) ||
      (statusFilter === "pending" && !u.hasPassword);
    return matchSearch && matchRole && matchStatus;
  });

  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;
  const pendingCount = users.filter((u) => !u.hasPassword).length;

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            User Directory
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {activeCount} active
            </Badge>
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-xs border-warning/40 text-warning">
                {pendingCount} pending
              </Badge>
            )}
            {inactiveCount > 0 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {inactiveCount} inactive
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ALL">All Roles</option>
              <option value="LONDON_SALES">London Sales</option>
              <option value="ISTANBUL_PRICING">Istanbul Pricing</option>
              <option value="ISTANBUL_MANAGER">Istanbul Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ALL">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending Invite</option>
            </select>
          </div>

          {/* User List */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description={search || roleFilter !== "ALL" || statusFilter !== "ALL"
                ? "Try adjusting your search or filters."
                : "No users have been created yet."}
            />
          ) : (
            <div className="grid gap-2">
              {filtered.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUserId}
                  onEdit={() => setEditingUser(user)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          isSelf={editingUser.id === currentUserId}
        />
      )}
    </>
  );
}
