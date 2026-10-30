import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(0,34rem)]">
      <aside className="relative hidden overflow-hidden bg-brand-navy p-12 text-white lg:flex lg:flex-col">
        <Link href="/" aria-label="azentio.ai home">
          <Wordmark inverted className="text-2xl" />
        </Link>
        <div className="mt-auto max-w-lg">
          <p className="eyebrow text-brand-green">Secure collaboration portal</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight">Build intelligence. Create shared value.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Employees and clients get distinct, permissioned experiences. Client observations stay private until their
            author explicitly proposes them and a moderator approves a de-identified shared version.
          </p>
          <ul className="mt-8 grid gap-3 text-sm text-white/80">
            <li>• Server-side role, tenant and entitlement checks on every request</li>
            <li>• Explicit sharing choices and separately recorded consents</li>
            <li>• Every privileged action is audited</li>
          </ul>
        </div>
        <svg aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-[28rem] opacity-20" viewBox="0 0 200 200">
          {[[40, 60], [120, 30], [160, 110], [90, 150], [30, 140], [100, 90]].map(([x, y], i, pts) => (
            <g key={i}>
              {pts.slice(i + 1).map(([x2, y2], j) => (
                <line key={j} x1={x} y1={y} x2={x2} y2={y2} stroke="#69d393" strokeWidth="0.6" />
              ))}
              <circle cx={x} cy={y} r="3.5" fill="#69d393" />
            </g>
          ))}
        </svg>
      </aside>
      <main id="main-content" className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <Link href="/" className="mb-10 lg:hidden" aria-label="azentio.ai home">
          <Wordmark />
        </Link>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
