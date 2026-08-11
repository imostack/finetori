import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("writer");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Your account</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Signed in as {user.name} ({user.email}) · {user.role}
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Change your password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
