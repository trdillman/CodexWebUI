import { LobeProvider } from "./lobe/LobeProvider";
import { LobeShell } from "./lobe/LobeShell";

export default function App() {
  return (
    <LobeProvider>
      <LobeShell />
    </LobeProvider>
  );
}
