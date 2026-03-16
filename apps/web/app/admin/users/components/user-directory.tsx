"use client";

import { useActionState } from "react";
import { IDLE_RESULT } from "../../../../lib/action-result";
import { resetPasswordAction, updateActiveAction, updateRoleAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormMessage } from "@/components/ui/form-message";
import { Loader2 } from "lucide-react";

type User = {
  id: string;
  email: string;
  fullName: string;
  role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
  isActive: boolean;
};

type UserDirectoryProps = {
  users: User[];
};

function UserRow({ user }: { user: User }) {
  const [roleState, roleAction, rolePending] = useActionState(updateRoleAction, IDLE_RESULT);
  const [activeState, activeAction, activePending] = useActionState(updateActiveAction, IDLE_RESULT);
  const [pwState, pwAction, pwPending] = useActionState(resetPasswordAction, IDLE_RESULT);

  const feedback = [roleState, activeState, pwState].find((s) => s.status !== "idle");

  return (
    <>
      <TableRow>
        <TableCell className="font-semibold">{user.fullName}</TableCell>
        <TableCell className="text-sm">{user.email}</TableCell>
        <TableCell><RoleBadge role={user.role} /></TableCell>
        <TableCell>
          <StatusBadge status={user.isActive ? "active" : "inactive"} />
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <form action={roleAction} className="flex items-center gap-1">
              <input type="hidden" name="userId" value={user.id} />
              <select
                name="role"
                defaultValue={user.role}
                className="h-8 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="LONDON_SALES">London Sales</option>
                <option value="ISTANBUL_PRICING">Istanbul Pricing</option>
                <option value="ISTANBUL_MANAGER">Istanbul Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
              <Button type="submit" variant="outline" size="sm" disabled={rolePending}>
                {rolePending && <Loader2 className="size-3 animate-spin" />}
                Save
              </Button>
            </form>

            <form action={activeAction} className="flex items-center gap-1">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="isActive" value={user.isActive ? "false" : "true"} />
              <Button type="submit" variant="outline" size="sm" disabled={activePending}>
                {activePending && <Loader2 className="size-3 animate-spin" />}
                {user.isActive ? "Deactivate" : "Activate"}
              </Button>
            </form>

            <form action={pwAction} className="flex items-center gap-1">
              <input type="hidden" name="userId" value={user.id} />
              <Input
                name="password"
                type="password"
                minLength={12}
                placeholder="New password"
                required
                className="h-8 w-32 text-xs"
              />
              <Button type="submit" variant="outline" size="sm" disabled={pwPending}>
                {pwPending && <Loader2 className="size-3 animate-spin" />}
                Set
              </Button>
            </form>
          </div>
        </TableCell>
      </TableRow>
      {feedback && (
        <TableRow>
          <TableCell colSpan={5} className="py-1">
            <FormMessage state={feedback} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function UserDirectory({ users }: UserDirectoryProps) {
  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>User Directory</CardTitle>
        <Badge variant="outline">Role, access and password controls</Badge>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">No users found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
