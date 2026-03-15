type LoginFormProps = {
  initialError: string | null;
};

export function LoginForm({ initialError }: LoginFormProps) {
  return (
    <form action="/auth/login" method="post" className="rfq-form" style={{ gridTemplateColumns: "1fr" }}>
      <label>
        <span>Email</span>
        <input name="email" type="email" required />
      </label>
      <label>
        <span>Password</span>
        <input name="password" type="password" required />
      </label>
      {initialError && <p className="notice notice-error">{initialError}</p>}
      <button type="submit" className="primary-btn">Sign In</button>
    </form>
  );
}
