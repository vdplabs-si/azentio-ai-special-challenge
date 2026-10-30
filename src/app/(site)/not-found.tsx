import { NotFoundContent } from "@/components/site/not-found-content";

/** 404 for notFound() inside public pages (rendered within the site header/footer). */
export default function SiteNotFound() {
  return <NotFoundContent />;
}
