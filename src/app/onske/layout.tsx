import type { Metadata } from "next";
import "./onske.css";

export const metadata: Metadata = {
	title: "Ønskebrønnen",
	description: "Kast en mynt — få et ønske.",
};

export default function OnskeLayout({ children }: { children: React.ReactNode }) {
	return children;
}
