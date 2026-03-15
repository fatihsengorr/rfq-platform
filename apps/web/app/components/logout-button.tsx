import Link from "next/link";

export function LogoutButton() {
  return (
    <Link href="/logout" className="secondary-btn">
      Sign Out
    </Link>
  );
}
