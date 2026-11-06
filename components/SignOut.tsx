export function SignOut({ className = 'btn btn-sm' }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button className={className} type="submit">Sign out</button>
    </form>
  );
}
