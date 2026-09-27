import { AppShell } from "@/components/app/app-shell";

/**
 * The site is a single-route application: the server component mounts the
 * client app shell, which owns view state (dashboard, map, analytics,
 * vehicles, alerts, sources, analyst, report) behind URL hashes. The original
 * long-form report lives inside the shell's Report view.
 */
export default function Home() {
  return <AppShell />;
}
