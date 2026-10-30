import { permanentRedirect } from "next/navigation";

/** /hackathon has no page of its own; registration lives at /hackathon/register. */
export default function HackathonIndex() {
  permanentRedirect("/hackathon/register");
}
