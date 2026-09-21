import type { Metadata } from "next";
import "./norgespris.css";

export const metadata: Metadata = {
  title: "Norgespris index",
  description:
    "Hva Norgespris har gjort med strømregningen: fastprisen på 50 øre/kWh målt mot spotpris og strømstøtte i din strømsone.",
};

export default function NorgesprisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
