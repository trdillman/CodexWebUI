import { AppStateProvider } from "./state/AppStateContext";
import { LobeProvider } from "./lobe/LobeProvider";
import { LobeShell } from "./lobe/LobeShell";

export default function App() {
  return (
    <AppStateProvider>
      <LobeProvider>
        <LobeShell />
      </LobeProvider>
    </AppStateProvider>
  );
}
