import { Award, Banknote, Globe, Mail, PenTool, ScanFace, Send, StickyNote } from "lucide-react";

const NEXT = [
  { name: "Gmail payment emails", note: "Upwork, Fiverr, PayPal, Payoneer · signature-checked", icon: Mail },
  { name: "Wise", note: "Incoming client payments", icon: Send },
  { name: "Partner bank", note: "Account transactions with your consent", icon: Banknote },
  { name: "Canva", note: "Designs and edits", icon: PenTool },
  { name: "Webflow", note: "Sites built and published", icon: Globe },
  { name: "Miro", note: "Client workshops and boards", icon: StickyNote },
  { name: "Dribbble", note: "Portfolio and track record", icon: Award },
  { name: "ID check", note: "Live ID photo, selfie, bank KYC match", icon: ScanFace },
];

export function ComingNext() {
  return (
    <section className="glass rounded-3xl p-5">
      <p className="font-display font-semibold">Coming next</p>
      <p className="text-xs text-muted-foreground">More ways to prove income and work, all read from the source.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {NEXT.map((n) => (
          <li key={n.name} className="flex items-center gap-3 rounded-2xl border border-dashed bg-background/40 p-3 text-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted"><n.icon className="size-4 text-muted-foreground" /></span>
            <span><span className="flex items-center gap-1.5 font-medium">{n.name}<span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Soon</span></span><span className="block text-xs text-muted-foreground">{n.note}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
