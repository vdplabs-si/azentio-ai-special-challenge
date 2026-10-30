import type { SerializedActor } from "@/lib/authz/serialize";

/**
 * Portal navigation. Visibility here is presentation only — every page and API enforces
 * the same rules server-side (src/lib/authz). Icons are lucide names resolved in the sidebar.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  visible?: (a: SerializedActor) => boolean;
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

const has = (a: SerializedActor, role: string) => (a.roles as string[]).includes(role);
const admin = (a: SerializedActor) => has(a, "PORTAL_ADMIN") || has(a, "SUPER_ADMIN");
const participant = (a: SerializedActor) => a.isEmployee || a.memberships.some((m) => m.type === "CLIENT");

export const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/portal", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/portal/search", label: "Search", icon: "Search" },
      { href: "/portal/notifications", label: "Notifications", icon: "Bell" },
    ],
  },
  {
    label: "Collaboration",
    items: [
      { href: "/portal/workspaces", label: "Workspaces", icon: "Building2" },
      { href: "/portal/projects", label: "Projects", icon: "FolderKanban" },
      { href: "/portal/tasks", label: "My tasks", icon: "ListChecks" },
    ],
  },
  {
    label: "Collective learning",
    items: [
      { href: "/portal/observations", label: "Observations", icon: "NotebookPen", visible: participant },
      { href: "/portal/learning", label: "Shared learning", icon: "Library", visible: participant },
      { href: "/portal/themes", label: "Themes", icon: "Shapes", visible: participant },
      { href: "/portal/ideas", label: "Improvement ideas", icon: "Lightbulb", visible: participant },
      { href: "/portal/moderation", label: "Moderation", icon: "ShieldCheck", visible: (a) => has(a, "LEARNING_MODERATOR") },
      { href: "/portal/aira", label: "AIRA assistant", icon: "Sparkles", visible: participant },
    ],
  },
  {
    label: "Innovation",
    items: [
      { href: "/portal/playground", label: "Playground", icon: "FlaskConical" },
      { href: "/portal/live", label: "Live sessions", icon: "Radio" },
      { href: "/portal/experiments", label: "Experiments", icon: "Beaker", visible: (a) => a.isEmployee },
      { href: "/portal/hackathon", label: "Hackathon teams", icon: "Trophy", visible: (a) => a.isEmployee },
      { href: "/portal/knowledge", label: "Knowledge & releases", icon: "BookOpen" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/portal/admin", label: "Admin overview", icon: "Gauge", visible: admin },
      { href: "/portal/admin/users", label: "Users & roles", icon: "Users", visible: admin },
      { href: "/portal/admin/organisations", label: "Organisations", icon: "Network", visible: admin },
      { href: "/portal/admin/inquiries", label: "Inquiries", icon: "Inbox", visible: admin },
      { href: "/portal/admin/content", label: "Website content", icon: "Megaphone", visible: (a) => has(a, "CONTENT_PUBLISHER") },
      { href: "/portal/admin/audit", label: "Audit log", icon: "ScrollText", visible: admin },
    ],
  },
];

/** Breadcrumb labels for known path segments. Unknown segments (IDs) render as "Details". */
export const SEGMENT_LABELS: Record<string, string> = {
  portal: "Portal",
  search: "Search",
  notifications: "Notifications",
  workspaces: "Workspaces",
  projects: "Projects",
  tasks: "My tasks",
  observations: "Observations",
  new: "New",
  learning: "Shared learning",
  themes: "Themes",
  ideas: "Improvement ideas",
  moderation: "Moderation",
  aira: "AIRA",
  playground: "Playground",
  live: "Live sessions",
  experiments: "Experiments",
  hackathon: "Hackathon teams",
  knowledge: "Knowledge & releases",
  admin: "Administration",
  users: "Users & roles",
  organisations: "Organisations",
  inquiries: "Inquiries",
  content: "Website content",
  audit: "Audit log",
  profile: "Profile",
  members: "Members",
  settings: "Settings",
  reports: "Reports",
};

export function visibleNav(actor: SerializedActor): NavSection[] {
  return NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.visible || i.visible(actor)) })).filter((s) => s.items.length);
}
