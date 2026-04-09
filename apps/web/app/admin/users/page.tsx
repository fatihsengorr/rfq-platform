import { redirect } from "next/navigation";
import { getUsers, isApiClientError } from "../../api";
import { getSession } from "../../../lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { CreateUserForm } from "./components/create-user-form";
import { UserDirectory } from "./components/user-directory";

export default async function AdminUsersPage() {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/requests");
  }

  let users: Awaited<ReturnType<typeof getUsers>> = [];
  let destination = "";

  try {
    users = await getUsers();
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
      destination = "/login";
    }
  }

  if (destination) {
    redirect(destination);
  }

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <PageHeader
        title="Admin Users"
        description="Create users, assign office roles, and control access visibility."
      />
      <CreateUserForm />
      <UserDirectory users={users} currentUserId={session.user.id} />
    </main>
  );
}
