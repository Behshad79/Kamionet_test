import { Landing } from "@/components/landing/Landing";

const LD = [
  { "@context": "https://schema.org", "@type": "Organization", name: "کامیونت", description: "پلتفرم حمل بار یخچالی و زنجیره‌ی سرد در ایران", areaServed: "IR", inLanguage: "fa" },
  { "@context": "https://schema.org", "@type": "Service", serviceType: "حمل بار یخچالی", provider: { "@type": "Organization", name: "کامیونت" }, areaServed: "IR" },
];

export default function Page() {
  return (<><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} /><Landing /></>);
}
