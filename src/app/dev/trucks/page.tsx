import { TruckIllustration } from "@/components/graphics/TruckIllustration";
import type { VehicleKind } from "@/lib/types";
const K: VehicleKind[] = ["pickup", "nissan", "kamionet", "khavar", "truck10", "dahcharkh", "trailer", "dry"];
const C = ["white", "blue", "red", "navy", "yellow", "silver", "green", "black"];
export default function Page() {
  return (
    <main className="grid gap-4 bg-white p-6 md:grid-cols-4">
      {K.map((k, i) => <div key={k} className="rounded-2xl border border-line p-3"><div className="mb-1 text-xs">{k}</div><TruckIllustration kind={k} color={C[i]} state={i % 2 ? "cooling" : "idle"} className="h-36 w-full" /></div>)}
    </main>
  );
}
