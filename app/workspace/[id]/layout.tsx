import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { JourneyBar } from "@/components/JourneyBar";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <WorkspaceLayoutInner params={params}>
      {children}
    </WorkspaceLayoutInner>
  );
}

async function WorkspaceLayoutInner({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspaceProvider id={id}>
      <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
        <JourneyBar />
        <div className="flex flex-1 min-h-0">
          <WorkspaceSidebar />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
