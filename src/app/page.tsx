import { Header } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { Players } from "@/components/site/players";
import { Matrix } from "@/components/site/matrix";
import { Analysis } from "@/components/site/analysis";
import { SystemBlueprint } from "@/components/site/system-blueprint";
import { SystemLive } from "@/components/site/system-live";
import { Outlook } from "@/components/site/outlook";
import { Verdict, Footer } from "@/components/site/verdict";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <Players />
        <Matrix />
        <Analysis />
        <SystemBlueprint />
        <SystemLive />
        <Outlook />
        <Verdict />
      </main>
      <Footer />
    </div>
  );
}
