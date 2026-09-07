import DiagramCanvas from "@/components/DiagramCanvas";
import ErrorBoundary from "@/components/ErrorBoundary";
import AutosaveManager from "@/components/AutosaveManager";

export default function Home() {
  return (
    <ErrorBoundary>
      <DiagramCanvas />
      <AutosaveManager />
    </ErrorBoundary>
  );
}
