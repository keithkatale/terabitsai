export function AuthMethodDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
        <span className="bg-[var(--terminal-card-bg,#18181b)] px-3 text-zinc-500">or</span>
      </div>
    </div>
  );
}
