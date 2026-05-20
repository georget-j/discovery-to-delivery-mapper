import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { JourneyBar } from "@/components/JourneyBar";
import { CommandPalette } from "@/components/CommandPalette";
import { GuidedTour } from "@/components/GuidedTour";
import { ProjectCopilot } from "@/components/ProjectCopilot";
import { loadScenario } from "@/lib/scenarios";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Seeded scenarios have known company names; ad-hoc projects (localStorage)
  // can't be read server-side, so fall back to a generic title.
  const scenario = loadScenario(id);
  const name = scenario?.customer.companyName ?? "Workspace";
  return {
    title: `${name} · Onboarding Simulator`,
  };
}

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspaceProvider id={id}>
      <div
        className="flex flex-col"
        style={{ height: "calc(100dvh - 3.5rem)" }}
      >
        <JourneyBar />
        <div className="flex flex-1 min-h-0">
          <WorkspaceSidebar />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
      <CommandPalette projectId={id} />
      <GuidedTour projectId={id} />
      <ProjectCopilot />
    </WorkspaceProvider>
  );
}
