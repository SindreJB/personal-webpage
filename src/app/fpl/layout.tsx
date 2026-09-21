import type { Metadata } from "next";
import "./krystallkulen.css";

export const metadata: Metadata = {
	title: "Krystallkulen — FPL",
	description:
		"Beslutningsstøtte for Fantasy Premier League: forventede poeng seks runder fram, kaptein, ellever, bytteforslag og prisrisiko.",
};

export default function FplLayout({ children }: { children: React.ReactNode }) {
	return children;
}
